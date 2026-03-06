

## Plan: Make `/map` the home route at `/`

The simplest approach: change the `MapScreen` route from `/map` to `/` and update all references.

### Changes

1. **`src/App.tsx`** — Change `<Route path="/map" ...>` to `<Route path="/" ...>`

2. **`src/lib/types.ts`** — Update the Map tab's `path` from `"/map"` to `"/"`

3. **`src/components/layout/BottomNav.tsx`** — The map tab active check uses `location.pathname.startsWith(tab.path)`. Since `"/"` would match everything, change the active logic for the `"/"` path to use exact match (`pathname === "/"`) while keeping `startsWith` for other tabs.

That's it — three small edits, no content changes needed.

