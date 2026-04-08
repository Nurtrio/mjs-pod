-- Add backorder_notes column to route_stops
-- Separate from general notes so backorders can be flagged and tracked
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS backorder_notes TEXT;

-- Index for quickly finding stops with backorders
CREATE INDEX IF NOT EXISTS idx_route_stops_backorder
  ON route_stops (route_id)
  WHERE backorder_notes IS NOT NULL AND backorder_notes != '';
