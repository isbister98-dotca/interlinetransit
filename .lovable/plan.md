

# Integrate Real-Time Vehicle Positions from Transit Tracker API

## Overview

Replace the hardcoded mock vehicle data with live vehicle positions from the **Transit Tracker API** (`api.transittracker.ca`), which aggregates GTFS-RT feeds for GO Transit, UP Express, TTC, and MiWay into a single, free, unauthenticated JSON API.

## Data Source

The Transit Tracker API provides vehicle positions for all four agencies via:
- `GET /v2/agencies/go/vehicles?geojson=0` (GO Transit)
- `GET /v2/agencies/up/vehicles?geojson=0` (UP Express)
- `GET /v2/agencies/ttc/vehicles?geojson=0` (TTC)
- `GET /v2/agencies/miway/vehicles?geojson=0` (MiWay)

Each vehicle in the response includes:
- `id`, `label`, `routeId`
- `position: { lat, lon }`
- `bearing`, `speed`
- `occupancyStatus: { data, label }`
- `agency` (slug string like "go", "ttc", etc.)

No API key is required. The `?geojson=0` parameter keeps the response smaller by omitting the GeoJSON FeatureCollection.

## Changes

### 1. Vite Proxy (`vite.config.ts`)
Add a proxy rule to forward `/api/transit/` requests to `https://api.transittracker.ca/v2/` to avoid CORS issues during development.

### 2. New Hook: `src/hooks/use-vehicles.ts`
Create a custom SWR hook (`useVehicles`) that:
- Fetches all four agency endpoints in parallel using `Promise.all`
- Maps the API response to the existing `Vehicle` type (converting `position.lat`/`position.lon` to flat `lat`/`lng`, mapping agency slugs like `"go"` to `"GO"`, mapping occupancy status codes to our enum)
- Auto-refreshes every 15 seconds via SWR's `refreshInterval`
- Falls back to mock data if all API calls fail
- Exposes `vehicles`, `isLoading`, and `error` state

### 3. New API Helper: `src/lib/transit-api.ts`
- Define the Transit Tracker API response types
- Create a `fetchAgencyVehicles(slug)` function that calls the proxy endpoint
- Map agency slugs (`"go"` -> `"GO"`, `"up"` -> `"UP"`, `"ttc"` -> `"TTC"`, `"miway"` -> `"MiWay"`)
- Map occupancy status numbers to our `"LOW" | "MEDIUM" | "HIGH" | "FULL"` enum

### 4. Update `MapScreen.tsx`
- Replace `MOCK_VEHICLES` import with the `useVehicles()` hook
- Add a `useEffect` that clears and re-populates the vehicle `L.layerGroup` whenever the `vehicles` array changes
- Show a loading indicator while data is being fetched
- Keep mock departures in the bottom sheet for now (departures are a separate API concern)

### 5. Production CORS Handling
Since Vite proxy only works in dev, add a runtime check: if the proxy path fails (production), fall back to calling the API directly (Transit Tracker API already sets CORS headers `vary: Origin`). If CORS is blocked in production, gracefully fall back to mock data.

## What Stays the Same
- All other screens (Journey, Alerts, Social, Profile) -- untouched
- Bottom sheet departures -- still mock data (separate feature)
- Map initialization, tiles, user marker -- untouched
- Vehicle marker styling (agency-colored `divIcon`) -- untouched, just fed real data
- Routing -- untouched

## Technical Details

```text
Data flow:
  useVehicles() hook
    -> SWR fetcher (every 15s)
      -> fetch /api/transit/agencies/go/vehicles?geojson=0  (proxied in dev)
      -> fetch /api/transit/agencies/up/vehicles?geojson=0
      -> fetch /api/transit/agencies/ttc/vehicles?geojson=0
      -> fetch /api/transit/agencies/miway/vehicles?geojson=0
    -> Promise.all -> flatten -> map to Vehicle[]
    -> return { vehicles, isLoading, error }

  MapScreen useEffect([vehicles])
    -> vehicleLayerRef.current.clearLayers()
    -> vehicles.forEach(v => add L.marker with divIcon + popup)
```

## New Files
- `src/lib/transit-api.ts` -- API types, fetcher, mapper
- `src/hooks/use-vehicles.ts` -- SWR hook

## Modified Files
- `vite.config.ts` -- add proxy config
- `src/pages/MapScreen.tsx` -- use live data instead of mock

