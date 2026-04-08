-- Activity log for real-time feed on dashboard
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  driver_name text NOT NULL,
  event_type text NOT NULL, -- arrived, photo_captured, signature_confirmed, pod_submitted, delivery_completed, route_completed
  stop_id uuid REFERENCES route_stops(id) ON DELETE SET NULL,
  customer_name text,
  invoice_number text,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_driver ON activity_log(driver_id);

-- Enable realtime for live feed
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
