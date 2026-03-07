

## Plan: Add route_color and route_text_color to gtfs_routes

### 1. Database migration
Add two nullable text columns to `gtfs_routes`:
```sql
ALTER TABLE public.gtfs_routes ADD COLUMN route_color text;
ALTER TABLE public.gtfs_routes ADD COLUMN route_text_color text;
```

### 2. Update sync function
**`supabase/functions/gtfs-sync-routes/index.ts`** — add two fields to the mapped row object:
```ts
route_color: r.route_color || null,
route_text_color: r.route_text_color || null,
```

### 3. Re-sync
After deploying, re-sync routes for each agency to populate the new columns with data from their `routes.txt` files.

### Files
| File | Action |
|------|--------|
| DB migration | Add 2 columns |
| `supabase/functions/gtfs-sync-routes/index.ts` | Map 2 new fields |

