
-- Add unique constraint on gtfs_sync_status for upsert support
ALTER TABLE public.gtfs_sync_status ADD CONSTRAINT gtfs_sync_status_agency_file_unique UNIQUE (agency_id, file_type);
