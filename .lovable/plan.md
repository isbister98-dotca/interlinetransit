
# GTFS Schedule Data Integration — IMPLEMENTED

## Status: ✅ Complete (v3 - Staggered Reliability Architecture)

All phases implemented:
1. ✅ 14 database tables created (12 GTFS data + gtfs_feeds + gtfs_sync_status) with RLS
2. ✅ 4 initial feeds seeded (GO, UP, MiWay, TTC)
3. ✅ 8 edge functions deployed (agency, calendar, routes, stops, trips, shapes, transfers, stop-times)
4. ✅ Admin page at /admin/gtfs with feed management + sync status
5. ✅ Daily 7-workflow stop_times architecture with per-day syncs
6. ✅ **NEW v3:** Heavy stagger cron schedule (5-10 min gaps), sequential Sync All Days button

## Architecture (v3)

### Daily Stop Times Cron Schedule (UTC)
```text
d0: GO 4:00, UP 4:05, MiWay 4:10, TTC 4:20
d1: GO 4:30, UP 4:35, MiWay 4:40, TTC 4:50
d2: GO 5:00, UP 5:05, MiWay 5:10, TTC 5:20
d3: GO 5:30, UP 5:35, MiWay 5:40, TTC 5:50
d4: GO 6:00, UP 6:05, MiWay 6:10, TTC 6:20
d5: GO 6:30, UP 6:35, MiWay 6:40, TTC 6:50
d6: GO 7:00, UP 7:05, MiWay 7:10, TTC 7:20
cleanup: GO 7:30, UP 7:35, MiWay 7:40, TTC 7:50
```

### Key Changes from v2
- **Heavy stagger**: 5-10 min gaps between agencies, never >1 concurrent sync
- **TTC gets 10 min extra**: 10-min gap before TTC (largest dataset) to ensure prior agency finishes
- **Paginated wrapper**: Self-continuing with 120s time budget and auto-continuation
- **Stale detection**: 10-min threshold marks zombie syncs, admin can re-trigger
- **Sync All Days button**: Sequential d0-d6 with 5s delays between days + cleanup

### Admin Panel Features
- Sync Health dashboard with per-agency status cards
- Expandable stop_times group showing all 7 days + cleanup
- Per-day re-trigger buttons for stale/error entries
- "Sync All" button per agency for sequential full re-sync
- Stale detection (>10min running = zombie)
