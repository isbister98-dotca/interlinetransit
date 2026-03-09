

## Problem: WORKER_LIMIT Error on Large Agencies (GO, TTC)

The `gtfs-sync-stop-times` function is hitting CPU/memory limits when processing large agencies like GO Transit. 

### Root Cause

Each hour sync **re-downloads the entire GTFS ZIP file** and scans through all rows:
- GO d0 h=0: Downloads full ZIP → scans all rows → finds 0 matching h=0 → 2.7s
- GO d0 h=1: Downloads full ZIP AGAIN → scans all rows → CPU timeout at ~3s

For GO with 1749 active trips, the ZIP download + decompression + row scanning exhausts the CPU budget (35s) before completing hour 1.

### Technical Details

**Current flow** (`gtfs-sync-stop-times/index.ts`):
```
1. Download full ZIP from feed_url
2. Stream + decompress stop_times.txt
3. Parse CSV line-by-line
4. Filter by active trips (1749 for GO)
5. Filter by target hour (lines 363-370)
6. Accumulate up to PAGE_SIZE (10,000) rows
7. If CPU_BUDGET_MS (35s) exceeded → set hasMore=true
```

**The bottleneck**: Steps 1-4 happen for EVERY hour, wasting CPU on repeated downloads/scans.

**Edge function limits**:
- CPU time: ~60 seconds hard limit
- Memory: limited by WORKER_LIMIT
- Current CPU_BUDGET_MS: 35,000ms (too conservative for large agencies)

### Solution

**Increase CPU_BUDGET_MS** from 35s to 50s to give more processing time before triggering pagination:

`supabase/functions/gtfs-sync-stop-times/index.ts` line 11:
```typescript
const CPU_BUDGET_MS = 50_000; // Was 35_000
```

This allows:
- More time for large ZIP downloads
- More rows to be scanned before timeout
- Better completion rate for dense hours (morning rush = h7-h9)

**Why this works**:
- Edge functions have ~60s total limit
- Leaving 10s buffer for DB upserts + status updates
- 50s is enough for most hours to complete in one call
- If a single hour still exceeds 50s, pagination within that hour kicks in

**Fallback behavior** (already implemented):
- If hour still times out → `hasMore=true` → next invocation continues with `page=1`
- Admin dashboard shows "error" → manual retrigger button available

### Files to Change

1. **`supabase/functions/gtfs-sync-stop-times/index.ts`**
   - Line 11: Change `CPU_BUDGET_MS = 35_000` to `CPU_BUDGET_MS = 50_000`

2. **Deploy the updated function**
   - Use `supabase--deploy_edge_functions` to push changes

### Testing Plan

After deployment:
1. Retrigger GO d0 h1 from admin dashboard (currently errored)
2. Verify it completes without WORKER_LIMIT error
3. Monitor logs for "CPU budget hit" warnings
4. If h1 succeeds, trigger full GO d0 sync to test all 28 hours

### Affected Agencies

**All agencies with large GTFS files**:
- ✅ **GO Transit**: 1749 trips, large ZIP, currently failing
- ✅ **TTC**: Massive stop_times file, likely to hit limits
- ⚠️ **MiWay**: Smaller, but may hit limits on dense hours
- ✅ **UP Express**: Small, unlikely to be affected

This fix ensures all agencies can sync reliably without manual intervention.

