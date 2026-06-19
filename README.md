# SeismicRadar 🌍

**SeismicRadar** is a real-time, global earthquake monitoring dashboard. It visualizes seismic activity across the globe by pulling live data directly from the United States Geological Survey (USGS), rendered on an interactive map with a glassmorphism control console.

Designed as a stateless Single Page Application (SPA), it requires zero backend infrastructure, no build step, and no package manager — ensuring high reliability and edge-deployment capability.

<img width="1913" height="937" alt="image" src="https://github.com/user-attachments/assets/4584c4c2-1417-41bd-a0ae-c5646e9d2c5e" />

## 🏗️ Architecture & Tech Stack

*   **Architecture:** Stateless SPA (single `index.html` + `app.js`)
*   **Earthquake Data:** [USGS GeoJSON Feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — `all_hour.geojson` (Past Hour) and `all_day.geojson` (Past 24 Hours)
*   **Tectonic Plates:** [Fraxen Tectonic Plates](https://github.com/fraxen/tectonicplates) (`PB2002_boundaries.json`)
*   **Mapping Engine:** Leaflet.js 1.9.4
*   **Tile Provider:** CartoDB (Dark Matter theme)
*   **Styling:** Tailwind CSS (CDN) + custom glassmorphism CSS
*   **Application Logic:** Vanilla ES6 JavaScript
*   **Hosting:** Vercel Ready (`vercel.json` included for SPA routing and edge caching)

## 🚀 Features

### Live data
*   **Auto-refresh:** Polls the active USGS feed every 60 seconds, with a live "updated / next refresh" countdown and a manual refresh button.
*   **Time range:** Switch between **Past Hour** and **Past 24 Hours** feeds. (See `WEEK_DATA_PLAN.md` for the planned weekly view.)
*   **NEW event flagging:** Quakes that appear since the last poll briefly flash and carry a `NEW` badge.

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
*   **Geolocation:** Used only if you choose "Nearest" sort; the coordinate stays in memory and is never transmitted or stored.
*   **CORS:** USGS feeds are publicly accessible and CORS-enabled — no proxy backend required.
*   **Dependencies:** Leaflet JS/CSS is loaded via CDN with Subresource Integrity (SRI) hashes; Tailwind is loaded via its official CDN.

---
*Architected and built for high performance and situational awareness.*
