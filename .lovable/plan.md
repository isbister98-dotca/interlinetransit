

## What’s going on (why it still fails)

### 1) “Backend vs frontend” won’t change the outcome
The GTFS sync already runs as a **server-side backend function**. The admin UI just *triggers* it.  
So if `gtfs-sync-stop-times` is crashing with **“Memory limit exceeded”**, it will crash no matter where it’s triggered from.

### 2) The failure is now clearly identified in logs
Your backend logs show `gtfs-sync-stop-times` repeatedly hitting:

- `Memory limit exceeded`
- right after: `Cache miss, downloading ZIP...`

That points to a **memory blow-up during ZIP caching** (not during DB upserts).

### 3) Trip cache currently isn’t actually caching (DB confirms it)
DB query of `gtfs_trip_cache` returns **zero rows** even though logs claim “Cached 39451 trip IDs…”.

From the diff + current function code, there are two concrete reasons:

- `gtfs_trip_cache.day_offset` is still **NOT NULL**, but the code upserts **without `day_offset`** → upsert fails.
- the code does **not check** the upsert error → it prints “Cached …” even when the write failed.

So right now:
- you pay the “compute trip IDs” cost repeatedly, and
- ZIP caching is attempting work that blows memory.

## Why it “worked once before”
It likely “worked” in the scenario where:
- the ZIP was already cached for that exact `service_date` (so no cache miss / no upload attempt), or
- the code at that time wasn’t trying to convert the ZIP stream into a Blob.

Once you hit a day/hour that is a cache miss, the function tries to cache the ZIP using:

```ts
const blob = await new Response(cacheStream).blob();
```

That buffers the entire TTC ZIP into memory and triggers the edge runtime’s memory kill.

---

## Plan: Make TTC stop_times sync actually feasible (v7)

### A) Fix trip ID cache so it truly persists (and fails loudly if it can’t)
**Goal:** stop recomputing TTC’s ~39k trip IDs every invocation.

1) **Code change** (`gtfs-sync-stop-times/index.ts`)
- Include `day_offset` in the `gtfs_trip_cache` upsert payload.
- Capture and log the upsert `{ error }`. Only print “Cached …” when the upsert succeeded.

2) **DB migration**
- Add an index for faster reads:
  - `(agency_id, service_date)`
- (Optional) If we decide `day_offset` is redundant, we can make it nullable or drop it later, but first we’ll simply write it correctly.

### B) Replace ZIP caching with true streaming (no Blob, no buffering)
**Goal:** avoid “Memory limit exceeded” while still caching the ZIP.

1) **Stop using** `supabase.storage.download()` / `.upload(blob)` for TTC ZIP caching in this function.
2) Implement Storage caching via **direct HTTP + streams**:
- Cache hit:
  - `GET {SUPABASE_URL}/storage/v1/object/gtfs-zip-cache/{agencyId}/{serviceDate}.zip`
  - return `res.body` directly as `ReadableStream<Uint8Array>`
- Cache miss:
  - `fetch(feedUrl)` and `tee()` the response body:
    - one stream goes to unzip processing
    - the other stream is uploaded to Storage using `fetch(..., { body: uploadStream })`
  - IMPORTANT: do not await a `.blob()` at any point.

3) **Avoid concurrent duplicate uploads**
- Only attempt the Storage upload when `page===0 && hour===0`.
- For other hours, if cache is missing:
  - either stream from remote **without trying to cache**, or
  - poll storage for a short time (optional) before falling back to remote.

### C) Increase cache bucket file size limit (TTC ZIP can exceed 100MB)
Current bucket limit is **100MB**. That may be too small for TTC and would make caching fail even after streaming is fixed.

**DB migration:**
- bump `storage.buckets.file_size_limit` for `gtfs-zip-cache` to e.g. **300MB**.

### D) Fix the storage RLS policy (security + correctness)
Your migration added:

- `CREATE POLICY ... ON storage.objects FOR ALL USING (bucket_id='gtfs-zip-cache') ...`

Because it has no `TO ...`, it applies to `public` by default, which is overly permissive.

**DB migration:**
- Drop that policy and replace with a restricted one:
  - either `TO service_role` only, or
  - remove entirely if the backend key bypasses RLS in your environment.
  
We’ll choose the safest approach: explicitly restrict.

### E) (Optional but recommended) Fix the noisy Admin UI console warning
This doesn’t affect the backend sync, but it’s polluting your console while debugging:
- Convert `Badge` to `React.forwardRef` so `StatusBadge` can pass refs without warnings.

---

## How we’ll verify the fix (fast, objective checks)

1) Trigger TTC stop_times **hour=0 page=0**:
- Expect log: “Cached ZIP to storage” (or at least upload attempt status)
- Expect **no** “Memory limit exceeded”

2) Trigger hour=1:
- Expect log: “Using cached ZIP from storage”
- Expect log: “Using cached trip IDs …”
- DB: `gtfs_trip_cache` should now contain TTC rows

3) Confirm the admin table starts showing real progress instead of retry loops caused by immediate crashes.

---

## If it STILL fails after v7
Then the remaining issue is no longer “overhead” (trip set + zip download), it’s that “scan stop_times.txt for each hour” is too expensive for TTC even with caches. At that point we’d move to a bigger architectural change (pre-splitting or pre-indexing stop_times once per day), but we should not jump there until the memory-kill + broken cache are fixed because those are currently hard blockers.

