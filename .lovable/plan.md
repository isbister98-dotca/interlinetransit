
# GTFS Schedule Data Integration — IMPLEMENTED

## Status: ✅ Complete (v6 - Dual Cache Architecture)

All phases implemented:
1. ✅ 14 database tables created (12 GTFS data + gtfs_feeds + gtfs_sync_status) with RLS
2. ✅ 4 initial feeds seeded (GO, UP, MiWay, TTC)
3. ✅ 8 edge functions deployed (agency, calendar, routes, stops, trips, shapes, transfers, stop-times)
4. ✅ Admin page at /admin/gtfs with feed management + sync status
5. ✅ Hour-partitioned stop_times (hours 0-27 per day, uniform for all agencies)
6. ✅ **v5:** Server-side auto-retry with exponential backoff (up to 5 retries)

## Architecture (v5)

### Auto-Retry System
- `retry_count` column in `gtfs_sync_status` tracks attempts per hour
- Retriable errors: `WORKER_LIMIT`, `CPU Time exceeded`, `CPU budget`, `memory`
- Exponential backoff: 1s, 2s, 4s, 8s, 16s between retries
- After 5 failed retries, marks as permanent error and moves to next hour
- Successful completion resets `retry_count` to 0

### Agency-Specific Optimizations
- TTC: PAGE_SIZE=5000 (vs default 10000) due to ~1.2M stop_times
- MiWay: PAGE_SIZE=7500
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
  → stop-times(TTC, d0, h0, p0) → WORKER_LIMIT → retry_count=1 → wait 1s → retry
  → stop-times(TTC, d0, h0, p0) → done
  → stop-times(TTC, d0, h1, p0) → done
  ...
```

### Admin Dashboard
- Three-level drill-down: Agency > Day (d0-d6) > Hour (h0-h27)
- Consecutive hours with same status collapsed into ranges (e.g. "h0-h3 Done")
- Per-hour retrigger buttons for error/stale entries
- Per-day retrigger via paginated wrapper (all 28 hours)
- Sync Health cards show X/196 hours synced per agency

### Key Changes from v4
- **Auto-retry**: Transient failures (WORKER_LIMIT, CPU exceeded) retry automatically
- **Exponential backoff**: Prevents hammering the platform on resource contention
- **Agency-specific tuning**: Smaller page sizes for TTC to fit within CPU limits
- **Optimized DB queries**: Smaller batch sizes reduce per-invocation overhead
