

## Problem

TTC publishes their GTFS feed **ahead of time** for the next schedule period. Right now the calendar shows `start_date = 20260315` but today is March 9. The current stop_times sync skips TTC because no services match today's date. Meanwhile, TTC buses are actually running the same schedule patterns (weekday/Saturday/Sunday) -- just under a calendar window that hasn't "started" yet.

## Solution: Date-Bounds Fallback

Modify `getActiveServiceIds` in `gtfs-sync-stop-times/index.ts` to add a **fallback**: if the strict date-bounded query returns zero services, re-query `gtfs_calendar` using **only the day-of-week flag** (ignoring `start_date`/`end_date`). This way:

- Service 1 (Mon-Fri) matches any weekday, even before March 15
- Service 2 (Saturday) matches any Saturday
- Service 3 (Sunday) matches any Sunday
- `calendar_dates` exceptions are still applied in the fallback (filtered to dates within the feed's range)

The same fallback applies to the cleanup function's `getAllActiveServiceIds`.

## Why This Is Safe

- The fallback only triggers when **zero** services match the strict date range -- so agencies with current calendars (GO, MiWay, UP) are unaffected.
- TTC's day-of-week patterns correctly represent the real-world service (weekday vs weekend).
- Once March 15 arrives, the strict query will match and the fallback is never reached.

## Changes

### 1. `supabase/functions/gtfs-sync-stop-times/index.ts`
- In `getActiveServiceIds`: after the existing strict query, if `serviceIds.size === 0`, run a second query on `gtfs_calendar` matching only the day-of-week column (no date bounds). Apply `calendar_dates` exceptions for dates within the feed's range.
- Add a console log when fallback is used for debugging.

### 2. `supabase/functions/gtfs-sync-stop-times-cleanup/index.ts`
- Same fallback logic in `getAllActiveServiceIds`: if strict date-bounded query returns nothing for a given day, fall back to day-of-week only.

### No other files change. No database changes needed.

