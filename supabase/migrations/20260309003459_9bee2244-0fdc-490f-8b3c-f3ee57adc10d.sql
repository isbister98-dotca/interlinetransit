CREATE INDEX IF NOT EXISTS idx_stop_times_lookup 
ON gtfs_stop_times (agency_id, stop_id, departure_time);