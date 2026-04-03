-- MJS POD System Schema

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pin TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  customer_name TEXT,
  customer_address TEXT,
  pdf_storage_path TEXT,
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'assigned', 'in_progress', 'delivered')),
  created_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by TEXT
);

-- Routes table
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  route_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Route stops
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  stop_order INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  signature_storage_path TEXT,
  photo_storage_path TEXT,
  pod_pdf_storage_path TEXT,
  google_drive_file_id TEXT,
  completed_at TIMESTAMPTZ,
  gps_lat DECIMAL,
  gps_lng DECIMAL,
  notes TEXT
);

-- Seed default drivers
INSERT INTO drivers (name, pin) VALUES
  ('Erik', '1111'),
  ('Jose', '2222'),
  ('Tommy', '3333'),
  ('David', '4444'),
  ('Ryan', '5555');

-- Create storage buckets (run via Supabase dashboard or API):
-- 1. 'invoices' - for uploaded invoice PDFs
-- 2. 'signatures' - for signature PNGs
-- 3. 'photos' - for delivery photos
-- 4. 'pods' - for composite POD PDFs

-- Indexes
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_routes_date ON routes(route_date);
CREATE INDEX idx_routes_driver ON routes(driver_id);
CREATE INDEX idx_route_stops_route ON route_stops(route_id);
CREATE INDEX idx_route_stops_invoice ON route_stops(invoice_id);
