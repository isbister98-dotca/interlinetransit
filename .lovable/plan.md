

# Integrate Real-Time Vehicle Positions from Your API Feeds

## Overview

Replace mock vehicle data with live positions from your own API sources:
- **GO Transit + UP Express** -- Metrolinx OpenData API (JSON)
- **TTC** -- GTFS-RT protobuf feed
- **MiWay** -- GTFS-RT protobuf feed

## Data Sources

| Agency | Endpoint | Format | Auth |
|--------|----------|--------|------|
| GO Transit | `api.openmetrolinx.com/OpenDataAPI/api/V1/Gtfs/Feed/VehiclePosition` | JSON | API key `30026966` as query param |
| UP Express | `api.openmetrolinx.com/OpenDataAPI/api/V1/UP/Gtfs/Feed/VehiclePosition` | JSON | Same API key |
| TTC | `bustime.ttc.ca/gtfsrt/vehicles` | Protobuf | None |
| MiWay | `miapp.ca/GTFS_RT/Vehicle/VehiclePositions.pb` | Protobuf | None |

The Metrolinx API key is a free, public-registration key -- safe to store in the codebase.

## Changes

### 1. Install `gtfs-rt-bindings` (new dependency)
Required to decode the binary protobuf feeds from TTC and MiWay in the browser. This package provides pre-compiled GTFS-RT protocol buffer bindings.

### 2. Vite Proxy (`vite.config.ts`)
Add proxy rules for all three API origins to avoid CORS during development:

```text
/api/metrolinx/  ->  https://api.openmetrolinx.com/OpenDataAPI/
/api/ttc/        ->  https://bustime.ttc.ca/
/api/miway/      ->  https://www.miapp.ca/
```

### 3. New file: `src/lib/transit-api.ts`
API helper with three fetcher functions:
- `fetchMetrolinxVehicles(path)` -- fetches GO or UP JSON endpoint, appends `?key=30026966`, parses standard GTFS-RT JSON (`entity[].vehicle.position.latitude/longitude`, `vehicle.vehicle.id`, `vehicle.trip.route_id`)
- `fetchProtobufVehicles(url)` -- fetches TTC or MiWay binary feed, decodes using `gtfs-rt-bindings` `FeedMessage.decode()`, extracts vehicle positions
- `fetchAllVehicles()` -- calls all four endpoints in parallel via `Promise.all`, maps each to the app's `Vehicle` type, assigns correct `agency` tag ("GO", "UP", "TTC", "MiWay"), falls back to mock data on failure

Mapping logic:
- `entity[].vehicle.position.latitude` / `longitude` to flat `lat` / `lng`
- `entity[].vehicle.vehicle.id` to `id`
- `entity[].vehicle.trip.route_id` to `routeId`
- `entity[].vehicle.position.bearing` to `bearing`
- `entity[].vehicle.position.speed` to `speed`
- Occupancy status mapped to `"LOW" | "MEDIUM" | "HIGH" | "FULL"` enum when available

### 4. New file: `src/hooks/use-vehicles.ts`
SWR-based hook:
- Key: `"vehicles"`
- Fetcher: calls `fetchAllVehicles()`
- `refreshInterval: 15000` (15-second auto-refresh)
- Returns `{ vehicles: Vehicle[], isLoading, error }`
- Falls back to `MOCK_VEHICLES` if all API calls fail

### 5. Update `src/pages/MapScreen.tsx`
- Replace `MOCK_VEHICLES` with `useVehicles()` hook
- Separate map initialization (runs once) from vehicle rendering
- Add a new `useEffect` watching the `vehicles` array that clears `vehicleLayerRef` and re-populates markers
- Show a subtle loading shimmer on first load
- Keep bottom sheet departures as mock data (separate concern)

### 6. Production CORS handling
In `transit-api.ts`, try the proxy path first. If it fails (e.g., in production where Vite proxy is unavailable), retry with the direct API URL. The Metrolinx API sets CORS headers; TTC and MiWay may not, so gracefully fall back to mock data for any agency that fails.

## What Stays the Same
- All other screens (Journey, Alerts, Social, Profile)
- Bottom sheet departures (still mock)
- Map tiles, user location marker, dark theme
- Vehicle marker styling (agency-colored chips)
- Routing and navigation

## New Files
- `src/lib/transit-api.ts` -- API types, fetchers, protobuf decoder, mapper
- `src/hooks/use-vehicles.ts` -- SWR hook

## Modified Files
- `vite.config.ts` -- proxy config for 3 API origins
- `src/pages/MapScreen.tsx` -- use live data, separate init from vehicle rendering
- `package.json` -- add `gtfs-rt-bindings` dependency

## Technical Details

```text
Data flow:

  useVehicles() hook (SWR, 15s refresh)
    -> fetchAllVehicles()
      -> Promise.all([
           fetchMetrolinxVehicles("api/V1/Gtfs/Feed/VehiclePosition"),      // GO
           fetchMetrolinxVehicles("api/V1/UP/Gtfs/Feed/VehiclePosition"),    // UP
           fetchProtobufVehicles("/api/ttc/gtfsrt/vehicles"),                // TTC
           fetchProtobufVehicles("/api/miway/GTFS_RT/Vehicle/VehiclePositions.pb") // MiWay
         ])
      -> flatten + map to Vehicle[]
    -> { vehicles, isLoading, error }

  MapScreen useEffect([vehicles])
    -> vehicleLayerRef.clearLayers()
    -> vehicles.forEach(v => L.marker + popup)
```

