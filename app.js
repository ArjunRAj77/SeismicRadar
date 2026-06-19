/**
 * SeismicRadar | Global Earthquake Monitor
 * Real-time USGS GeoJSON rendered on a Leaflet map with a glassmorphism UI.
 */

document.addEventListener('DOMContentLoaded', () => {

    /* ---------------------------------------------------------------- */
    /* 1. Map initialisation                                            */
    /* ---------------------------------------------------------------- */
    const mapEl = document.getElementById('map');

    const map = L.map('map', {
        zoomControl: false,
        zoomSnap: 0,
        zoomDelta: 0.5,
        maxBoundsViscosity: 1.0,
        worldCopyJump: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 10,
        noWrap: true
    }).addTo(map);

    const fitMapToScreen = () => {
        const width = mapEl.offsetWidth;
        const height = mapEl.offsetHeight;
        if (!width || !height) return;
        const zoomX = Math.log2(width / 256);
        const zoomY = Math.log2(height / 256);
        const requiredZoom = Math.max(0, Math.max(zoomX, zoomY));
        const keepView = map._loaded ? map.getCenter() : L.latLng(20, 0);
        map.setMinZoom(0);
        map.setMaxBounds([[-90, -180], [90, 180]]);
        map.setView(keepView, requiredZoom, { animate: false });
        map.setMinZoom(requiredZoom);
    };

    fitMapToScreen();

    let resizeRaf;
    const handleResize = () => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            map.invalidateSize({ animate: false });
            fitMapToScreen();
        });
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    if (window.ResizeObserver) new ResizeObserver(handleResize).observe(mapEl);

    /* ---------------------------------------------------------------- */
    /* 2. Config, state & DOM references                               */
    /* ---------------------------------------------------------------- */
    const FEEDS = {
        hour: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
        day:  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
    };
    const PLATES_URL = 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json';
    const REFRESH_MS = 60000;

    const $ = (id) => document.getElementById(id);
    const quakeListEl   = $('quake-list');
    const statTotalEl   = $('stat-total');
    const statLargestEl = $('stat-largest');
    const statLatestEl  = $('stat-latest');
    const histogramEl   = $('histogram');
    const magSliderEl   = $('mag-slider');
    const magValueEl    = $('mag-value');
    const searchEl      = $('search-filter');
    const sortEl        = $('sort-select');
    const platesToggle  = $('plates-toggle');

    const statusUpdatedEl   = $('status-updated');
    const statusCountdownEl = $('status-countdown');
    const refreshBtn        = $('refresh-btn');

    const drawer        = $('detail-drawer');
    const sidebar       = $('sidebar');
    const sidebarHandle = $('sidebar-handle');

    const prefs = (() => {
        try { return JSON.parse(localStorage.getItem('seismic-prefs')) || {}; }
        catch (e) { return {}; }
    })();
    const savePrefs = () => {
        try { localStorage.setItem('seismic-prefs', JSON.stringify({
            range: state.range, minMag: state.minMag, sort: sortEl.value, plates: platesToggle.checked
        })); } catch (e) { /* ignore */ }
    };

    const state = {
        features: [],
        knownIds: null,
        range: prefs.range && FEEDS[prefs.range] ? prefs.range : 'day',
        minMag: typeof prefs.minMag === 'number' ? prefs.minMag : 0,
        userLoc: null,
        lastUpdated: 0,
        nextFetchAt: 0
    };

    const markersLayer = L.layerGroup().addTo(map);
    const platesLayer  = L.layerGroup();
    let platesLoaded = false;

    /* ---------------------------------------------------------------- */
    /* 3. Helpers                                                      */
    /* ---------------------------------------------------------------- */
    const getColor = (m) => (m >= 5 ? '#ef4444' : m >= 3 ? '#f97316' : '#facc15');
    const getRadius = (m) => Math.max((m || 0) * 3, 4);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const getRelativeTime = (ts) => {
        const mins = Math.round((ts - Date.now()) / 60000);
        if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
        const hrs = Math.round(mins / 60);
        if (Math.abs(hrs) < 24) return rtf.format(hrs, 'hour');
        return rtf.format(Math.round(hrs / 24), 'day');
    };
    const shortAge = (ts) => {
        const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
        if (s < 60) return s + 's';
        const m = Math.round(s / 60);
        if (m < 60) return m + 'm';
        const h = Math.round(m / 60);
        return h < 24 ? h + 'h' : Math.round(h / 24) + 'd';
    };

    const haversine = (a, b, c, d) => {
        const R = 6371, toRad = Math.PI / 180;
        const dLat = (c - a) * toRad, dLon = (d - b) * toRad;
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * toRad) * Math.cos(c * toRad) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    window.flyToQuake = (lat, lng, zoom) => {
        const target = Math.max(zoom || 5, map.getMinZoom());
        map.flyTo([lat, lng], target, { duration: 1.4, easeLinearity: 0.25 });
    };

    const buildIcon = (mag, color, isNewest, isMajor) => {
        const size = Math.max(getRadius(mag) * 2, 8);
        let ring = '';
        if (isNewest) ring = '<div class="quake-ring ring-newest"></div>';
        else if (isMajor) ring = '<div class="quake-ring ring-major"></div>';
        const html =
            '<div class="quake-icon" style="width:' + size + 'px;height:' + size + 'px;color:' + color + '">' +
                '<div class="quake-dot" style="width:100%;height:100%;background:' + color + ';opacity:' + (isMajor ? 0.7 : 0.5) + ';box-shadow:0 0 ' + (isMajor ? 12 : 6) + 'px ' + color + '"></div>' +
                ring +
            '</div>';
        return L.divIcon({ html: html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    };

    /* ---------------------------------------------------------------- */
    /* 4. Detail drawer                                                */
    /* ---------------------------------------------------------------- */
    const openDrawer = (props, depth) => {
        const mag = props.mag != null ? props.mag.toFixed(1) : 'N/A';
        $('drawer-mag').textContent = 'Magnitude ' + mag;
        $('drawer-mag').style.color = getColor(props.mag);
        $('drawer-place').textContent = props.place || 'Unknown location';
        $('drawer-depth').textContent = (depth != null ? depth.toFixed(0) : '-') + ' km';
        $('drawer-felt').textContent = props.felt != null ? props.felt : '-';
        const tsu = $('drawer-tsunami');
        tsu.textContent = props.tsunami ? 'Yes' : 'No';
        tsu.style.color = props.tsunami ? '#fca5a5' : '#86efac';
        $('drawer-link').href = props.url || 'https://earthquake.usgs.gov/';
        drawer.classList.add('open');
    };
    $('drawer-close').addEventListener('click', () => drawer.classList.remove('open'));

    /* ---------------------------------------------------------------- */
    /* 5. Stats + histogram                                            */
    /* ---------------------------------------------------------------- */
    const renderHistogram = (features) => {
        const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
        features.forEach(f => {
            const m = f.properties.mag;
            if (m == null) return;
            buckets[Math.min(7, Math.max(0, Math.floor(m)))]++;
        });
        const peak = Math.max(1, ...buckets);
        histogramEl.innerHTML = buckets.map((c, i) => {
            const color = i >= 5 ? '#ef4444' : i >= 3 ? '#f97316' : '#facc15';
            const h = Math.round((c / peak) * 100);
            return '<div class="bar" title="M' + i + '-' + (i + 1) + ': ' + c + '" style="height:' + h + '%;background:' + color + ';opacity:0.85"></div>';
        }).join('');
    };

    const renderStats = (filtered) => {
        statTotalEl.textContent = filtered.length;
        if (!filtered.length) { statLargestEl.textContent = '-'; statLatestEl.textContent = '-'; return; }
        const largest = filtered.reduce((a, f) => Math.max(a, f.properties.mag || 0), 0);
        const latest = filtered.reduce((a, f) => Math.max(a, f.properties.time || 0), 0);
        statLargestEl.textContent = largest.toFixed(1);
        statLargestEl.style.color = getColor(largest);
        statLatestEl.textContent = shortAge(latest);
    };

    /* ---------------------------------------------------------------- */
    /* 6. Rendering & filtering                                         */
    /* ---------------------------------------------------------------- */
    const render = () => {
        const minMag = state.minMag;
        const term = searchEl.value.toLowerCase().trim();
        const sortMode = sortEl.value;

        let filtered = state.features.filter(f => {
            const m = f.properties.mag || 0;
            const place = (f.properties.place || '').toLowerCase();
            return m >= minMag && (term === '' || place.includes(term));
        });

        if (sortMode === 'mag') {
            filtered.sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0));
        } else if (sortMode === 'distance' && state.userLoc) {
            filtered.sort((a, b) => {
                const da = haversine(state.userLoc.lat, state.userLoc.lng, a.geometry.coordinates[1], a.geometry.coordinates[0]);
                const db = haversine(state.userLoc.lat, state.userLoc.lng, b.geometry.coordinates[1], b.geometry.coordinates[0]);
                return da - db;
            });
        } else {
            filtered.sort((a, b) => (b.properties.time || 0) - (a.properties.time || 0));
        }

        renderStats(filtered);
        renderHistogram(state.features);
        markersLayer.clearLayers();
        quakeListEl.innerHTML = '';

        if (!filtered.length) {
            quakeListEl.innerHTML = '<div class="p-4 text-gray-500 text-sm text-center">No earthquakes match your filters.</div>';
            return;
        }

        let newestId = null, newestTime = -Infinity;
        filtered.forEach(f => { if ((f.properties.time || 0) > newestTime) { newestTime = f.properties.time; newestId = f.id; } });

        const frag = document.createDocumentFragment();

        filtered.forEach(f => {
            const coords = f.geometry.coordinates;
            const lng = coords[0], lat = coords[1], depth = coords[2];
            const p = f.properties;
            const magNum = p.mag;
            const mag = magNum != null ? magNum.toFixed(1) : 'N/A';
            const color = getColor(magNum);
            const isMajor = magNum >= 5;
            const isNewest = f.id === newestId;
            const isNew = state.knownIds && !state.knownIds.has(f.id);

            const marker = L.marker([lat, lng], { icon: buildIcon(magNum, color, isNewest, isMajor) });
            marker.bindPopup(
                '<div class="text-gray-100">' +
                    '<strong class="block text-base mb-1" style="color:' + color + '">Magnitude ' + mag + '</strong>' +
                    '<span class="block text-xs mb-1">' + (p.place || '') + '</span>' +
                    '<span class="text-xs text-gray-400">' + new Date(p.time).toLocaleString() + '</span>' +
                '</div>'
            );
            marker.on('click', () => openDrawer(p, depth));
            markersLayer.addLayer(marker);

            const card = document.createElement('div');
            card.className = 'quake-card' + (isNew ? ' is-new' : '');
            card.onclick = () => { flyToQuake(lat, lng); marker.openPopup(); openDrawer(p, depth); };
            card.innerHTML =
                (isNew ? '<span class="new-tag">NEW</span>' : '') +
                '<div class="mag-badge" style="color:' + color + ';border:2px solid ' + color + ';background:' + color + '1a' + (isMajor ? ';box-shadow:0 0 10px ' + color + '59' : '') + '">' + mag + '</div>' +
                '<div class="min-w-0 flex-1">' +
                    '<p class="text-xs font-medium text-gray-100 truncate" title="' + (p.place || '') + '">' + (p.place || 'Unknown location') + '</p>' +
                    '<p class="text-xs text-gray-400 mt-0.5">' + getRelativeTime(p.time) + (depth != null ? ' &middot; ' + depth.toFixed(0) + ' km deep' : '') + '</p>' +
                '</div>';
            frag.appendChild(card);
        });

        quakeListEl.appendChild(frag);
    };

    /* ---------------------------------------------------------------- */
    /* 7. Data fetching                                                */
    /* ---------------------------------------------------------------- */
    let refreshTimer;
    const scheduleNext = () => {
        clearTimeout(refreshTimer);
        state.nextFetchAt = Date.now() + REFRESH_MS;
        refreshTimer = setTimeout(fetchEarthquakes, REFRESH_MS);
    };

    async function fetchEarthquakes() {
        try {
            const res = await fetch(FEEDS[state.range]);
            if (!res.ok) throw new Error('USGS feed error');
            const data = await res.json();
            if (state.features.length || state.knownIds) {
                state.knownIds = new Set(state.features.map(f => f.id));
            }
            state.features = data.features;
            state.lastUpdated = Date.now();
            render();
        } catch (err) {
            console.error('Error fetching earthquakes:', err);
            if (!state.features.length) {
                quakeListEl.innerHTML = '<div class="p-4 text-red-400 text-sm text-center">Failed to load data. Retrying...</div>';
            }
        } finally {
            scheduleNext();
        }
    }

    async function fetchTectonicPlates(attempt) {
        attempt = attempt || 1;
        try {
            const res = await fetch(PLATES_URL);
            if (!res.ok) throw new Error('plates feed error');
            const data = await res.json();
            L.geoJSON(data, {
                style: { color: '#22d3ee', weight: 1.2, opacity: 0.45, dashArray: '5, 5' }
            }).addTo(platesLayer);
            platesLoaded = true;
            if (platesToggle.checked) map.addLayer(platesLayer);
        } catch (err) {
            console.error('Error fetching tectonic plates:', err);
            if (attempt < 4) setTimeout(() => fetchTectonicPlates(attempt + 1), attempt * 5000);
        }
    }

    /* ---------------------------------------------------------------- */
    /* 8. Refresh status ticker                                        */
    /* ---------------------------------------------------------------- */
    setInterval(() => {
        if (!state.lastUpdated) return;
        const ago = Math.max(0, Math.round((Date.now() - state.lastUpdated) / 1000));
        statusUpdatedEl.textContent = 'Updated ' + (ago < 60 ? ago + 's ago' : Math.round(ago / 60) + 'm ago');
        const left = Math.max(0, Math.round((state.nextFetchAt - Date.now()) / 1000));
        statusCountdownEl.textContent = left + 's';
    }, 1000);

    /* ---------------------------------------------------------------- */
    /* 9. Controls                                                     */
    /* ---------------------------------------------------------------- */
    const applyMagLabel = () => {
        magValueEl.textContent = state.minMag <= 0 ? 'All' : state.minMag.toFixed(1) + '+';
    };

    magSliderEl.value = state.minMag;
    applyMagLabel();
    magSliderEl.addEventListener('input', () => {
        state.minMag = parseFloat(magSliderEl.value);
        applyMagLabel();
        render();
        savePrefs();
    });

    searchEl.addEventListener('input', render);

    if (prefs.sort) sortEl.value = prefs.sort;
    sortEl.addEventListener('change', () => {
        if (sortEl.value === 'distance' && !state.userLoc) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => { state.userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; render(); },
                    () => { sortEl.value = 'time'; render(); alert('Location unavailable - sorting by most recent instead.'); }
                );
            } else { sortEl.value = 'time'; alert('Geolocation not supported - sorting by most recent.'); }
        }
        render();
        savePrefs();
    });

    document.querySelectorAll('.seg-btn').forEach(btn => {
        if (btn.dataset.range === state.range) {
            document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            if (btn.dataset.range === state.range) return;
            document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.range = btn.dataset.range;
            state.knownIds = null;
            quakeListEl.innerHTML = '<div class="p-4 text-gray-500 text-sm text-center">Loading...</div>';
            savePrefs();
            fetchEarthquakes();
        });
    });

    platesToggle.checked = prefs.plates !== undefined ? prefs.plates : true;
    platesToggle.addEventListener('change', (e) => {
        if (e.target.checked) { if (platesLoaded) map.addLayer(platesLayer); }
        else map.removeLayer(platesLayer);
        savePrefs();
    });

    refreshBtn.addEventListener('click', () => { fetchEarthquakes(); });

    sidebarHandle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    const modal = $('info-modal');
    const modalContent = $('modal-content');
    const openModal = () => {
        modal.classList.remove('hidden');
        setTimeout(() => { modalContent.classList.remove('scale-95', 'opacity-0'); modalContent.classList.add('scale-100', 'opacity-100'); }, 10);
    };
    const closeModal = () => {
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    };
    $('info-btn').addEventListener('click', openModal);
    $('close-modal-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); drawer.classList.remove('open'); }
    });

    /* ---------------------------------------------------------------- */
    /* 10. Lifecycle                                                   */
    /* ---------------------------------------------------------------- */
    fetchTectonicPlates();
    fetchEarthquakes();
});
