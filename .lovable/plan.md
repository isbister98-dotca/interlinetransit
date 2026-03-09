

## Problem Diagnosis

**TTC 0 rows — root cause confirmed:** TTC's `gtfs_calendar` has `start_date: 20260315` (March 15). Today is March 9. The strict date query finds nothing, so it falls back to day-of-week matching, which returns all 13 services and ~135K trips. This means the function must scan through TTC's entire `stop_times.txt` (millions of rows) checking every `trip_id` against a 135K-entry Set. This is hitting **"CPU Time exceeded"** limits (visible in logs) before it can finish even a single page.

**MiWay d2-d6 = 0 rows:** Same concurrency/timeout issue from earlier runs. MiWay d0 and d1 work (29K rows each) because they ran without competition.

**Are 5-10 minute gaps enough?** Yes for GO/UP/MiWay (small datasets). **No for TTC** — the problem isn't concurrency gaps, it's that a single TTC invocation exceeds the edge function CPU time limit (~50s CPU) because it downloads a ~40MB ZIP and scans millions of CSV lines per page.

## Plan

### 1. Fix TTC calendar date-bounds issue
The day-of-week fallback is correct behavior (TTC schedule starts March 15 but uses the same service patterns). The real fix is reducing per-invocation CPU work for TTC's massive file.

### 2. Reduce PAGE_SIZE for large agencies
Change `PAGE_SIZE` from 30,000 to **10,000** specifically when the trip set is very large (>50K trips). This means fewer CSV lines scanned before returning, staying within CPU limits. The paginated wrapper will just run more pages.

### 3. Add early-exit optimization to streaming
Currently the stream scans the *entire* CSV to find matching rows up to `skipUntil + PAGE_SIZE`. For page N, it re-scans all rows from the beginning. This is O(N * total_rows) across all pages.

**Better approach:** Track the byte offset / line number where we stopped, pass it as a param to resume from. However, ZIP streaming makes byte-offset resumption complex.

**Practical fix:** Reduce PAGE_SIZE and accept more pages. The paginated wrapper already handles continuation.

### 4. Implement smaller batch size for TTC upserts
Reduce `BATCH_SIZE` from 500 to 200 for upserts to lower per-batch memory/CPU pressure.

### Changes

**`supabase/functions/gtfs-sync-stop-times/index.ts`:**
- Dynamic PAGE_SIZE: 30,000 for small agencies, 10,000 when activeTripIds > 50K
- Reduce BATCH_SIZE to 200
- Add a CPU budget check: track elapsed time, if approaching ~40s, stop early and report `hasMore=true` with current page position — this prevents "CPU Time exceeded" kills
- Log trip count so we can diagnose in logs

**`supabase/functions/gtfs-sync-paginated/index.ts`:**
- No changes needed — already handles multi-page continuation

**`src/pages/AdminGtfsScreen.tsx`:**
- Show the `error_msg` on 0-row entries so you can see "CPU Time exceeded" or "No active services" at a glance in the dashboard

### Technical Detail

The core fix is adding a time guard inside the streaming callback:

```typescript
const startTime = Date.now();
const CPU_BUDGET_MS = 35_000; // 35s safety margin under 50s limit

await streamProcessZip(feed.feed_url, (line: string) => {
  if (Date.now() - startTime > CPU_BUDGET_MS) {
    hasMore = true;
    return false; // stop streaming
  }
  // ... existing logic
});
```

Combined with the existing paginated wrapper, TTC will process in many small pages instead of hitting CPU limits.

