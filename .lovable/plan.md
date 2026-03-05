

## Plan: GTFS Route Shapes on Map + Expanded Layers Control

### Overview
Draw GTFS route shapes from the database onto the map as colored polylines, and replace the single layers toggle button with a 3-option segmented control: **Routes**, **Vehicles**, **Everything**.

### 1. New hook: `src/hooks/use-route-shapes.ts`
Fetches shape geometry from `gtfs_shapes` grouped by `shape_id` and `agency_id`, joined with `gtfs_trips` and `gtfs_routes` to get route metadata (route_id, color). Returns an array of shapes with their coordinates ordered by `shape_pt_sequence`.

Since shapes data can be very large (300k+ rows across agencies), we'll query distinct shape_ids from `gtfs_trips` (one per route+direction), then fetch only those shapes. Data is cached via SWR with a long TTL (shapes rarely change).

Query strategy:
- First query: get distinct `(shape_id, agency_id, route_id)` from `gtfs_trips`
- Second query: fetch `gtfs_shapes` rows for those shape_ids, ordered by sequence
- Group coordinates into polyline arrays per shape_id
- Due to the 1000-row default limit, we'll need to paginate or use `.range()` to fetch all shape points

### 2. New layer group + rendering in `MapScreen.tsx`
- Add a `shapesLayerRef` (L.LayerGroup) alongside the existing `vehicleLayerRef`
- Add a `syncShapes()` function that draws polylines colored by agency (using `AGENCY_COLORS`)
- Polylines will be semi-transparent, thin (weight 2-3), rendered below vehicle markers

### 3. Layers control replacement
Replace the single `<button>` at line 420-429 with a segmented control panel:

```text
┌─────────────────────────────┐
│  Routes │ Vehicles │  All   │
└─────────────────────────────┘
```

- **State**: `layerMode: "routes" | "vehicles" | "everything" | "off"`
- **Routes**: shows shapes only, hides vehicles
- **Vehicles**: shows vehicles only, hides shapes (current default behavior)
- **Everything**: shows both; clicking again when active sets mode to `"off"` (hides all), click again re-enables
- Visual: a single `bg-card border` container with 3 buttons, active state highlighted with `bg-primary text-primary-foreground`

### 4. Performance considerations
- Shapes are drawn once and cached in the layer group; toggling just shows/hides the layer
- Use `simplify` option on Leaflet polylines or limit shape detail at lower zooms if needed
- Fetch shapes data only once on mount (SWR with `revalidateOnFocus: false`)

### Files to create/modify
| File | Action |
|------|--------|
| `src/hooks/use-route-shapes.ts` | **Create** — SWR hook to fetch and group shape data |
| `src/pages/MapScreen.tsx` | **Modify** — add shapes layer, replace layers button with 3-segment control, wire layer visibility |

