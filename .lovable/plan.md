

## Plan: Add Concurrency Throttling to Prevent Database Overload

### Problem
- Multiple hours sync concurrently, each downloading ZIPs and upserting rows
- With 25 retries, failed hours retry aggressively, compounding load
- Database gets overwhelmed → 503 "schema cache" errors

### Solution: Rate-limit concurrent hour processing

**1) Modify `gtfs-sync-paginated/index.ts`**
- Add a small delay (500-1000ms) between firing each hour's sync
- When retrying after error, add jitter to prevent thundering herd
- Track concurrent operations and cap at ~3-4 simultaneous hours per agency

**2) Add backoff jitter for retries**
- Current: fixed exponential backoff (1s, 2s, 4s...)
- Improved: add random jitter (e.g., `backoff * (0.5 + Math.random())`)
- Prevents all retrying hours from hitting DB at same moment

**3) (Optional) Sequential hour processing mode**
- For massive feeds like TTC, process hours sequentially instead of parallel
- Slower but prevents overload entirely
- Could be a toggle per agency

### Implementation Details

```typescript
// In gtfs-sync-paginated, add jitter to backoff
const backoffMs = Math.pow(2, nextRetryCount - 1) * 1000;
const jitter = backoffMs * (0.5 + Math.random()); // 50-150% of base
await new Promise(r => setTimeout(r, jitter));
```

### Expected Outcome
- Fewer 503 errors during sync
- More predictable completion times
- Database stays responsive for the frontend

