

## Problem Analysis

TTC stop_times sync fails consistently with `WORKER_LIMIT` and `CPU Time exceeded` errors. The root cause:

1. **TTC has ~1.2M stop_times rows** (vs MiWay 442k, GO 267k) and ~39,451 trips per service day
2. **Each hour invocation re-downloads the entire ZIP and rebuilds the 39k-trip Set** before streaming
3. **Building a 39k-element Set from 1000-row batched DB queries** takes many round-trips
4. The edge function hits CPU/memory limits before it can even start streaming the ZIP

## Core Issue

The current architecture calls `getActiveTripIds()` on every single hourly invocation. For TTC this means:
- ~40 paginated DB queries just to build the trip ID set
- Combined with ZIP download overhead, this exceeds the 50s CPU budget

## Proposed Solution: Server-Side Retry with Caching

### 1. Add retry_count column to track attempts
```sql
ALTER TABLE gtfs_sync_status ADD COLUMN retry_count integer DEFAULT 0;
```

### 2. Modify `gtfs-sync-paginated` to detect retriable errors and auto-retry (up to 5 times)

When the inner stop-times function returns a 500 with `WORKER_LIMIT` or `CPU Time exceeded`:
- Increment `retry_count`
- If < 5: fire a new request to the same hour with exponential backoff
- If >= 5: mark as permanent error

### 3. Cache active trip IDs per agency+day

Instead of recomputing `getActiveTripIds()` on every hour, compute once per day and store in a temporary table or the sync_status row:
- First hour of day (h=0): compute and cache trip IDs
- Subsequent hours: read from cache

### 4. Reduce per-invocation work for TTC

- **Pre-filter CSV on read**: Skip building full trip set; stream and match incrementally
- **Smaller PAGE_SIZE for large agencies**: Reduce from 10k to 5k for TTC to stay under limits

## Implementation Steps

1. **DB migration**: Add `retry_count` column to `gtfs_sync_status`

2. **Update `gtfs-sync-paginated/index.ts`**:
   - After catching 500 errors, check if retriable (WORKER_LIMIT / CPU exceeded)
   - Check current retry_count from status table
   - If < 5: increment count, wait (2^retry × 1s), re-invoke same hour
   - If >= 5: mark error, continue to next hour

3. **Update `gtfs-sync-stop-times/index.ts`**:
   - Add agency-specific PAGE_SIZE (TTC: 5000, others: 10000)
   - Reduce `getActiveTripIds` DB batching from 1000 to 500 rows to reduce query complexity
   - Log memory/CPU diagnostics

4. **Frontend (optional enhancement)**: Show retry_count in admin UI for visibility

## Technical Details

```typescript
// In gtfs-sync-paginated - after catching 500 error:
const errBody = await res.text();
const isRetriable = errBody.includes("WORKER_LIMIT") || 
                     errBody.includes("CPU Time exceeded") ||
                     errBody.includes("CPU budget");

if (isRetriable) {
  const { data: status } = await supabase
    .from("gtfs_sync_status")
    .select("retry_count")
    .eq("agency_id", agencyId)
    .eq("file_type", ft)
    .single();
  
  const retryCount = (status?.retry_count ?? 0) + 1;
  
  if (retryCount <= 5) {
    await supabase.from("gtfs_sync_status").upsert({
      agency_id: agencyId,
      file_type: ft,
      status: "running",
      retry_count: retryCount,
      error_msg: `Retry ${retryCount}/5 after ${errBody.substring(0,50)}...`,
    }, { onConflict: "agency_id,file_type" });
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    await new Promise(r => setTimeout(r, Math.pow(2, retryCount - 1) * 1000));
    
    // Re-invoke same hour
    continue;
  }
}
```

This approach keeps the hour-partitioned UI you prefer while making TTC syncs resilient to transient resource limits.

