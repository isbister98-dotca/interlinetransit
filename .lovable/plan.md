

# Fix Blank Map + Add Vehicle Markers + Change Route to /map

## Problem
`react-leaflet` v4 crashes the entire React app with a fatal `render2 is not a function` error in React 18's context system. This blanks the whole page -- not just the map, but the bottom nav and everything else too.

## Solution
Replace `react-leaflet` usage with direct Leaflet calls in `MapScreen.tsx` only. Everything else stays the same.

## Changes

### 1. Update MapScreen.tsx -- use vanilla Leaflet
- Remove all `react-leaflet` imports (`MapContainer`, `TileLayer`, `Marker`, `Popup`)
- Use `useRef` for the map container div and the Leaflet map instance
- Initialize `L.map()` in a `useEffect` on mount, with CartoDB dark tiles
- Add the pulsing "You are here" marker via `L.marker` with divIcon
- Add all mock vehicle markers to an `L.layerGroup` that gets toggled by the Layers button
- Vehicle markers use the same `createVehicleIcon` divIcon styling (agency-colored route chips)
- Clicking a vehicle marker opens a Leaflet popup with route info
- Clean up with `map.remove()` on unmount
- Keep the Layers toggle button and bottom sheet exactly as they are now (plain React, not inside the map)

### 2. Update routing -- change `/` to `/map`
- In `App.tsx`: change `<Route path="/" ...>` to `<Route path="/map" ...>` and add a redirect from `/` to `/map`
- In `BottomNav` / `types.ts`: update the Map tab path from `"/"` to `"/map"`

### 3. Remove react-leaflet dependency
- Remove `react-leaflet` from `package.json` (keep `leaflet` and `@types/leaflet`)

## What stays the same
- All other screens (Journey, Alerts, Social, Profile) -- untouched
- Bottom sheet with departures -- untouched (it's plain React divs, not react-leaflet)
- Layers toggle button -- untouched
- All styling, animations, design tokens -- untouched
- Mock data -- untouched

## Technical Details

The map initialization in `useEffect` will:

```text
useEffect:
  1. Create L.map(containerRef, { center, zoom, zoomControl: false })
  2. Add L.tileLayer(DARK_TILES)
  3. Add user location marker (L.marker with pulsing divIcon)
  4. Create vehicleLayer = L.layerGroup()
  5. Add all MOCK_VEHICLES as L.marker with divIcon + bindPopup
  6. Add vehicleLayer to map
  7. Return cleanup: map.remove()

showLayers toggle:
  - true: map.addLayer(vehicleLayer)
  - false: map.removeLayer(vehicleLayer)
```

This eliminates the React wrapper that causes the crash while keeping the exact same visual result.
