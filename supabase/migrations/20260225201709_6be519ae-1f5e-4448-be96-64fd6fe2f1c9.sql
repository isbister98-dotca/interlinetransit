
-- Create single-row vehicle cache table
CREATE TABLE public.vehicle_cache (
  id integer PRIMARY KEY DEFAULT 1,
  vehicles jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  agency_status jsonb DEFAULT '{}'::jsonb
);

-- Constrain to exactly one row
ALTER TABLE public.vehicle_cache ADD CONSTRAINT vehicle_cache_single_row CHECK (id = 1);

-- Enable RLS
ALTER TABLE public.vehicle_cache ENABLE ROW LEVEL SECURITY;

-- Public read policy (transit data is public)
CREATE POLICY "Anyone can read vehicle cache"
  ON public.vehicle_cache
  FOR SELECT
  USING (true);

-- Seed the single row
INSERT INTO public.vehicle_cache (id, vehicles, updated_at, agency_status)
VALUES (1, '[]'::jsonb, now(), '{}'::jsonb);
