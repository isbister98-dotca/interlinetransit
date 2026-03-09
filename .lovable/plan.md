

## Fix: Make All Days Expandable + Remove Legacy Fallback + Clean Up Stale Data

### Problem
The `hasHours` flag gates both the click handler (line 228) and the chevron (line 232), so days without hour-based status entries can't be expanded. The collapsing logic also groups consecutive hours with the same status into ranges (e.g. "h1-h6"), which is confusing — each hour should be its own row.

### Changes

**1. `src/pages/AdminGtfsScreen.tsx`**

- **Remove legacy fallback** (lines 142-151): Delete the `legacyDayStatuses` variable and the fallback branch in `dayAggregates`. Days with no hour entries show as "pending" with 0 rows.
- **Always allow day expansion** (line 228): Remove `agg.hasHours &&` from `onClick` handler.
- **Always show chevron** (line 232): Remove `agg.hasHours &&` condition — always render the chevron arrow.
- **Remove `collapseHourRanges`** (lines 88-110): Delete entirely. Replace with a simple flat list of all 28 hours (h0-h27), each as its own row — no collapsing.
- **Update hour rendering** (lines 263-303): Instead of iterating `hourRanges`, iterate `HOURS` (0-27) directly, rendering one row per hour with its status (from `dayHourMap[d][h]` or "pending" if null).
- **Remove `hasHours` from aggregate** (line 152, 160): No longer needed.
- **Update "hours" column** (lines 257-259): Always show `${doneCount}/28 hours` regardless of `hasHours`.

**2. Database cleanup**
- Delete legacy `gtfs_sync_status` rows: `DELETE FROM gtfs_sync_status WHERE file_type ~ '^stop_times_d\d+$'`

