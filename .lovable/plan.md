

# Implement Transit Vehicle Cache

## Overview

Set up a server-side pipeline that fetches live transit data every 15 seconds, caches it in a single database row, and serves it instantly to all users. The client polls 3 seconds after each server write so it always reads fresh data.

## Architecture

```text
pg_cron (every minute triggers edge function)
  Edge Function runs 4 fetches in a loop (0s, 15s, 30s, 45s)
    -> GO Transit + UP Express (Metrolinx JSON API)
    -> TTC (GTFS-RT Protobuf)
    -> MiWay (GTFS-RT Protobuf)
    -> UPSERT single row in vehicle_cache (id=1)

Client (SWR, every 15s with 3s initial delay):
  -> SELECT from vehicle_cache where id=1
  -> Instant read (~200KB JSON)
  -> Falls back to mock data if stale (>45s old)
```

## Step-by-Step Changes

### 1. Create `vehicle_cache` table (database migration)

A single-row table that gets overwritten every 15 seconds:

| Column | Type | Description |
|--------|------|-------------|
| id | integer, PK, default 1 | Always 1 |
| vehicles | jsonb, default '[]' | Full Vehicle[] array |
| updated_at | timestamptz | Last successful fetch |
| agency_status | jsonb | Per-agency success/failure |

- RLS enabled with public SELECT policy (transit data is public, no auth needed to read)
- No client-side INSERT/UPDATE allowed
- Seed with one empty row

### 2. Create Edge Function: `supabase/functions/transit-vehicles/index.ts`

- Fetches all 4 transit feeds server-side (no CORS issues)
- Decodes TTC/MiWay protobuf using a lightweight Deno-compatible approach (manually parse GTFS-RT protobuf wire format or use `npm:protobufjs`)
- Fetches GO/UP from Metrolinx JSON API with key `30026966`
- Maps all entities to `Vehicle` format with `inferVehicleType` and `mapOccupancy` helpers
- UPSERTs into `vehicle_cache` where `id = 1` using service role key
- Uses `Promise.allSettled` so one failing agency does not break others
- Includes CORS headers
- Config: `verify_jwt = false` in config.toml (public transit data)

### 3. Set up pg_cron job (via SQL insert tool)

- Enable `pg_cron` and `pg_net` extensions
- Schedule the edge function to be called every minute via `pg_net`
- The edge function itself will handle 4 sub-invocations (at 0s, 15s, 30s, 45s) within each minute to achieve 15-second refresh
- Note: `pg_cron` minimum is 1 minute, so the edge function handles sub-scheduling internally

### 4. Simplify `src/lib/transit-api.ts`

Replace the entire file (~130 lines) with ~25 lines:
- Import the Supabase client
- Query `vehicle_cache` table for the single row
- Check `updated_at` freshness (if older than 45 seconds, fall back to mock data)
- Return the `vehicles` JSON array
- Remove all direct API fetching, proxy fallback, and browser-side protobuf decoding

### 5. Update `src/hooks/use-vehicles.ts`

- Add a 3-second initial delay before first fetch (offset from server writes)
- Keep `refreshInterval` at `15_000`
- Interface stays identical: `{ vehicles, isLoading, error }`

### 6. Clean up `vite.config.ts`

- Remove the 3 proxy rules (`/api/metrolinx/`, `/api/ttc/`, `/api/miway/`)

### 7. Clean up `package.json`

- Remove `gtfs-rt-bindings` and `protobufjs` dependencies (decoding moves to edge function)

## What Stays the Same

- All map rendering, vehicle marker icons, and agency colors
- The `useVehicles()` hook return shape
- Mock data fallback behavior
- All other screens and UI components
- Bottom sheet departures

## Database Size

- ~1,300 vehicles x ~150 bytes = ~200 KB, always exactly 1 row
- Overwritten every 15 seconds, never grows

## New Files
- `supabase/functions/transit-vehicles/index.ts`

## Modified Files
- `src/lib/transit-api.ts` (simplified to single database query)
- `src/hooks/use-vehicles.ts` (3s offset delay)
- `vite.config.ts` (remove proxy rules)
- `package.json` (remove protobuf deps)

