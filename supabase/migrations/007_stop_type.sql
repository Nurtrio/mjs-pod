-- Add stop_type to route_stops (delivery vs pickup)
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS stop_type TEXT DEFAULT 'delivery' CHECK (stop_type IN ('delivery', 'pickup'));

-- Add stop_type to invoices so we know at upload time
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'delivery' CHECK (ticket_type IN ('delivery', 'pickup'));

CREATE INDEX IF NOT EXISTS idx_route_stops_type ON route_stops(stop_type);
