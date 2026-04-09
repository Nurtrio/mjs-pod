-- Enable Supabase Realtime on route_stops table for live driver notifications
ALTER PUBLICATION supabase_realtime ADD TABLE route_stops;
