

# GTFS Schedule Data Integration -- Timeout-Proof Architecture

## Core Strategy: Per-Agency Calls + Batched Inserts

Every edge function processes **one agency at a time** (passed as query param `?agency_id=TTC`). This is the primary timeout protection -- a 68MB stop_times file is only ever processed for one agency per invocation. Cron jobs make separate HTTP calls per agency, staggered in time.

For large files (stop_times, shapes), rows are inserted in batches of 500 to avoid payload limits and keep DB round-trips fast.

---

## 1. Database Schema

### Feed Registry

```text
gtfs_feeds
  id            uuid PK default gen_random_uuid()
  agency_id     text NOT NULL (GO, UP, TTC, MiWay)
  feed_url      text NOT NULL
  is_active     boolean default true
  last_synced   timestamptz
  created_at    timestamptz default now()
```

### 12 GTFS Data Tables

All include `agency_id text NOT NULL` as part of a composite primary key or unique constraint. Data is deleted-and-reinserted per agency on each sync (simpler than row-level diffing for weekly full refreshes).

| Table | Primary Key / Unique | Row Count Estimate |
|---|---|---|
| gtfs_agency | (agency_id, gtfs_agency_id) | ~4 per agency |
| gtfs_calendar | (agency_id, service_id) | ~50 |
| gtfs_calendar_dates | (agency_id, service_id, date) | ~500 |
| gtfs_routes | (agency_id, route_id) | ~200 |
| gtfs_stops | (agency_id, stop_id) | ~5,000 |
| gtfs_trips | (agency_id, trip_id) | ~10,000 |
| gtfs_stop_times | (agency_id, trip_id, stop_sequence) | ~100K (7-day filtered) |
| gtfs_shapes | (agency_id, shape_id, pt_sequence) | ~50,000 |
| gtfs_transfers | (agency_id, from_stop_id, to_stop_id) | ~100 |
| gtfs_fare_attributes | (agency_id, fare_id) | ~20 |
| gtfs_fare_rules | (agency_id, fare_id, origin_id, destination_id) | ~100 |
| gtfs_feed_info | (agency_id) | 1 per agency |

RLS: Public SELECT on all tables. No INSERT/UPDATE/DELETE for anon (service role only via edge functions).

### Sync Status Tracking

```text
gtfs_sync_status
  id          uuid PK
  agency_id   text
  file_type   text (e.g., 'stops', 'stop_times')
  status      text (pending, running, done, error)
  row_count   integer
  error_msg   text
  started_at  timestamptz
  completed_at timestamptz
```

This lets the admin page show live sync progress and diagnose failures.

---

## 2. Edge Functions (8 functions)

Each function:
1. Accepts `?agency_id=XX` query parameter (or processes all active agencies if omitted)
2. Reads the feed URL from `gtfs_feeds`
3. Downloads the zip using `fetch()`
4. Extracts only its target `.txt` file(s) using `fflate` (npm:fflate)
5. Parses CSV line-by-line
6. Deletes existing rows for that agency_id
7. Inserts in batches of 500 rows
8. Updates `gtfs_sync_status`

| Function | Target File(s) | Notes |
|---|---|---|
| `gtfs-sync-agency` | agency.txt, feed_info.txt | Tiny files, combined |
| `gtfs-sync-calendar` | calendar.txt, calendar_dates.txt | Small, combined |
| `gtfs-sync-routes` | routes.txt | Small |
| `gtfs-sync-stops` | stops.txt, stop_amenities.txt | Medium (~5K rows) |
| `gtfs-sync-trips` | trips.txt | Medium (~10K rows) |
| `gtfs-sync-shapes` | shapes.txt | Large -- batch 500 rows |
| `gtfs-sync-transfers` | transfers.txt, fare_attributes.txt, fare_rules.txt | Small, combined |
| `gtfs-sync-stop-times` | stop_times.txt | Large -- special handling below |

### stop_times Special Handling (68MB+ files)

1. Before processing, query `gtfs_calendar` and `gtfs_calendar_dates` from DB to build a Set of active `service_id`s for the next 7 days
2. Query `gtfs_trips` to get the set of `trip_id`s matching those service_ids
3. Download zip, extract `stop_times.txt`
4. Parse line by line -- **skip any row whose trip_id is not in the active set** (this eliminates ~85% of rows)
5. Delete all existing stop_times for that agency
6. Insert matching rows in batches of 500
7. Expected: ~100K rows per agency after filtering (manageable within timeout)

### Shared Pattern (inline in each function)

```text
- CORS headers (standard)
- Download zip: const buf = await fetch(url).then(r => r.arrayBuffer())
- Extract file: fflate.unzipSync(new Uint8Array(buf))['stop_times.txt']
- Parse CSV: TextDecoder, split by \n, split by comma
- Batch insert: loop in chunks of 500, supabase.from(table).insert(batch)
- Error handling: update gtfs_sync_status on success/failure
```

---

## 3. Cron Schedule

Using `pg_cron` + `pg_net` to POST to edge functions. Each agency gets its own staggered call.

### Weekly (Monday 3:00 AM ET = 08:00 UTC)

All files except stop_times. 4 agencies x 7 functions = 28 calls, staggered:

```text
08:00  gtfs-sync-agency     ?agency_id=GO
08:01  gtfs-sync-agency     ?agency_id=UP
08:02  gtfs-sync-agency     ?agency_id=TTC
08:03  gtfs-sync-agency     ?agency_id=MiWay
08:05  gtfs-sync-calendar   ?agency_id=GO
08:06  gtfs-sync-calendar   ?agency_id=UP
...    (2-min stagger per function group, 1-min stagger per agency)
08:30  gtfs-sync-shapes     ?agency_id=MiWay  (last weekly job)
```

### Nightly (3:00 AM ET = 08:00 UTC, every day)

Only stop_times, one agency at a time:

```text
08:00  gtfs-sync-stop-times  ?agency_id=GO
08:03  gtfs-sync-stop-times  ?agency_id=UP
08:06  gtfs-sync-stop-times  ?agency_id=TTC
08:09  gtfs-sync-stop-times  ?agency_id=MiWay
```

3-minute gaps give each agency plenty of time to finish.

---

## 4. Admin Page (`/admin/gtfs`)

### Features:
- Table of all feeds from `gtfs_feeds` (agency_id, URL, active status, last synced)
- Add Feed form: agency_id text input + feed URL input
- Toggle active/inactive per feed
- Delete feed
- "Sync Now" button per feed -- triggers all 8 edge functions sequentially for that agency
- Sync status panel: shows `gtfs_sync_status` rows (which files synced, when, row counts, errors)
- Not in bottom nav -- accessed by typing `/admin/gtfs` directly

### UI:
- Dark theme matching existing app
- Simple card-based layout
- Toast notifications for sync triggers
- Real-time status refresh using polling

---

## 5. Timeout Protection Summary

| Risk | Mitigation |
|---|---|
| Large zip download | Per-agency calls (each zip is 10-25MB) |
| Large CSV parsing | Extract only the target file, not all files |
| stop_times 68MB+ | Filter to 7-day window (~85% reduction), batch insert 500 |
| shapes large | Batch insert 500 rows |
| DB insert overhead | Batches of 500, not row-by-row |
| One agency failure | Separate function calls per agency -- others unaffected |
| Function crash | `gtfs_sync_status` table tracks state for debugging |

---

## 6. Files to Create/Modify

### New Files (9):
- `supabase/functions/gtfs-sync-agency/index.ts`
- `supabase/functions/gtfs-sync-calendar/index.ts`
- `supabase/functions/gtfs-sync-routes/index.ts`
- `supabase/functions/gtfs-sync-stops/index.ts`
- `supabase/functions/gtfs-sync-trips/index.ts`
- `supabase/functions/gtfs-sync-stop-times/index.ts`
- `supabase/functions/gtfs-sync-shapes/index.ts`
- `supabase/functions/gtfs-sync-transfers/index.ts`
- `src/pages/AdminGtfsScreen.tsx`

### Modified Files (2):
- `src/App.tsx` -- add `/admin/gtfs` route
- `supabase/config.toml` -- add `verify_jwt = false` for all 8 new functions

### Database Migrations:
- Create 13 GTFS tables + `gtfs_sync_status` with RLS
- Seed 4 initial feeds (GO, UP, TTC, MiWay)

### Data Inserts (not migrations):
- Enable `pg_cron` and `pg_net` extensions
- Create ~32 cron jobs (28 weekly + 4 daily)

---

## 7. Implementation Order

Due to the size of this feature, implementation will be done in phases across multiple messages:

1. **Phase 1**: Database migration -- all 14 tables + RLS + seed feeds
2. **Phase 2**: Build small-file edge functions (agency, calendar, routes)
3. **Phase 3**: Build medium-file edge functions (stops, trips, transfers)
4. **Phase 4**: Build large-file edge functions (shapes, stop-times)
5. **Phase 5**: Admin page + App.tsx routing
6. **Phase 6**: Cron job setup (pg_cron + pg_net)
7. **Phase 7**: Test each function end-to-end

