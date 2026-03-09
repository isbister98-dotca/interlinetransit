ALTER TABLE public.gtfs_stop_times ADD COLUMN IF NOT EXISTS stop_headsign text;
ALTER TABLE public.gtfs_stop_times ADD COLUMN IF NOT EXISTS shape_dist_traveled numeric;