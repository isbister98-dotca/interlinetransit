

# Interline — GTA Real-Time Transit App

## Overview
A dark, data-dense, mobile-first transit tracking app for the Greater Toronto Area. It shows live vehicle positions, departure predictions, and service alerts from GO Transit, UP Express, TTC, and MiWay in a single polished interface. Uses **OpenStreetMap + Leaflet** (via react-leaflet) with dark CartoDB tiles.

Built in **two phases** — core transit features first, then social/profile features.

---

## Phase 1 — Core Transit Experience

### 1. Design System & App Shell
- Implement the full CSS design token system (dark theme, lime green brand, 5-level elevation backgrounds, rgba borders)
- Load DM Sans + DM Mono fonts
- Build the frosted-glass **BottomNav** with 5 tabs (Map, Journey, Alerts, Social, Profile), safe-area aware, max 480px centered
- Set up routing between all 5 screens
- Build reusable UI primitives: **RouteChip**, **StatusPill**, **LivePill**, **OccupancyBar**, **DepartureRow**, **Toast**
- Implement animations: fade-up entrances, live dot pulse, card/button hover effects
- Skeleton shimmer loaders for all loading states

### 2. Live Map Screen (Default Tab)
- Full-bleed OpenStreetMap with dark CartoDB tiles covering the viewport
- Live vehicle markers rendered as colored **RouteChip** components, rotated by bearing
- **Single "Layers" toggle button** in the top-left corner — toggles all transit vehicle markers on or off (all agencies at once, no per-agency filtering)
- "You are here" marker with pulsing brand-colored ring
- Draggable bottom sheet (30% → 70% height) showing:
  - Selected stop name + LivePill
  - Next 3–5 departures as DepartureRow components, auto-refreshing every 15s

### 3. Real-Time Data Integration
- Set up Vite proxy for CORS (GO/UP via Metrolinx API, TTC, MiWay)
- **useVehicles** hook: fetches and merges vehicle positions from all 4 agencies every 15s (JSON for GO/UP, protobuf for TTC/MiWay via gtfs-realtime-bindings)
- **useDepartures** hook: fetches next departures for a selected stop every 30s
- **useAlerts** hook: fetches and merges service alerts from GO + TTC every 60s
- Mock data fallback for development/offline mode

### 4. Journey Planner Screen
- "Plan Journey" header with From/To search inputs and swap button
- Date/time picker row
- "Find Routes" primary action button
- Journey results as cards showing: route chips, duration, departure/arrival times, transfer count
- **JourneyTimeline** component: vertical stop list with gradient line, glowing current-stop indicator

### 5. Alerts & Departures Screen
- "Union Station Departures" section with live departure rows + LivePill
- "Service Alerts" section with merged GO + TTC alerts
- Alert cards styled by severity (red border = disruption, amber = delay, blue = info)
- Affected route chips inline in alert headers
- Empty state: green checkmark + "All services running normally"

---

## Phase 2 — Social & Profile

### 6. Social Hub Screen
- Header with current month + total rider count
- 3-way toggle: Trips | CO₂ | Routes
- Podium layout (2nd, 1st with gold border, 3rd) with avatar initials, names, ranks, scores
- Leaderboard rows 4–10 with bar chart segments
- Highlighted "You" row
- Uses local/mock data for v1

### 7. Profile Screen
- User info header (name, member since date)
- Stats grid: Total Trips, CO₂ Saved, Favourite Line, Streak
- Favourite Routes list
- Settings section: Notifications, Home Stop, Agency Filters, About
- Agency attribution footer (Metrolinx, TTC, MiWay, OpenStreetMap)
- Version number

---

## Technical Notes
- **Map**: react-leaflet with CartoDB dark_all tiles
- **Data fetching**: SWR for caching and auto-refresh
- **Protobuf parsing**: gtfs-realtime-bindings for TTC & MiWay feeds
- **API key**: Metrolinx key stored as `VITE_METROLINX_API_KEY` environment variable
- **Mobile-first**: max-width 480px centered layout, safe-area padding
- **No backend needed** for Phase 1

