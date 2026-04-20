# SeismicRadar 🌍

**SeismicRadar** is a real-time, global earthquake monitoring dashboard. It visualizes seismic activity across the globe by pulling live data directly from the United States Geological Survey (USGS).

Designed as a stateless Single Page Application (SPA), it requires zero backend infrastructure, ensuring high reliability and edge-deployment capability.

<img width="1913" height="937" alt="image" src="https://github.com/user-attachments/assets/4584c4c2-1417-41bd-a0ae-c5646e9d2c5e" />

## 🏗️ Architecture & Tech Stack

*   **Architecture:** Stateless SPA
*   **Data Source 1:** [USGS GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) (`all_day.geojson`)
*   **Data Source 2:** [Fraxen Tectonic Plates](https://github.com/fraxen/tectonicplates) (`PB2002_boundaries.json`)
*   **Mapping Engine:** Leaflet.js
*   **Tile Provider:** CartoDB (Dark Matter theme)
*   **Styling:** Tailwind CSS (CDN injection for rapid deployment)
*   **Application Logic:** Vanilla ES6 JavaScript
*   **Hosting:** Vercel Ready (`vercel.json` included for optimal SPA routing and Edge Caching)

## 🚀 Features

*   **Real-Time Data:** Automatically polls the USGS API every 60 seconds.
*   **🗺️ Tectonic Plate Overlay:** Visualize geological fault lines using open-source PB2002 GeoJSON data. Toggleable via the UI to show exactly how earthquakes align with the earth's plates.
*   **🎛️ Real-Time Filtering:** Instantly filter earthquakes by Minimum Magnitude (e.g., 5.0+ Significant) or by Location (e.g., "Japan", "California").
*   **Interactive Cartography:** Fly-to navigation upon clicking events in the feed.
*   **Severity Color-Coding:** 
    *   🔴 **Red:** Magnitude 5.0+ (Significant)
    *   🟠 **Orange:** Magnitude 3.0 - 4.9 (Moderate)
    *   🟡 **Yellow:** Magnitude < 3.0 (Minor)
*   **Responsive Design:** Fully fluid layout that splits into a bottom-sheet feed on mobile and a side-panel feed on desktop. Maps scale dynamically without letterboxing or tiling duplication.
*   **Time Normalization:** Translates absolute Unix timestamps into human-readable relative time (e.g., "15 minutes ago").

## 💻 Installation & Usage

Because the application is entirely stateless and relies on client-side fetching, no build step or package manager is required.

1.  Navigate to the directory:
    ```bash
    cd G:\AI\SeismicRadar
    ```
2.  Serve the directory using any local HTTP server. For example, using Python:
    ```bash
    python -m http.server 8000
    ```
    *(Alternatively, use `npx serve`, Live Server in VSCode, or simply open `index.html` directly in your browser, though an HTTP server is recommended to prevent strict CORS/file protocol restrictions in some browsers).*

3.  Open your browser to `http://localhost:8000`.

## 🛡️ Security & Privacy

*   **No PII Collection:** The application does not track users or store cookies.
*   **CORS:** The USGS API is publicly accessible and explicitly allows Cross-Origin Resource Sharing. No proxy backend is required.
*   **Dependency Management:** Leaflet JS/CSS and Tailwind are loaded via secure CDNs with Subresource Integrity (SRI) hashes where applicable.

---
*Architected and built for high performance and situational awareness.*
