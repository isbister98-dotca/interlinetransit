
-- GTFS Feed Registry
CREATE TABLE public.gtfs_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  feed_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_synced timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agency_id)
);
ALTER TABLE public.gtfs_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_feeds" ON public.gtfs_feeds FOR SELECT USING (true);

-- Sync Status Tracking
CREATE TABLE public.gtfs_sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL,
  file_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  row_count integer DEFAULT 0,
  error_msg text,
  started_at timestamptz,
  completed_at timestamptz
);
ALTER TABLE public.gtfs_sync_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_sync_status" ON public.gtfs_sync_status FOR SELECT USING (true);

-- GTFS Agency
CREATE TABLE public.gtfs_agency (
  agency_id text NOT NULL,
  gtfs_agency_id text NOT NULL,
  agency_name text,
  agency_url text,
  agency_timezone text,
  agency_lang text,
  agency_phone text,
  agency_fare_url text,
  agency_email text,
  PRIMARY KEY (agency_id, gtfs_agency_id)
);
ALTER TABLE public.gtfs_agency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_agency" ON public.gtfs_agency FOR SELECT USING (true);

-- GTFS Calendar
CREATE TABLE public.gtfs_calendar (
  agency_id text NOT NULL,
  service_id text NOT NULL,
  monday boolean NOT NULL DEFAULT false,
  tuesday boolean NOT NULL DEFAULT false,
  wednesday boolean NOT NULL DEFAULT false,
  thursday boolean NOT NULL DEFAULT false,
  friday boolean NOT NULL DEFAULT false,
  saturday boolean NOT NULL DEFAULT false,
  sunday boolean NOT NULL DEFAULT false,
  start_date text NOT NULL,
  end_date text NOT NULL,
  PRIMARY KEY (agency_id, service_id)
);
ALTER TABLE public.gtfs_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_calendar" ON public.gtfs_calendar FOR SELECT USING (true);

-- GTFS Calendar Dates
CREATE TABLE public.gtfs_calendar_dates (
  agency_id text NOT NULL,
  service_id text NOT NULL,
  date text NOT NULL,
  exception_type integer NOT NULL,
  PRIMARY KEY (agency_id, service_id, date)
);
ALTER TABLE public.gtfs_calendar_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_calendar_dates" ON public.gtfs_calendar_dates FOR SELECT USING (true);

-- GTFS Routes
CREATE TABLE public.gtfs_routes (
  agency_id text NOT NULL,
  route_id text NOT NULL,
  gtfs_agency_id text,
  route_short_name text,
  route_long_name text,
  route_desc text,
  route_type integer,
  route_url text,
  route_sort_order integer,
  PRIMARY KEY (agency_id, route_id)
);
ALTER TABLE public.gtfs_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_routes" ON public.gtfs_routes FOR SELECT USING (true);

-- GTFS Stops
CREATE TABLE public.gtfs_stops (
  agency_id text NOT NULL,
  stop_id text NOT NULL,
  stop_name text,
  stop_lat double precision,
  stop_lon double precision,
  zone_id text,
  stop_url text,
  location_type integer,
  parent_station text,
  wheelchair_boarding integer,
  stop_code text,
  PRIMARY KEY (agency_id, stop_id)
);
ALTER TABLE public.gtfs_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_stops" ON public.gtfs_stops FOR SELECT USING (true);

-- GTFS Trips
CREATE TABLE public.gtfs_trips (
  agency_id text NOT NULL,
  trip_id text NOT NULL,
  route_id text NOT NULL,
  service_id text NOT NULL,
  trip_headsign text,
  trip_short_name text,
  direction_id integer,
  block_id text,
  shape_id text,
  wheelchair_accessible integer,
  bikes_allowed integer,
  route_variant text,
  PRIMARY KEY (agency_id, trip_id)
);
ALTER TABLE public.gtfs_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_trips" ON public.gtfs_trips FOR SELECT USING (true);

-- GTFS Stop Times
CREATE TABLE public.gtfs_stop_times (
  agency_id text NOT NULL,
  trip_id text NOT NULL,
  stop_id text NOT NULL,
  stop_sequence integer NOT NULL,
  arrival_time text,
  departure_time text,
  pickup_type integer,
  drop_off_type integer,
  timepoint integer,
  PRIMARY KEY (agency_id, trip_id, stop_sequence)
);
ALTER TABLE public.gtfs_stop_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_stop_times" ON public.gtfs_stop_times FOR SELECT USING (true);

-- GTFS Shapes
CREATE TABLE public.gtfs_shapes (
  agency_id text NOT NULL,
  shape_id text NOT NULL,
  shape_pt_lat double precision NOT NULL,
  shape_pt_lon double precision NOT NULL,
  shape_pt_sequence integer NOT NULL,
  PRIMARY KEY (agency_id, shape_id, shape_pt_sequence)
);
ALTER TABLE public.gtfs_shapes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_shapes" ON public.gtfs_shapes FOR SELECT USING (true);

-- GTFS Transfers
CREATE TABLE public.gtfs_transfers (
  agency_id text NOT NULL,
  from_stop_id text NOT NULL,
  to_stop_id text NOT NULL,
  transfer_type integer,
  min_transfer_time integer,
  PRIMARY KEY (agency_id, from_stop_id, to_stop_id)
);
ALTER TABLE public.gtfs_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_transfers" ON public.gtfs_transfers FOR SELECT USING (true);

-- GTFS Fare Attributes
CREATE TABLE public.gtfs_fare_attributes (
  agency_id text NOT NULL,
  fare_id text NOT NULL,
  price numeric,
  currency_type text,
  payment_method integer,
  transfers integer,
  PRIMARY KEY (agency_id, fare_id)
);
ALTER TABLE public.gtfs_fare_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_fare_attributes" ON public.gtfs_fare_attributes FOR SELECT USING (true);

-- GTFS Fare Rules
CREATE TABLE public.gtfs_fare_rules (
  agency_id text NOT NULL,
  fare_id text NOT NULL,
  origin_id text NOT NULL DEFAULT '',
  destination_id text NOT NULL DEFAULT '',
  PRIMARY KEY (agency_id, fare_id, origin_id, destination_id)
);
ALTER TABLE public.gtfs_fare_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_fare_rules" ON public.gtfs_fare_rules FOR SELECT USING (true);

-- GTFS Feed Info
CREATE TABLE public.gtfs_feed_info (
  agency_id text PRIMARY KEY,
  feed_publisher_name text,
  feed_publisher_url text,
  feed_lang text,
  feed_start_date text,
  feed_end_date text,
  feed_version text
);
ALTER TABLE public.gtfs_feed_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gtfs_feed_info" ON public.gtfs_feed_info FOR SELECT USING (true);

-- Add indexes for common queries
CREATE INDEX idx_gtfs_stop_times_trip ON public.gtfs_stop_times (agency_id, trip_id);
CREATE INDEX idx_gtfs_stop_times_stop ON public.gtfs_stop_times (agency_id, stop_id);
CREATE INDEX idx_gtfs_trips_route ON public.gtfs_trips (agency_id, route_id);
CREATE INDEX idx_gtfs_trips_service ON public.gtfs_trips (agency_id, service_id);
CREATE INDEX idx_gtfs_shapes_shape ON public.gtfs_shapes (agency_id, shape_id);
CREATE INDEX idx_gtfs_sync_status_agency ON public.gtfs_sync_status (agency_id, file_type);
