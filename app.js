/**
 * SeismicRadar | Global Earthquake Monitor
 * Fetches real-time GeoJSON data from USGS and renders it on a Leaflet map.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const mapEl = document.getElementById('map');

    const map = L.map('map', {
        zoomControl: false,
        zoomSnap: 0,
        zoomDelta: 0.5,
        maxBoundsViscosity: 1.0
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 10,
        noWrap: true
    }).addTo(map);

    const fitMapToScreen = () => {
        const width = mapEl.offsetWidth;
        const height = mapEl.offsetHeight;
        
        const zoomX = Math.log2(width / 256);
        const zoomY = Math.log2(height / 256);
        const requiredZoom = Math.max(zoomX, zoomY);

        map.setMinZoom(0);
        map.setView([20, 0], requiredZoom);
        map.setMinZoom(requiredZoom);
        map.setMaxBounds([[-90, -180], [90, 180]]);
    };

    fitMapToScreen();

    window.addEventListener('resize', () => {
        map.invalidateSize();
        fitMapToScreen();
    });

    // 2. State & DOM Elements
    const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
    const quakeListEl = document.getElementById('quake-list');
    const quakeCountEl = document.getElementById('quake-count');
    const magFilterEl = document.getElementById('mag-filter');
    const searchFilterEl = document.getElementById('search-filter');
    
    // Modal Elements
    const infoBtn = document.getElementById('info-btn');
    const modal = document.getElementById('info-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    let markersLayer = L.layerGroup().addTo(map);
    let currentFeatures = [];

    // 3. Helper Functions
    const getColor = (magnitude) => {
        if (magnitude >= 5) return '#ef4444';
        if (magnitude >= 3) return '#f97316';
        return '#facc15';
    };

    const getRadius = (magnitude) => Math.max(magnitude * 3, 4);

    const getRelativeTime = (timestamp) => {
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        const minutesDifference = Math.round((timestamp - Date.now()) / (1000 * 60));
        const hoursDifference = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));

        if (Math.abs(minutesDifference) < 60) return rtf.format(minutesDifference, 'minute');
        return rtf.format(hoursDifference, 'hour');
    };

    window.flyToQuake = (lat, lng, zoom = 6) => {
        map.flyTo([lat, lng], zoom, { duration: 1.5, easeLinearity: 0.25 });
    };

    // Modal Logic
    const openModal = () => {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('scale-100', 'opacity-100');
        }, 10);
    };

    const closeModal = () => {
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200); 
    };

    infoBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(); 
    });

    // 4. Rendering & Filtering
    const renderEarthquakes = () => {
        const minMag = parseFloat(magFilterEl.value);
        const searchTerm = searchFilterEl.value.toLowerCase().trim();

        const filteredFeatures = currentFeatures.filter(feature => {
            const mag = feature.properties.mag || 0;
            const place = (feature.properties.place || "").toLowerCase();
            return (mag >= minMag) && (searchTerm === "" || place.includes(searchTerm));
        });

        quakeCountEl.textContent = `${filteredFeatures.length} quakes`;
        markersLayer.clearLayers();
        quakeListEl.innerHTML = '';

        if (filteredFeatures.length === 0) {
            quakeListEl.innerHTML = `<div class="p-4 text-gray-500 text-sm text-center">No earthquakes match your filters.</div>`;
            return;
        }

        filteredFeatures.forEach(feature => {
            const [lng, lat] = feature.geometry.coordinates;
            const props = feature.properties;
            const mag = props.mag !== null ? props.mag.toFixed(1) : 'N/A';
            const color = getColor(props.mag);
            const isHighMag = props.mag >= 5.0;
            const radius = getRadius(props.mag);

            const marker = L.circleMarker([lat, lng], {
                radius: radius,
                fillColor: color,
                color: color,
                weight: isHighMag ? 2 : 1,
                opacity: 0.8,
                fillOpacity: isHighMag ? 0.6 : 0.4
            });

            // Offset the popup dynamically based on the radius of the circle
            // so it hovers perfectly right above the circle marker instead of covering it.
            marker.bindPopup(`
                <div class="font-sans text-gray-100">
                    <strong class="block text-lg mb-1" style="color: ${color}">Magnitude ${mag}</strong>
                    <span class="block text-sm mb-2">${props.place}</span>
                    <span class="text-xs text-gray-400">${new Date(props.time).toLocaleString()}</span>
                </div>
            `, {
                offset: [0, -radius] // Dynamic offset
            });

            markersLayer.addLayer(marker);

            const item = document.createElement('div');
            item.className = 'group p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-800 border border-transparent hover:border-gray-700 flex items-center gap-4';
            item.onclick = () => {
                flyToQuake(lat, lng);
                marker.openPopup();
            };

            item.innerHTML = `
                <div class="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-base border-2 shadow-lg transition-transform group-hover:scale-110" 
                     style="border-color: ${color}; color: ${color}; background: rgba(0,0,0,0.3)">
                    ${mag}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-200 truncate" title="${props.place}">
                        ${props.place}
                    </p>
                    <p class="text-xs text-gray-400 mt-1">
                        ${getRelativeTime(props.time)}
                    </p>
                </div>
            `;
            quakeListEl.appendChild(item);
        });
    };

    const fetchEarthquakes = async () => {
        try {
            const response = await fetch(USGS_URL);
            if (!response.ok) throw new Error('Failed to fetch USGS data');
            
            const data = await response.json();
            currentFeatures = data.features;
            
            renderEarthquakes();
        } catch (error) {
            console.error("Error fetching earthquakes:", error);
            quakeListEl.innerHTML = `<div class="p-4 text-red-400 text-sm">Failed to load earthquake data. Retrying...</div>`;
        }
    };

    // 5. Event Listeners for Filters
    magFilterEl.addEventListener('change', renderEarthquakes);
    searchFilterEl.addEventListener('input', renderEarthquakes);

    // 6. Lifecycle
    fetchEarthquakes();
    setInterval(fetchEarthquakes, 60000); // 1-minute auto-refresh
});