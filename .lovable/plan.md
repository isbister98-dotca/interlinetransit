

## Search Bar and Dynamic Bottom Sheet

### Overview
Add a brand-guide-styled search bar to the map screen with autocomplete results for places, routes, and stations via OSM APIs. The bottom sheet becomes a dynamic context panel that changes content based on what's selected (search result, vehicle tap, or default nearby stops).

### Search Bar Design
Matches the uploaded screenshot exactly:
- Dark card background (`#1B1D19`), 1px border (`rgba(255,255,255,0.12)`), rounded-lg
- Search icon (magnifying glass) on the left in muted color
- X clear button on right when text is present
- IBM Plex Sans placeholder text
- Positioned at top of map, full width with padding
- Dropdown results appear below with location pin icon + name + subtitle

### Architecture

**New state machine for the bottom sheet context:**
```text
"nearby"   --> default: shows nearby departures (current behavior)
"place"    --> searched place: address, distance, "Route To" button
"route"    --> searched route: route line on map, stops, active vehicles, avg speed, occupancy
"station"  --> searched station: upcoming departures, alerts for that station
"vehicle"  --> tapped vehicle marker: speed, direction, occupancy, position on route, on-time status
```

### Changes

#### 1. New component: `src/components/map/SearchBar.tsx`
- Controlled input with debounced OSM Nominatim search (forward geocoding)
- Searches 3 categories simultaneously:
  - **Places**: `https://nominatim.openstreetmap.org/search?q={query}&format=jsonv2&addressdetails=1&limit=5&viewbox=-80.2,44.2,-78.5,43.2&bounded=1`
  - **Stations**: Same API but filtered for results with `type=station` or `class=railway`/`class=public_transport`
  - **Routes**: Match against the live vehicles list by `routeId` or `routeLabel` (local filter, no API call)
- Results grouped by category with icons (pin for places, train for stations, route chip for routes)
- On focus: emit callback to collapse bottom sheet
- On select: emit result type + data, clear search

#### 2. New component: `src/components/map/SheetPlaceDetail.tsx`
- Shows place name, full address, distance/duration
- "Route To" button triggers OSRM directions (reuses existing `handleGetDirections` logic)
- Destination marker placed on map

#### 3. New component: `src/components/map/SheetRouteDetail.tsx`
- Shows route name, agency chip, active vehicle count
- Stats row: avg speed, occupancy level
- List of stops along the route (fetched from GTFS data or approximated from vehicle positions)
- Map actions: draw route polyline, show stop markers, highlight active vehicles

#### 4. New component: `src/components/map/SheetStationDetail.tsx`
- Shows station name, agencies serving it
- Upcoming departures list (filtered from MOCK_DEPARTURES or live data)
- Active alerts affecting this station (filtered from MOCK_ALERTS)

#### 5. New component: `src/components/map/SheetVehicleDetail.tsx`
- Animated slide-in when a vehicle marker is tapped
- Shows: route label, agency chip, current speed, bearing/direction, destination/endpoint
- Occupancy bar, on-time status pill
- Position indicator (simple progress bar showing where on the route the vehicle is)
- "Track" button to follow the vehicle on map

#### 6. Updated: `src/pages/MapScreen.tsx`
- Add `SearchBar` component at top, positioned above Layers button
- Move Layers button to right side to make room for search bar
- Add `sheetMode` state: `"nearby" | "place" | "route" | "station" | "vehicle" | "hidden"`
- When search bar is focused: `sheetMode = "hidden"` (collapse sheet to 0 height with animation)
- When search result selected: set appropriate `sheetMode` + data, expand sheet
- Vehicle marker click handler: instead of Leaflet popup, set `sheetMode = "vehicle"` with vehicle data, animate sheet up
- Remove Leaflet popup binding from vehicle markers, replace with click-to-select behavior
- Bottom sheet renders different content based on `sheetMode`
- Route search: use Overpass API to fetch route geometry and stops for the selected route

#### 7. New utility: `src/lib/osm-api.ts`
- `searchPlaces(query)` -- Nominatim forward geocoding with GTA bounding box
- `fetchStationDepartures(stationName)` -- placeholder that filters mock data by station
- `fetchRouteGeometry(routeRef)` -- Overpass API query for route relation geometry:
  ```
  [out:json];relation["type"="route"]["route"~"train|subway|tram|bus"]["ref"="{routeRef}"](43.2,-80.2,44.2,-78.5);out geom;
  ```
- `fetchStationsByName(query)` -- Nominatim search filtered to `public_transport=station` or `railway=station` tags

#### 8. CSS additions in `src/index.css`
- Search bar focus glow using `--brand-border` color
- Sheet transition for hiding/showing (slide down to 0, slide up on result)
- Vehicle detail card entrance animation

### Technical Notes

**OSM Tags for Stations:**
- `public_transport=station`
- `railway=station`
- `railway=halt`
- These are correct OSM tags for transit stations

**Search debounce:** 300ms to avoid hammering Nominatim (their usage policy requires max 1 req/sec)

**Route geometry via Overpass API:**
```
https://overpass-api.de/api/interpreter?data=[out:json];relation["type"="route"]["ref"="LW"](43.2,-80.2,44.2,-78.5);out geom;
```
This returns the full route geometry including stops as members.

**Vehicle click replaces popup:** Instead of `marker.bindPopup(...)`, use `marker.on("click", ...)` to set the selected vehicle in React state and animate the bottom sheet.

### Files to Create
- `src/components/map/SearchBar.tsx`
- `src/components/map/SheetPlaceDetail.tsx`
- `src/components/map/SheetRouteDetail.tsx`
- `src/components/map/SheetStationDetail.tsx`
- `src/components/map/SheetVehicleDetail.tsx`
- `src/lib/osm-api.ts`

### Files to Modify
- `src/pages/MapScreen.tsx`
- `src/index.css`

