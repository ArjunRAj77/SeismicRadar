# SeismicRadar 🌍

**SeismicRadar** is a real-time, global earthquake monitoring dashboard. It visualizes seismic activity across the globe by pulling live data directly from the United States Geological Survey (USGS).

Designed as a stateless Single Page Application (SPA), it requires zero backend infrastructure, ensuring high reliability and edge-deployment capability.

<img width="1913" height="937" alt="image" src="https://github.com/user-attachments/assets/4584c4c2-1417-41bd-a0ae-c5646e9d2c5e" />

## 🏗️ Architecture & Tech Stack

*   **Architecture:** Stateless SPA
*   **Data Source:** [USGS GeoJSON Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) (`all_day.geojson`)
*   **Mapping Engine:** Leaflet.js
*   **Tile Provider:** CartoDB (Dark Matter theme)
*   **Styling:** Tailwind CSS (CDN injection for rapid deployment)
*   **Application Logic:** Vanilla ES6 JavaScript

## 🚀 Features

*   **Real-Time Data:** Automatically polls the USGS API every 60 seconds.
*   **Interactive Cartography:** Fly-to navigation upon clicking events in the feed.
*   **Severity Color-Coding:** 
    *   🔴 **Red:** Magnitude 5.0+ (Significant)
    *   🟠 **Orange:** Magnitude 3.0 - 4.9 (Moderate)
    *   🟡 **Yellow:** Magnitude < 3.0 (Minor)
*   **Responsive Design:** Fully fluid layout that splits into a bottom-sheet feed on mobile and a side-panel feed on desktop.
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
