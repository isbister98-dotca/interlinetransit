
# Vehicle Display & Detail Improvements

## 1. Zoom-Based Vehicle Filtering (Priority Clustering)

**Problem**: At low zoom levels, 500+ vehicle markers clutter the map and hurt performance.

**Solution**: In `syncMarkers()` within `MapScreen.tsx`, check the current map zoom level and filter vehicles by type priority:

- **Zoom <= 10**: Show only trains (GO, UP) and subway
- **Zoom 11-12**: Add streetcars/trams
- **Zoom >= 13**: Show all vehicles including buses

Listen to the map's `zoomend` event to re-run `syncMarkers()` when zoom changes.

**File**: `src/pages/MapScreen.tsx`
- Add a `zoomRef` that updates on `zoomend`
- Update `syncMarkers` to filter by `vehicle.vehicleType` based on current zoom
- Add `zoomend` listener in map init effect

## 2. Fix Speed Display

**Problem**: Speed shows `0 km/h` when the GTFS-RT feed returns `null`/`undefined` speed (vehicle is moving but speed data isn't reported).

**Solution**: In `SheetVehicleDetail.tsx`, when `vehicle.speed` is `undefined` or `null`, display "N/A" instead of "0 km/h". Only show "0 km/h" when speed is explicitly `0`.

**File**: `src/components/map/SheetVehicleDetail.tsx`
- Change speed display: `vehicle.speed != null ? `${vehicle.speed} km/h` : "N/A"`

## 3. Replace Direction with Destination/End Station

**Problem**: Direction shows compass bearings (N, NE, etc.) which aren't useful to riders.

**Solution**: Use the route geometry stops data. When `routeGeometry` is available, show the last stop name as the destination. Fall back to compass direction when route data isn't loaded yet.

**File**: `src/components/map/SheetVehicleDetail.tsx`
- Replace the compass direction display with the last stop name from `routeGeometry.stops`
- Change label from "Direction" to "Destination"
- Fall back to bearing direction if no stops data

## 4. Show Stops on Swipe-Up (Already Partially Done)

The current implementation already shows stops when `expanded` is true. The plan ensures:
- The stops timeline only renders when `expanded === true` (already the case)
- The swipe-up grab handle toggles `sheetExpanded` (already wired)
- No changes needed here -- this already works as described

## Technical Changes Summary

| File | Change |
|------|--------|
| `src/pages/MapScreen.tsx` | Add zoom-based filtering in `syncMarkers`, add `zoomend` listener |
| `src/components/map/SheetVehicleDetail.tsx` | Fix speed display, replace compass direction with destination stop name |
