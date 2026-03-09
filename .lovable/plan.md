
# Plan: Optimize `stop_times` Sync for Reliability and Zero Downtime

To solve the memory limit crashes and ensure the app never has "empty" data while the sync is running, we need to completely rethink how we parse the file and manage the database. 

Here is the approach:

### 1. Fix the Memory Crash (Streaming Decompression)
Currently, `unzipSync` extracts the entire `stop_times.txt` (which can be over 300MB for TTC) directly into memory at once, hitting the Edge Function's 256MB limit. 
*   **Solution**: We will rewrite the function to use `fflate`'s streaming `Unzip` API. We will decompress the file chunk-by-chunk and process CSV lines incrementally as they stream in. This will reduce peak memory usage to just a few megabytes.

### 2. Zero-Downtime Data Replacement (Upsert, Don't Delete)
Currently, on "page 0" of the sync, the function deletes **all** `stop_times` for that agency. If the sync takes 20 minutes (or fails halfway), the app has no schedule data!
*   **Solution**: We will remove the `DELETE` step. Instead, we will rely entirely on `UPSERT` (Update/Insert) on conflict. This ensures that existing schedules remain perfectly intact and active while the new ones are written over them in the background.

### 3. Smart Garbage Collection (Keep Useful Data)
Because we are no longer wiping the table on page 0, the database would eventually bloat with old, expired stop times.
*   **Solution**: We will add a cleanup step that runs **only at the very end of the sync** (when the last page completes). It will identify any `trip_id`s in the `stop_times` table that are no longer in our "active trips for the next 14 days" list, and safely delete only those expired rows. 

### 4. Reduced Pagination Size
Since we will be streaming the data, we can process it more predictably. We will reduce the chunking size per "page" to ensure we stay well within Supabase's strict 60-second execution timeout per Edge Function call, allowing the paginated wrapper to iterate smoothly until the end of the file.

### Next Steps
If you approve, I will switch out of plan mode and implement this streaming architecture in the `gtfs-sync-stop-times` Edge Function.
