/**
 * SeismicRadar | 7-Day Dashboard
 * Loads the USGS all_week feed once and renders a magnitude-weighted heatmap
 * plus cross-filtered analytics. Isolated from the live radar (index.html).
 */
document.addEventListener('DOMContentLoaded', () => {
    const WEEK_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';
    const PLATES_URL = 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json';
    const DAY_MS = 86400000;
    const $ = (id) => document.getElementById(id);

    /* ---------- Map ---------- */
    const mapEl = $('heatmap');
    const map = L.map('heatmap', {
        zoomControl: false, zoomSnap: 0, zoomDelta: 0.5, maxBoundsViscosity: 1.0, worldCopyJump: false
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 10, noWrap: true
    }).addTo(map);

    const fitMapToScreen = () => {
        const w = mapEl.offsetWidth, h = mapEl.offsetHeight;
        if (!w || !h) return;
        const z = Math.max(0, Math.max(Math.log2(w / 256), Math.log2(h / 256)));
        const keep = map._loaded ? map.getCenter() : L.latLng(20, 0);
        map.setMinZoom(0);
        map.setMaxBounds([[-90, -180], [90, 180]]);
        map.setView(keep, z, { animate: false });
        map.setMinZoom(z);
    };
    fitMapToScreen();
    let rraf;
    const onResize = () => { cancelAnimationFrame(rraf); rraf = requestAnimationFrame(() => { map.invalidateSize({ animate: false }); fitMapToScreen(); }); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(mapEl);

    const canvasRenderer = L.canvas({ padding: 0.5 });
    const markersLayer = L.layerGroup().addTo(map);
    let heatLayer = null;

    /* ---------- Helpers ---------- */
    const getColor = (m) => (m >= 5 ? '#ef4444' : m >= 3 ? '#f97316' : '#facc15');
    const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    const regionOf = (place) => { if (!place) return 'Unknown'; const i = place.lastIndexOf(', '); return i >= 0 ? place.slice(i + 2) : place; };

    /* ---------- State ---------- */
    let allFeatures = [];
    let dayList = [];
    const state = {
        magMin: 0, magMax: 10,
        region: '', search: '',
        days: new Set(),
        sig: false, tsu: false, felt: false, quakesOnly: true,
        alerts: new Set()
    };

    /* ---------- Dynamic controls ---------- */
    const buildDays = () => {
        dayList = [];
        const now = Date.now();
        for (let i = 6; i >= 0; i--) {
            const ts = now - i * DAY_MS;
            const d = new Date(ts);
            dayList.push({
                key: dayKey(ts),
                wd: d.toLocaleDateString('en', { weekday: 'short' }),
                dom: d.getDate(),
                mon: d.toLocaleDateString('en', { month: 'short' })
            });
        }
        state.days = new Set(dayList.map(d => d.key));
        const c = $('days'); c.innerHTML = '';
        dayList.forEach(d => {
            const el = document.createElement('div');
            el.className = 'day-chip active'; el.dataset.day = d.key;
            el.innerHTML = '<div style="font-weight:600;line-height:1.15">' + d.wd + '</div><div style="font-size:9px;opacity:0.75;line-height:1.2">' + d.mon + ' ' + d.dom + '</div>';
            el.onclick = () => {
                if (state.days.has(d.key)) state.days.delete(d.key); else state.days.add(d.key);
                el.classList.toggle('active'); apply();
            };
            c.appendChild(el);
        });
    };

    const ALERTS = [['green', '#22c55e'], ['yellow', '#eab308'], ['orange', '#f97316'], ['red', '#ef4444']];
    const buildAlerts = () => {
        const c = $('alerts'); c.innerHTML = '';
        ALERTS.forEach(([name, col]) => {
            const el = document.createElement('span');
            el.className = 'alert-dot'; el.style.background = col; el.dataset.alert = name; el.title = name + ' alert';
            el.onclick = () => {
                if (state.alerts.has(name)) state.alerts.delete(name); else state.alerts.add(name);
                el.classList.toggle('active'); apply();
            };
            c.appendChild(el);
        });
    };

    const buildRegions = () => {
        const counts = {};
        allFeatures.forEach(f => { const r = regionOf(f.properties.place); counts[r] = (counts[r] || 0) + 1; });
        const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 30);
        const sel = $('region-select');
        sel.innerHTML = '<option value="">All regions</option>' + top.map(r => '<option value="' + r.replace(/"/g, '') + '">' + r + '</option>').join('');
    };

    /* ---------- Filtering ---------- */
    const passes = (f) => {
        const p = f.properties;
        const m = p.mag == null ? 0 : p.mag;
        if (m < state.magMin || m > state.magMax) return false;
        if (state.region && regionOf(p.place) !== state.region) return false;
        if (state.search && !(p.place || '').toLowerCase().includes(state.search)) return false;
        if (state.days.size < 7 && !state.days.has(dayKey(p.time))) return false;
        if (state.sig && !(p.sig >= 600 || m >= 4.5)) return false;
        if (state.tsu && p.tsunami !== 1) return false;
        if (state.felt && !(p.felt > 0)) return false;
        if (state.quakesOnly && p.type !== 'earthquake') return false;
        if (state.alerts.size && (!p.alert || !state.alerts.has(p.alert))) return false;
        return true;
    };

    /* ---------- Renderers ---------- */
    const renderHeat = (fs) => {
        const pts = fs.map(f => {
            const c = f.geometry.coordinates;
            const m = f.properties.mag == null ? 0.1 : Math.max(f.properties.mag, 0.1);
            return [c[1], c[0], Math.min(1, m / 7)];
        });
        if (heatLayer) map.removeLayer(heatLayer);
        if (typeof L.heatLayer !== 'function') return;
        heatLayer = L.heatLayer(pts, {
            radius: 18, blur: 22, maxZoom: 10, minOpacity: 0.25,
            gradient: { 0.2: '#22d3ee', 0.45: '#facc15', 0.7: '#f97316', 1.0: '#ef4444' }
        }).addTo(map);
    };

    const renderMarkers = (fs) => {
        markersLayer.clearLayers();
        fs.filter(f => (f.properties.mag || 0) >= 5).forEach(f => {
            const c = f.geometry.coordinates, p = f.properties;
            const mk = L.circleMarker([c[1], c[0]], {
                renderer: canvasRenderer, radius: Math.max((p.mag - 3) * 2.2, 5),
                color: '#ffffff', weight: 1, fillColor: '#ef4444', fillOpacity: 0.85, opacity: 0.7
            });
            mk.bindPopup('<strong style="color:#ef4444">M ' + p.mag.toFixed(1) + '</strong><br><span style="font-size:12px">' + (p.place || '') + '</span><br><a style="font-size:11px;color:#7dd3fc" href="' + (p.url || '#') + '" target="_blank" rel="noopener">USGS details</a>');
            markersLayer.addLayer(mk);
        });
    };

    const renderKPIs = (fs) => {
        $('kpi-total').textContent = fs.length.toLocaleString();
        const largest = fs.reduce((a, f) => Math.max(a, f.properties.mag || 0), 0);
        $('kpi-largest').textContent = fs.length ? largest.toFixed(1) : '-';
        $('kpi-largest').style.color = getColor(largest);
        $('kpi-major').textContent = fs.filter(f => (f.properties.mag || 0) >= 4.5).length.toLocaleString();
        const nDays = state.days.size || 1;
        $('kpi-avg').textContent = Math.round(fs.length / nDays).toLocaleString();
    };

    const renderTimeline = (fs) => {
        const byDay = {};
        dayList.forEach(d => byDay[d.key] = [0, 0, 0]); // minor, moderate, major
        fs.forEach(f => {
            const k = dayKey(f.properties.time);
            if (!byDay[k]) return;
            const m = f.properties.mag || 0;
            byDay[k][m >= 5 ? 2 : m >= 3 ? 1 : 0]++;
        });
        const peak = Math.max(1, ...dayList.map(d => byDay[d.key].reduce((a, b) => a + b, 0)));
        $('timeline').innerHTML = dayList.map(d => {
            const [mi, mo, ma] = byDay[d.key];
            const tot = mi + mo + ma;
            const hp = (n) => (n / peak) * 100;
            return '<div class="tl-day" title="' + d.wd + ' ' + d.mon + ' ' + d.dom + ': ' + tot + '">' +
                '<div class="tl-seg" style="height:' + hp(ma) + '%;background:#ef4444"></div>' +
                '<div class="tl-seg" style="height:' + hp(mo) + '%;background:#f97316"></div>' +
                '<div class="tl-seg" style="height:' + hp(mi) + '%;background:#facc15"></div>' +
                '</div>';
        }).join('');
        $('timeline-labels').innerHTML = dayList.map(d => '<span style="text-align:center;line-height:1.15">' + d.wd + '<br><span style="opacity:0.6">' + d.dom + '</span></span>').join('');
    };

    const renderHistogram = (fs) => {
        const b = [0, 0, 0, 0, 0, 0, 0, 0];
        fs.forEach(f => { const m = f.properties.mag; if (m == null) return; b[Math.min(7, Math.max(0, Math.floor(m)))]++; });
        const peak = Math.max(1, ...b);
        $('histogram').innerHTML = b.map((c, i) => {
            const col = i >= 5 ? '#ef4444' : i >= 3 ? '#f97316' : '#facc15';
            return '<div class="bar" title="M' + i + '-' + (i + 1) + ': ' + c + '" style="height:' + Math.round((c / peak) * 100) + '%;background:' + col + ';opacity:0.85"></div>';
        }).join('');
    };

    const renderBiggest = (fs) => {
        const top = fs.slice().sort((a, b) => (b.properties.mag || 0) - (a.properties.mag || 0)).slice(0, 5);
        const el = $('biggest');
        if (!top.length) { el.innerHTML = '<div class="text-[11px] text-gray-500 py-1">No events match the filters.</div>'; return; }
        el.innerHTML = '';
        top.forEach(f => {
            const c = f.geometry.coordinates, p = f.properties;
            const col = getColor(p.mag);
            const row = document.createElement('div');
            row.className = 'big-row';
            row.innerHTML =
                '<span style="width:26px;height:26px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:' + col + ';border:2px solid ' + col + ';background:' + col + '1a">' + p.mag.toFixed(1) + '</span>' +
                '<span class="text-[11px] text-gray-200 flex-1 truncate" title="' + (p.place || '') + '">' + (p.place || 'Unknown') + '</span>' +
                '<span class="text-[9px] text-gray-500">' + new Date(p.time).toLocaleDateString('en', { weekday: 'short', day: 'numeric' }) + '</span>';
            row.onclick = () => { map.flyTo([c[1], c[0]], Math.max(4, map.getMinZoom()), { duration: 1.2 }); };
            el.appendChild(row);
        });
    };

    const renderRegions = (fs) => {
        const counts = {};
        fs.forEach(f => { const r = regionOf(f.properties.place); counts[r] = (counts[r] || 0) + 1; });
        const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5);
        const peak = Math.max(1, ...top.map(r => counts[r]));
        const el = $('regions');
        if (!top.length) { el.innerHTML = '<div class="text-[11px] text-gray-500 py-1">-</div>'; return; }
        el.innerHTML = top.map(r =>
            '<div class="flex items-center gap-2">' +
                '<span class="text-[10px] text-gray-300 truncate" style="width:74px" title="' + r + '">' + r + '</span>' +
                '<div class="flex-1 h-1.5 rounded-full" style="background:#0a0e14"><div style="width:' + Math.round((counts[r] / peak) * 100) + '%;height:100%;background:#fb923c;border-radius:9999px"></div></div>' +
                '<span class="text-[9px] text-gray-500 text-right" style="width:38px">' + counts[r].toLocaleString() + '</span>' +
            '</div>'
        ).join('');
    };

    /* ---------- Apply (cross-filter) ---------- */
    const apply = () => {
        const fs = allFeatures.filter(passes);
        $('count-filtered').textContent = fs.length.toLocaleString();
        renderHeat(fs); renderMarkers(fs); renderKPIs(fs);
        renderTimeline(fs); renderHistogram(fs); renderBiggest(fs); renderRegions(fs);
    };

    /* ---------- Magnitude dual range ---------- */
    const magMinEl = $('mag-min'), magMaxEl = $('mag-max'), magFill = $('mag-fill'), magLabel = $('mag-label');
    const syncMag = () => {
        let lo = parseFloat(magMinEl.value), hi = parseFloat(magMaxEl.value);
        if (lo > hi) { const t = lo; lo = hi; hi = t; }
        state.magMin = lo; state.magMax = hi;
        magFill.style.left = (lo / 10 * 100) + '%';
        magFill.style.width = ((hi - lo) / 10 * 100) + '%';
        magLabel.textContent = (lo <= 0 && hi >= 10) ? 'all' : lo.toFixed(1) + ' - ' + hi.toFixed(1);
    };
    magMinEl.addEventListener('input', () => { syncMag(); apply(); });
    magMaxEl.addEventListener('input', () => { syncMag(); apply(); });

    /* ---------- Other controls ---------- */
    $('region-select').addEventListener('change', (e) => { state.region = e.target.value; apply(); });
    $('search').addEventListener('input', (e) => { state.search = e.target.value.toLowerCase().trim(); apply(); });

    const toggle = (id, key, cls) => {
        $(id).addEventListener('click', () => { state[key] = !state[key]; $(id).classList.toggle(cls, state[key]); apply(); });
    };
    toggle('toggle-sig', 'sig', 'on-sig');
    toggle('toggle-tsu', 'tsu', 'on-tsu');
    toggle('toggle-felt', 'felt', 'on-felt');
    toggle('toggle-type', 'quakesOnly', 'on-type');

    $('reset-btn').addEventListener('click', () => {
        state.magMin = 0; state.magMax = 10; magMinEl.value = 0; magMaxEl.value = 10; syncMag();
        state.region = ''; $('region-select').value = '';
        state.search = ''; $('search').value = '';
        state.sig = state.tsu = state.felt = false; state.quakesOnly = true;
        $('toggle-sig').classList.remove('on-sig'); $('toggle-tsu').classList.remove('on-tsu');
        $('toggle-felt').classList.remove('on-felt'); $('toggle-type').classList.add('on-type');
        state.alerts.clear(); document.querySelectorAll('.alert-dot').forEach(d => d.classList.remove('active'));
        state.days = new Set(dayList.map(d => d.key));
        document.querySelectorAll('.day-chip').forEach(d => d.classList.add('active'));
        apply();
    });

    /* ---------- Plates (optional, behind heat) ---------- */
    const fetchPlates = (attempt) => {
        attempt = attempt || 1;
        fetch(PLATES_URL).then(r => { if (!r.ok) throw new Error('plates'); return r.json(); })
            .then(d => { L.geoJSON(d, { style: { color: '#22d3ee', weight: 1, opacity: 0.18, dashArray: '4, 6' }, interactive: false }).addTo(map); })
            .catch(() => { if (attempt < 3) setTimeout(() => fetchPlates(attempt + 1), attempt * 4000); });
    };

    /* ---------- Data ---------- */
    const setUpdated = () => { $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }); };
    const fetchData = () => {
        $('updated').textContent = 'Loading...';
        fetch(WEEK_URL).then(r => { if (!r.ok) throw new Error('week feed'); return r.json(); })
            .then(d => {
                allFeatures = d.features || [];
                $('count-total').textContent = allFeatures.length.toLocaleString();
                buildRegions();
                setUpdated();
                apply();
            })
            .catch(err => { console.error(err); $('updated').textContent = 'Load failed'; $('count-filtered').textContent = '0'; });
    };
    $('refresh-btn').addEventListener('click', fetchData);

    /* ---------- Lifecycle ---------- */
    buildDays();
    buildAlerts();
    syncMag();
    fetchPlates();
    fetchData();
});
