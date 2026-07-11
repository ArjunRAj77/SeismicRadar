<div align="center">

# 🌍 SeismicRadar

**Real-time global earthquake monitoring, straight from the USGS**

*A radar console for the restless Earth — every tremor, live on one map.*

Live quakes · tectonic plate overlay · radar pings · 7-day heatmap dashboard · cross-filtered analytics — a stateless SPA with zero backend, zero build step, zero package manager.

`Leaflet 1.9.4` · `Leaflet.heat` · `Tailwind CSS (CDN)` · `Vanilla ES6` · `Vercel`

🚀 **Live:** [seismic-radar.vercel.app](https://seismic-radar.vercel.app/)

</div>

---

<img width="1913" height="937" alt="SeismicRadar live console" src="https://github.com/user-attachments/assets/4584c4c2-1417-41bd-a0ae-c5646e9d2c5e" />

## Table of contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Deploying to Vercel](#deploying-to-vercel)
4. [Architecture](#architecture)
5. [Folder structure](#folder-structure)
6. [Data sources](#data-sources)
7. [Severity model](#severity-model)
8. [Security & privacy](#security--privacy)
9. [UI & accessibility](#ui--accessibility)
10. [Troubleshooting](#troubleshooting)
11. [License & attribution](#license--attribution)

---

## Features

### Live radar

- **Auto-refresh** — polls the active USGS feed every 60 seconds, with a live "updated / next refresh" countdown and a manual refresh button.
- **Time range** — switch between **Past Hour** and **Past 24 Hours** feeds without leaving the console.
- **NEW event flagging** — quakes that appear since the last poll briefly flash and carry a `NEW` badge.
- **📡 Radar ping** — the most recent event emits an expanding radar ring; magnitude 5.0+ events pulse continuously.
- **🗺️ Tectonic plate overlay** — toggleable PB2002 fault-line overlay that auto-retries if the source is briefly unavailable.
- **Interactive cartography** — click any feed item or marker to fly to the epicenter.

### 7-Day Dashboard (`week.html`)

A separate, isolated analytics view (linked from the console header) that loads the USGS **Past 7 Days** feed without burdening the live radar:

- **Density heatmap** — magnitude-weighted heat layer (Leaflet.heat) with a cyan-to-red intensity ramp; M5.0+ events overlaid as discrete markers.
- **Week in Review** — KPI cards, a 7-day severity timeline, magnitude distribution, biggest events, and most-active regions.
- **Cross-filtering** — magnitude range, region + location search, day-of-week (each chip labelled with its actual date), Significant / Tsunami / Felt / Quakes-only toggles, and PAGER impact-alert level — every filter recomputes the heatmap and all panels together.

### Console & filtering

- **Glassmorphism UI** — frosted, blurred panels float over a full-bleed map: sidebar, stats, legend, status pill, detail drawer.
- **Live stats + histogram** — showing count, largest magnitude, latest event, and a magnitude-distribution histogram.
- **Filtering & sorting** — minimum-magnitude slider, free-text location search; sort by most recent, magnitude, or **nearest** (optional browser geolocation).
- **Detail drawer** — per-event depth, felt reports, tsunami flag, and a link to the official USGS event page.
- **Persisted preferences** — time range, magnitude, sort, and plate toggle are remembered via `localStorage`.

### Experience

- **Responsive design** — floating side panel on desktop; collapsible bottom sheet on mobile. The map refits to any viewport (via `ResizeObserver`) without letterboxing or tile duplication.
- **Accessibility** — honors `prefers-reduced-motion` (disables pings, pulses, and flashes), with ARIA labels on icon-only controls.
- **Custom icon** — original radar-themed SVG favicon.

## Quick start

**Prerequisites:** any local HTTP server. No build step, no package manager, no API keys.

```bash
cd SeismicRadar
python -m http.server 8000   # or: npx serve
# → http://localhost:8000
```

*(VS Code Live Server also works, or open `index.html` directly — an HTTP server is recommended to avoid file-protocol CORS restrictions.)*

## Deploying to Vercel

**Option A — CLI:** `npx vercel` from the project root. `vercel.json` is already included; no framework detection needed.

**Option B — Git:** push to GitHub/GitLab and import the repo at [vercel.com/new](https://vercel.com/new). Zero configuration required.

`vercel.json` provides SPA routing (all paths fall through to `index.html` after the filesystem) and edge caching — CSS/JS assets are served `immutable` for a year, while HTML always revalidates so deploys land instantly.

## Architecture

```
Browser (stateless SPA — no backend, no build)
  ├── index.html + app.js     live radar console
  ├── week.html  + week.js    isolated 7-day analytics dashboard
  │
  ├── fetch → USGS GeoJSON feeds (direct, CORS-enabled)
  │     ├── all_hour.geojson   Past Hour        (60 s poll)
  │     ├── all_day.geojson    Past 24 Hours    (60 s poll)
  │     └── all_week.geojson   Past 7 Days      (dashboard load)
  │
  ├── fetch → PB2002_boundaries.json   tectonic plates (with retry)
  └── direct tile stream → CARTO Dark Matter basemap
```

**Design principles**

1. **Stateless by construction.** No server, no database, no session — the entire application state lives in the URL, the current feed response, and one `localStorage` key.
2. **Feeds are the source of truth.** The UI never caches quake data across polls; every refresh re-renders from the latest USGS response, so the map can never show stale events as current.
3. **Isolate the heavy view.** The 7-day heatmap dashboard is a separate page so its larger feed and heat layer never burden the 60-second live radar loop.
4. **Degrade gracefully.** Plate-overlay fetch failures auto-retry; feed failures keep the last-good view with a visible status pill rather than a blank map.

## Folder structure

```
index.html      live radar console — layout, panels, glassmorphism styles
app.js          radar logic: polling, markers, pings, filters, drawer, prefs
week.html       7-day dashboard — heatmap + Week in Review layout
week.js         dashboard logic: heat layer, KPIs, cross-filtering
favicon.svg     original radar-themed favicon
vercel.json     SPA routing + edge cache headers
```

## Data sources

| Layer | Source | Refresh |
|---|---|---|
| Earthquakes (hour / day) | [USGS GeoJSON Feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — `all_hour`, `all_day` | 60 s poll |
| Earthquakes (7-day) | USGS `all_week.geojson` | on dashboard load |
| Tectonic plates | [Fraxen Tectonic Plates](https://github.com/fraxen/tectonicplates) (`PB2002_boundaries.json`) | static |
| Basemap | [CARTO Dark Matter](https://carto.com/basemaps) / © OpenStreetMap | — |

## Severity model

```
🔴  M 5.0+      Significant   (continuous pulse, dashboard marker overlay)
🟠  M 3.0–4.9   Moderate
🟡  M < 3.0     Minor

marker size ∝ magnitude · heatmap weight ∝ magnitude
```

## Security & privacy

- **No PII collection** — no user tracking, no analytics, no cookies. The only client-side storage is a single `localStorage` key holding non-personal UI preferences (time range, magnitude, sort, plate toggle).
- **Geolocation** — used only for the optional "nearest" sort, only after an explicit browser permission prompt; the position never leaves the device and is never stored.
- **No secrets** — zero API keys or environment variables; every data source is free and public.
- **No injection surface** — no backend, no database, no auth, no forms; all upstream data comes from official USGS/CARTO endpoints.
- **Cache hygiene** — static assets are `immutable`; HTML always revalidates (`vercel.json`).

## UI & accessibility

Keyboard-reachable controls · ARIA labels on icon-only buttons · full `prefers-reduced-motion` support (radar pings, pulses, and NEW-event flashes disabled) · severity colours reserved exclusively for magnitude bands · responsive reflow from desktop side panel to mobile bottom sheet.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Map area is blank | CARTO tile host blocked — corporate proxies/adblockers sometimes block basemap tiles. Check DevTools → Console/Network. |
| No quakes on the map | It may be a quiet hour — switch to **Past 24 Hours**, or lower the minimum-magnitude slider. |
| Plate overlay missing | The GitHub raw source was briefly unreachable; the app auto-retries. Toggle the overlay off/on to force a refetch. |
| "Nearest" sort unavailable | Browser geolocation permission was denied — re-enable it for the site, or use another sort. |
| Opening `index.html` directly fails to load data | File-protocol CORS restrictions — serve over HTTP instead (`python -m http.server 8000`). |
| Animations not showing | Your OS has `prefers-reduced-motion` enabled — pings/pulses/flashes are intentionally disabled. |

## License & attribution

Data and basemaps retain their own licenses — keep the map attribution visible (© OpenStreetMap contributors, CARTO, USGS, Fraxen/Hugo Ahlenius PB2002).

> **Disclaimer:** SeismicRadar is a visualization layer. Official earthquake information and warnings come from the USGS and your national geological/civil-protection authorities.

---

<div align="center">Made by <strong>AJ</strong></div>
