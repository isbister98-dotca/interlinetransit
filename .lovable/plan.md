
# GTFS Schedule Data Integration — IMPLEMENTED

## Status: ✅ Complete (v6 - Dual Cache Architecture)

All phases implemented:
1. ✅ 14 database tables created (12 GTFS data + gtfs_feeds + gtfs_sync_status) with RLS
2. ✅ 4 initial feeds seeded (GO, UP, MiWay, TTC)
3. ✅ 8 edge functions deployed (agency, calendar, routes, stops, trips, shapes, transfers, stop-times)
4. ✅ Admin page at /admin/gtfs with feed management + sync status
5. ✅ Hour-partitioned stop_times (hours 0-27 per day, uniform for all agencies)
6. ✅ **v5:** Server-side auto-retry with exponential backoff (up to 5 retries)
7. ✅ **v6:** Dual cache architecture (trip IDs + ZIP files) to eliminate redundant work

## Architecture (v6)

### Dual Cache System (NEW)

**Trip ID Cache (`gtfs_trip_cache` table)**
- Stores active trip IDs per agency+service_date (YYYYMMDD)
- First invocation per day: computes trip IDs (~10s) and caches to DB
- Subsequent invocations: reads from cache in <500ms
- **Savings**: ~9 seconds per hour/page after first invocation

**ZIP Cache (`gtfs-zip-cache` Storage bucket)**
- First invocation per day: downloads ZIP from agency URL, uploads to Storage (async)
- Subsequent invocations: reads ZIP from Storage instead of remote URL
- **Savings**: ~5-10 seconds per hour/page after first invocation
- Cache invalidated daily (new service_date = new ZIP)

**Combined benefit**: Up to 15-20 seconds saved per invocation = more CPU headroom for processing peak hours

### Auto-Retry System (v5)
- `retry_count` column in `gtfs_sync_status` tracks attempts per hour
- Retriable errors: `WORKER_LIMIT`, `CPU Time exceeded`, `CPU budget`, `memory`
- Exponential backoff: 1s, 2s, 4s, 8s, 16s between retries
- After 5 failed retries, marks as permanent error and moves to next hour
- Successful completion resets `retry_count` to 0

### Agency-Specific Optimizations (v6 Updated)
- **TTC**: PAGE_SIZE=3000 (reduced from 5000) due to ~1.2M stop_times + dual cache overhead
- **MiWay**: PAGE_SIZE=7500
- Smaller DB batch sizes (50 services, 500 trips) for faster queries
- CPU budget reduced to 45s to leave margin before platform limits

### Hour-Partitioned Stop Times
- Each stop_times sync is partitioned by **day (0-6) × hour (0-27)** = 196 status entries per agency
- Status file_type format: `stop_times_d{dayOffset}_h{hour}` (e.g. `stop_times_d0_h7`)
- Empty hours recorded as `done` with `row_count: 0` (no dashboard gaps)
- Pagination fallback within a single hour if >PAGE_SIZE rows matched

### Paginated Wrapper Flow
```text
paginated(agency=TTC, file_type=stop_times, day_offset=0)
  → stop-times(TTC, d0, h0, p0) 
    → getCachedTripIds(TTC, 20260309) → CACHE MISS → compute + cache 39k trip IDs
    → getZipStream(TTC, 20260309) → CACHE MISS → download ZIP, upload to Storage async
    → process hour=0 → done
  → stop-times(TTC, d0, h1, p0)
    → getCachedTripIds(TTC, 20260309) → CACHE HIT (500ms)
    → getZipStream(TTC, 20260309) → CACHE HIT from Storage (3s)
    → process hour=1 → done
  ...
```

### Admin Dashboard
- Three-level drill-down: Agency > Day (d0-d6) > Hour (h0-h27)
- Consecutive hours with same status collapsed into ranges (e.g. "h0-h3 Done")
- Per-hour retrigger buttons for error/stale entries
- Per-day retrigger via paginated wrapper (all 28 hours)
- Sync Health cards show X/196 hours synced per agency

### Key Changes from v5
- **Dual cache**: Trip IDs cached in DB, ZIP files cached in Storage (gtfs-zip-cache bucket)
- **Trip ID cache**: `gtfs_trip_cache` table keyed by agency_id + service_date (YYYYMMDD)
- **ZIP cache**: Storage bucket with path `{agency_id}/{service_date}.zip`
- **TTC page size**: Reduced to 3000 to account for cache overhead and ensure peak hours complete
- **Cache invalidation**: Daily via service_date key (auto-clears on new day)
- **Memory management**: ZIP downloaded once per day, streamed from Storage for subsequent hours
