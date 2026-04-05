-- GPS location history (all pings, pruned periodically)
CREATE TABLE driver_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  lat DECIMAL NOT NULL,
  lng DECIMAL NOT NULL,
  heading DECIMAL,
  speed DECIMAL,
  accuracy DECIMAL,
  is_stationary BOOLEAN DEFAULT false,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_location_history_driver ON driver_location_history(driver_id);
CREATE INDEX idx_location_history_time ON driver_location_history(recorded_at DESC);
CREATE INDEX idx_location_history_driver_time ON driver_location_history(driver_id, recorded_at DESC);

-- Add arrival/departure tracking to route_stops
ALTER TABLE route_stops ADD COLUMN arrived_at TIMESTAMPTZ;
ALTER TABLE route_stops ADD COLUMN departed_at TIMESTAMPTZ;
ALTER TABLE route_stops ADD COLUMN dwell_seconds INTEGER;

-- RLS
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on driver_location_history" ON driver_location_history FOR ALL USING (true) WITH CHECK (true);

-- Auto-cleanup: delete history older than 48 hours (run via cron or pg_cron)
-- For now, manual cleanup can be done with:
-- DELETE FROM driver_location_history WHERE recorded_at < now() - interval '48 hours';
