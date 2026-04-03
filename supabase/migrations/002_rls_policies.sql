-- Enable RLS on all tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- For this internal business app, allow full access for authenticated and anon roles
-- (This is a private internal tool, not a public-facing app)

-- Drivers: read-only for anon
CREATE POLICY "Allow read drivers" ON drivers FOR SELECT USING (true);

-- Invoices: full access
CREATE POLICY "Allow read invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Allow insert invoices" ON invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update invoices" ON invoices FOR UPDATE USING (true);
CREATE POLICY "Allow delete invoices" ON invoices FOR DELETE USING (true);

-- Routes: full access
CREATE POLICY "Allow read routes" ON routes FOR SELECT USING (true);
CREATE POLICY "Allow insert routes" ON routes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update routes" ON routes FOR UPDATE USING (true);
CREATE POLICY "Allow delete routes" ON routes FOR DELETE USING (true);

-- Route stops: full access
CREATE POLICY "Allow read route_stops" ON route_stops FOR SELECT USING (true);
CREATE POLICY "Allow insert route_stops" ON route_stops FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update route_stops" ON route_stops FOR UPDATE USING (true);
CREATE POLICY "Allow delete route_stops" ON route_stops FOR DELETE USING (true);
