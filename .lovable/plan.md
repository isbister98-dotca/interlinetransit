

## Plan: TTC-Safe Reliability Fixes

### Changes

**1. `supabase/functions/gtfs-sync-stop-times/index.ts`**
- Lower `LARGE_TRIP_THRESHOLD` from 50,000 to 25,000 so TTC (39K trips) uses `PAGE_SIZE=10000`
- Add incremental `row_count` update after each batch upsert — update `gtfs_sync_status` with running total while status remains "running"
- No changes to calendar fallback logic or service matching

**2. `src/pages/AdminGtfsScreen.tsx`**
- Fix `totalRows` calculation to exclude `stop_times_cleanup` entries (which track *deleted* rows, not data)
- Show `error_msg` next to 0-row entries so "CPU Time exceeded" or "No active services" is visible
- Add global "Cancel All Syncs" button at top that updates all `running` statuses to `cancelled` in the database without deleting any data

### What stays the same
- The day-of-week fallback for future-dated calendars (TTC) is untouched
- The streaming ZIP parser, CSV parsing, and upsert logic are unchanged
- The paginated wrapper (`gtfs-sync-paginated`) needs no changes

### Safety
All three fixes are backward-compatible. No data is deleted or rewritten. The calendar/service matching that handles TTC's March 15 start date is completely unaffected.

