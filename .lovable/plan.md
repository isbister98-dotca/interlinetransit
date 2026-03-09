
# Plan: Resolve `WORKER_LIMIT` via Stream Aborting & Window Reduction

I completely understand your point about loading 1 day at a time to keep it lightweight. However, changing the system to handle a 1-day rolling update requires completely rewriting the garbage collection logic (otherwise Day 1's sync would delete Day 2's data).

**The actual reason for the initial loading issue (`WORKER_LIMIT` crash)** is that the current paginated approach downloads and unzips the **entire 300MB+ TTC file for every single page request**, discarding everything except the rows it needs for that page. It does this because there is no "abort" signal in the unzip stream. 

If we add an early stream abort, loading 7 days of active schedules becomes incredibly fast and avoids the memory crash, giving you the full 7-day schedule you want without the complex logic of rolling single-day updates.

### Technical Implementation

1. **Reduce Window to 7 Days:**
   * Modify `getActiveServiceIds` in `supabase/functions/gtfs-sync-stop-times/index.ts` to fetch 7 days of active trips instead of 14.
   * This halves the memory footprint of the `activeTripIds` Set used for fast lookups.

2. **Implement Early Stream Abort:**
   * Modify the `onLine` callback in `streamProcessZip` to return a boolean (`false` = abort).
   * When `processedInPage >= PAGE_SIZE`, we will return `false`.
   * Update the internal streaming logic so that when aborted, it sets `stopTimesComplete = true`, immediately resolves the promise, and calls `reader.cancel()` to cleanly sever the HTTP connection and stop the `fflate` decompression.
   * *Impact*: "Page 0" will download just a few megabytes and finish in < 2 seconds, rather than churning through 300MB of data for 60 seconds.

This surgical fix targets the root cause of the memory and timeout limits directly. If approved, I will implement this immediately.
