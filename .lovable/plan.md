

## Plan: Uniform Hour-Partitioned Stop Times for All Agencies

### Summary
Apply hour-by-hour partitioning (hours 0-27) to **all agencies uniformly** — no size-based branching. Each invocation processes one agency + one day + one hour. Pagination remains as fallback within an hour. Empty hours get a "done" status with 0 rows (no gaps in the dashboard).

### Changes

**1. `supabase/functions/gtfs-sync-stop-times/index.ts`**
- Add `hour` query param (0-27). When present, filter CSV rows by `parseInt(departure_time.split(":")[0]) === hour`
- Remove `LARGE_TRIP_THRESHOLD` / dynamic `PAGE_SIZE` logic — use a single `PAGE_SIZE = 10000` for all agencies
- Status `file_type` becomes `stop_times_d{dayOffset}_h{hour}` when hour is specified
- On page 0, mark status "running"; when no more rows, mark "done" with row_count (even if 0)
- Empty hours: if no rows matched after streaming, still write `status: "done", row_count: 0` — this ensures every hour has a status entry
- Keep incremental row_count updates, CPU budget guard, batch upsert with retries

**2. `supabase/functions/gtfs-sync-paginated/index.ts`**
- When `file_type=stop_times`, iterate hours 0-27 sequentially for the given day
- For each hour: call stop-times with `hour=H&page=0`; if `hasMore`, paginate within that hour before moving to next
- Add `start_hour` param (default 0) for continuation resume alongside existing `start_page`
- Time budget continuation now fires with `start_hour` + `start_page`

**3. `src/pages/AdminGtfsScreen.tsx`**
- `StopTimesGroup` gets a third drill-down level: Day > Hours
- Parse `stop_times_d{X}_h{Y}` statuses from the database
- Expanding a day row shows hour rows (h0-h27)
- Consecutive hours with same status collapsed into ranges (e.g. "h4-h8 Done 2,340")
- Per-hour retrigger button for error/stale hours
- `syncAllDays` and `retriggerDay` now call the paginated wrapper which handles hours internally
- "Sync All" button calls paginated with `file_type=stop_times&day_offset=X` which iterates all 28 hours
- Empty hours (0 rows, done) shown as subtle/dimmed rows when expanded

### What stays the same
- Calendar/service matching logic (future-date TTC fallback)
- ZIP streaming, CSV parsing, batch upsert
- Cancel All Syncs button
- Cleanup function
- No database migration needed (`file_type` is a text field)

### Performance
Every agency gets the same treatment: 7 days x 28 hours = 196 status entries per agency. Most off-peak hours (0-3, 25-27) will have 0 rows and complete in seconds. Peak hours (7-9, 16-18) may have 5-15k rows, well within a single invocation. Pagination only kicks in if an hour somehow exceeds 10k matched rows.

