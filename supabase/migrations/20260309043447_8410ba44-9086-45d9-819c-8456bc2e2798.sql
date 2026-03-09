-- Create gtfs_trip_cache table to cache active trip IDs per agency+day
CREATE TABLE IF NOT EXISTS public.gtfs_trip_cache (
  agency_id text NOT NULL,
  day_offset integer NOT NULL,
  trip_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, day_offset)
);

ALTER TABLE public.gtfs_trip_cache ENABLE ROW LEVEL SECURITY;

-- Edge functions use service role key, so they bypass RLS
-- Public read only (no need to expose writes to anon clients)
CREATE POLICY "Public read gtfs_trip_cache"
  ON public.gtfs_trip_cache FOR SELECT USING (true);

-- Create gtfs-zip-cache storage bucket for caching GTFS ZIP files during sync
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gtfs-zip-cache',
  'gtfs-zip-cache',
  false,
  104857600,
  ARRAY['application/zip', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Service role (edge functions) can do anything in the bucket
-- No public access needed
CREATE POLICY "Service role full access gtfs-zip-cache"
  ON storage.objects FOR ALL
  USING (bucket_id = 'gtfs-zip-cache')
  WITH CHECK (bucket_id = 'gtfs-zip-cache');