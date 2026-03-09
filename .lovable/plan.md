
# GTFS Schedule Data Integration — IMPLEMENTED

## Status: ✅ Complete (v2 - Daily Workflow Architecture)

All phases implemented:
1. ✅ 14 database tables created (12 GTFS data + gtfs_feeds + gtfs_sync_status) with RLS
2. ✅ 4 initial feeds seeded (GO, UP, TTC, MiWay)
3. ✅ 8 edge functions deployed (agency, calendar, routes, stops, trips, shapes, transfers, stop-times)
4. ✅ Admin page at /admin/gtfs with feed management + sync status
5. ✅ **NEW:** Daily 7-workflow stop_times architecture with per-day syncs

## Architecture (v2)

### Daily Stop Times Workflow
```text
Midnight daily (5:00 UTC / ~midnight ET)
├── 00:00 → stop_times day_offset=0  (TODAY - highest priority)
├── 00:05 → stop_times day_offset=1  (tomorrow)
├── 00:10 → stop_times day_offset=2
├── 00:15 → stop_times day_offset=3
├── 00:20 → stop_times day_offset=4
├── 00:25 → stop_times day_offset=5
├── 00:30 → stop_times day_offset=6
└── 00:40 → stop_times cleanup (GC - garbage collection)
```

### Key Changes from v1
- **Single-day processing**: Each invocation builds `activeTripIds` for ONE day (~1/7th memory)
- **Decoupled GC**: Garbage collection runs separately after all days complete
- **No race conditions**: Per-day syncs only upsert; cleanup only deletes
- **Today-first**: day_offset=0 runs at midnight ensuring freshest schedule data

### Status Tracking
- `stop_times_d0` through `stop_times_d6` - per-day sync status
- `stop_times_cleanup` - garbage collection status
- Admin UI shows expandable grouped view for all 8 statuses

## Cron Schedule
- **Weekly (Monday 3am ET)**: agency, calendar, routes, stops, trips, shapes, transfers
- **Daily (midnight ET)**: stop_times d0-d6 + cleanup (32 jobs: 8 slots × 4 agencies)

## Edge Functions
- `gtfs-sync-stop-times` - accepts `day_offset=0-6` param, processes single day
- `gtfs-sync-stop-times-cleanup` - builds 7-day union, runs garbage collection
- `gtfs-sync-paginated` - wrapper that chains pages, forwards `day_offset`
