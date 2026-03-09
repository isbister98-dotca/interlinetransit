-- Add index for faster trip cache lookups
CREATE INDEX IF NOT EXISTS gtfs_trip_cache_lookup 
ON public.gtfs_trip_cache (agency_id, service_date);

-- Increase bucket file size limit to 300MB for TTC
UPDATE storage.buckets
SET file_size_limit = 314572800
WHERE id = 'gtfs-zip-cache';

-- Drop overly permissive storage policy
DROP POLICY IF EXISTS "Service role full access gtfs-zip-cache" ON storage.objects;