

## Plan: Remove redundant "/" route

**Change**: In `src/App.tsx`, remove the `<Route path="/" element={<Navigate to="/map" replace />} />` line and change the `/map` route to handle both `/` and `/map` by making it the index route.

**File: `src/App.tsx`**
- Remove the `Navigate` import (no longer needed)
- Remove the `/` redirect route
- Add `path="/"` as an additional route pointing to `MapScreen`, or simply change `/map` to handle both by keeping `/map` and adding a wildcard catch that redirects unknown routes

Actually, the simplest approach: just replace the `Navigate` redirect route with making `/map` serve as the index. Since `BottomNav` likely links to `/map`, we should keep `/map` working. The cleanest solution:

- Remove the `<Route path="/" ...Navigate... />` line
- Change `<Route path="/map" element={<MapScreen />} />` to `<Route index element={<MapScreen />} />` and add a second route `<Route path="/map" element={<MapScreen />} />` — or just keep the redirect but swap to make `/map` the canonical and `/` simply not exist.

Given the bottom nav links to `/map`, the simplest fix is just removing the `/` redirect route entirely. Users hitting `/` will get the NotFound page, but that's fine since the app entry is `/map`. Or we keep the redirect for UX. Let me check what the user actually wants.

The user said "eliminate the `/` and default to `/map`" — they want `/map` to be the landing page. The current redirect already does this. They likely just want to clean up the redundant route. Simplest: remove the `/` route and the `Navigate` import. If someone hits `/` they'll see NotFound, which is acceptable since the app is a `/map`-first app.

**Changes:**
1. **`src/App.tsx`**: Remove the `Navigate` import and the `<Route path="/" ... />` line.

