

## Plan: Vehicle Click → Isolate Route + Highlight + Zoom

### What changes

**`src/pages/MapScreen.tsx`** — three modifications:

### 1. Vehicle click handler (`handleVehicleClick`, ~line 258)
- After setting vehicle state, **zoom/fly to the clicked vehicle** at zoom 15 (same as `handleTrackVehicle`)
- Store the clicked vehicle's `routeId` and `agency` so `syncMarkers` can filter
- Draw the vehicle's route shape from the already-loaded `shapes` data onto `overlayLayerRef` (not `shapesLayerRef`, so it's independent of layer mode). Match by `agency_id` and `route_id`. Use a brighter opacity (0.7) and slightly thicker weight (3)

### 2. Marker sync (`syncMarkers`, ~line 335)
- Add a check: if `selectedVehicle` is set, only show vehicles matching `selectedVehicle.routeId` AND `selectedVehicle.agency`
- Highlight the clicked vehicle with a distinct icon — add a glowing ring/border to its marker via a `createHighlightedVehicleIcon` variant (white outer glow or thicker border)

### 3. Reset behavior (`resetSheet`, ~line 197)
- Already clears overlays and nulls `selectedVehicle` — no change needed. The `syncMarkers` effect already re-runs when `selectedVehicle` changes, so all vehicles reappear on back/reset.

### 4. Wire reactivity
- Add `selectedVehicle` to the `useEffect` deps that calls `syncMarkers` (~line 411) so filtering kicks in immediately on vehicle select/deselect
- Store `selectedVehicle` in a ref (`selectedVehicleRef`) for access inside `syncMarkers` (same pattern as `selectedRouteRef`)

### New helper function
- `createHighlightedVehicleIcon(vehicle)` — same as `createVehicleIcon` but with a white/green glow ring (`box-shadow: 0 0 0 3px hsl(93,50%,56%), 0 2px 8px rgba(0,0,0,0.5)`)

### Files
| File | Action |
|------|--------|
| `src/pages/MapScreen.tsx` | Modify — vehicle click filtering, highlighting, route shape overlay, zoom |

