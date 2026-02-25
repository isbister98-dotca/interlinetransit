

## Fix: Vehicles Incorrectly Labeled as "Stopped"

### Problem
The map popup uses `v.speed ? v.speed + ' km/h' : 'Stopped'` to display vehicle speed. In JavaScript, `0` is falsy, so vehicles with a reported speed of 0 km/h (e.g., at a red light or station) are shown as "Stopped" -- same as vehicles where speed data is simply unavailable (`undefined`).

### Solution
Change the condition to explicitly check for `undefined`/`null` instead of relying on truthiness.

### Changes

**`src/pages/MapScreen.tsx`** (line 86)
- Replace: `v.speed ? v.speed + ' km/h' : 'Stopped'`
- With: `v.speed != null ? v.speed + ' km/h' : ''`

This way:
- Speed = `72` shows "72 km/h"
- Speed = `0` shows "0 km/h" (legitimate -- vehicle is momentarily stationary)
- Speed = `undefined` (no data from feed) shows nothing instead of the misleading "Stopped" label

