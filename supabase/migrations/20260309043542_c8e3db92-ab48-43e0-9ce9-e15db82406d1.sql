ALTER TABLE public.gtfs_trip_cache
ADD COLUMN IF NOT EXISTS service_date text;

UPDATE public.gtfs_trip_cache
SET service_date = to_char((created_at at time zone 'UTC')::date, 'YYYYMMDD')
WHERE service_date IS NULL;

ALTER TABLE public.gtfs_trip_cache
ALTER COLUMN service_date SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gtfs_trip_cache_pkey'
      AND conrelid = 'public.gtfs_trip_cache'::regclass
  ) THEN
    ALTER TABLE public.gtfs_trip_cache DROP CONSTRAINT gtfs_trip_cache_pkey;
  END IF;
END
$$;

ALTER TABLE public.gtfs_trip_cache
ADD CONSTRAINT gtfs_trip_cache_pkey PRIMARY KEY (agency_id, service_date);