DROP FUNCTION IF EXISTS public.get_route_shapes();

CREATE FUNCTION public.get_route_shapes()
 RETURNS TABLE(agency_id text, route_id text, coords jsonb, route_color text, route_type integer, route_long_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH representative AS (
    SELECT DISTINCT ON (t.agency_id, t.route_id)
      t.agency_id, t.route_id, t.shape_id
    FROM gtfs_trips t
    WHERE t.shape_id IS NOT NULL
    ORDER BY t.agency_id, t.route_id, t.shape_id
  )
  SELECT 
    r.agency_id,
    r.route_id,
    jsonb_agg(
      jsonb_build_array(s.shape_pt_lat, s.shape_pt_lon)
      ORDER BY s.shape_pt_sequence
    ) AS coords,
    rt.route_color,
    rt.route_type,
    rt.route_long_name
  FROM representative r
  JOIN gtfs_shapes s ON s.shape_id = r.shape_id AND s.agency_id = r.agency_id
  LEFT JOIN gtfs_routes rt ON rt.route_id = r.route_id AND rt.agency_id = r.agency_id
  GROUP BY r.agency_id, r.route_id, rt.route_color, rt.route_type, rt.route_long_name;
$$;