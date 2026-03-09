
## Analysis

The core problem is that each sync invocation builds `activeTripIds` for 7 days (~20-40k trips for TTC) and scans the entire 300MB+ ZIP file even for paginated requests. Splitting into 7 daily day-offset workflows means each invocation only resolves ~1/7th the trips (~3-5k), drastically reducing memory and execution time. Today (d0) always runs first.

**Does daily help?** Yes — the small per-day dataset means:
- Memory per invocation is ~1/7th → no WORKER_LIMIT
- A single day's failure doesn't affect others
- Today is guaranteed fresh at midnight

---

## Architecture

```text
Midnight daily (ET)
├── 00:00 → stop_times day_offset=0  (TODAY, priority)
├── 00:05 → stop_times day_offset=1
├── 00:10 → stop_times day_offset=2
├── 00:15 → stop_times day_offset=3
├── 00:20 → stop_times day_offset=4
├── 00:25 → stop_times day_offset=5
├── 00:30 → stop_times day_offset=6
└── 00:40 → stop_times cleanup (GC, runs last)
```

---

## Changes

### 1. `supabase/functions/gtfs-sync-stop-times/index.ts`
- Accept `day_offset` query param (0–6, required for per-day mode)
- `getActiveServiceIds` builds active services for **that single day only**
- **Remove GC** from this function entirely (moved to cleanup)
- Track status as `file_type = "stop_times_d{offset}"` per run
- Keeps pagination + early stream abort as-is

### 2. NEW `supabase/functions/gtfs-sync-stop-times-cleanup/index.ts`
- Builds full 7-day union of `activeTripIds`
- Runs `garbageCollectOldTrips` once with the full set
- Updates `file_type = "stop_times_cleanup"` in sync status
- Runs as the 8th cron job daily (after all day syncs)

### 3. `supabase/functions/gtfs-sync-paginated/index.ts`
- Forward `day_offset` param to the underlying stop_times function

### 4. pg_cron schedule (8 jobs via SQL insert tool — not a migration)
- Enable `pg_cron` and `pg_net` extensions
- 7 jobs for d0–d6 staggered by 5 minutes + 1 cleanup job at 00:40
- Each job calls `gtfs-sync-paginated` with `file_type=stop_times&day_offset={n}`

### 5. `src/pages/AdminGtfsScreen.tsx`
- Sync status table groups `stop_times_d0`–`d6` + `stop_times_cleanup` into an expandable "Stop Times (7d)" section
- Today's (d0) row is highlighted since it's the priority

---

## Why This Is Safe (No GC Race)

Per-day syncs only **upsert** — they never delete. GC is centralized in the cleanup function which runs after all 7 day syncs. This means:
- d0 can't accidentally delete trips needed by d3
- If d4 fails, the cleanup still preserves d0-d3 and d5-d6 trips
- GC only removes trips that are no longer active in any of the next 7 days
