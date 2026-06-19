# SeismicRadar 🌍

<<<<<<< HEAD
**SeismicRadar** is a real-time, global earthquake monitoring dashboard. It visualizes seismic activity across the globe by pulling live data directly from the United States Geological Survey (USGS), rendered on an interactive map with a glassmorphism control console.
=======
**SeismicRadar**  is a real-time, global earthquake monitoring dashboard. It visualizes seismic activity across the globe by pulling live data directly from the United States Geological Survey (USGS).
>>>>>>> 680010f787857ae9917fac022f525d9ff2724e31

Designed as a stateless Single Page Application (SPA), it requires zero backend infrastructure, no build step, and no package manager — ensuring high reliability and edge-deployment capability.

🚀 Website Link :  [Seismic Radar](https://seismic-radar.vercel.app/)

<img width="1913" height="937" alt="image" src="https://github.com/user-attachments/assets/4584c4c2-1417-41bd-a0ae-c5646e9d2c5e" />

## 🏗️ Architecture & Tech Stack

*   **Architecture:** Stateless SPA (single `index.html` + `app.js`)
*   **Earthquake Data:** [USGS GeoJSON Feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — `all_hour.geojson` (Past Hour), `all_day.geojson` (Past 24 Hours), and `all_week.geojson` (7-Day Dashboard)
*   **Tectonic Plates:** [Fraxen Tectonic Plates](https://github.com/fraxen/tectonicplates) (`PB2002_boundaries.json`)
*   **Mapping Engine:** Leaflet.js 1.9.4 (+ Leaflet.heat for the dashboard)
*   **Tile Provider:** CartoDB (Dark Matter theme)
*   **Styling:** Tailwind CSS (CDN) + custom glassmorphism CSS
*   **Application Logic:** Vanilla ES6 JavaScript
*   **Hosting:** Vercel Ready (`vercel.json` included for SPA routing and edge caching)

## 🚀 Features

### Live data
*   **Auto-refresh:** Polls the active USGS feed every 60 seconds, with a live "updated / next refresh" countdown and a manual refresh button.
*   **Time range:** Switch between **Past Hour** and **Past 24 Hours** feeds on the live radar.
*   **NEW event flagging:** Quakes that appear since the last poll briefly flash and carry a `NEW` badge.

### 7-Day Dashboard (`week.html`)
A separate, isolated analytics view (linked from the console header) that loads the USGS **Past 7 Days** feed without burdening the live radar:
*   **Density heatmap:** magnitude-weighted heat layer (Leaflet.heat) with the cyan-to-red intensity ramp; M5.0+ events overlaid as discrete markers.
*   **Week in Review:** KPI cards, a 7-day severity timeline, magnitude distribution, biggest events, and most-active regions.
*   **Cross-filtering:** magnitude range, region + location search, day-of-week (each chip labelled with its actual date), Significant / Tsunami / Felt / Quakes-only toggles, and PAGER impact-alert level — every filter recomputes the heatmap and all panels together.

### Map & visualization
*   **🗺️ Tectonic Plate Overlay:** Toggleable PB2002 fault-line overlay (auto-retries if the source is briefly unavailable).
*   **📡 Radar ping:** The most recent event emits an expanding radar ring; magnitude 5.0+ events pulse continuously.
*   **Severity color-coding:** 🔴 5.0+ (Significant) · 🟠 3.0–4.9 (Moderate) · 🟡 < 3.0 (Minor). Marker size scales with magnitude.
*   **Interactive cartography:** Click any feed item or marker to fly to the epicenter.

### Console & filtering
*   **Glassmorphism UI:** Frosted, blurred panels float over a full-bleed map (sidebar, stats, legend, status pill, detail drawer).
*   **Live stats + histogram:** Showing count, largest magnitude, latest event, and a magnitude-distribution histogram.
*   **Filtering:** Minimum-magnitude slider and free-text location search.
*   **Sorting:** By most recent, magnitude, or **nearest** (optional browser geolocation).
*   **Detail drawer:** Per-event depth, felt reports, tsunami flag, and a link to the official USGS event page.
*   **Persisted preferences:** Time range, magnitude, sort, and plate toggle are remembered via `localStorage`.

### Experience
*   **Responsive design:** Floating side panel on desktop; collapsible bottom sheet on mobile. The map refits to any viewport (via `ResizeObserver`) without letterboxing or tile duplication.
*   **Accessibility:** Honors `prefers-reduced-motion` (disables pings/pulses/flashes), with ARIA labels on icon-only controls.
*   **Custom icon:** Original radar-themed SVG favicon.

## 💻 Installation & Usage

No build step or package manager is required.

1.  Navigate to the directory:
    ```bash
    cd G:\AI\SeismicRadar
    ```
2.  Serve the directory using any local HTTP server, e.g.:
    ```bash
    python -m http.server 8000
    ```
    *(Alternatively `npx serve`, VS Code Live Server, or open `index.html` directly — an HTTP server is recommended to avoid file-protocol CORS restrictions.)*
3.  Open `http://localhost:8000`.

## 🛡️ Security & Privacy

*   **No PII collection:** No user tracking and no cookies. The only client-side storage is a single `localStorage` key holding non-personal UI preferences (selected time range, magnitude, sort, plate toggle).
*   **Geolocation:** Used 