-- Add tracking_token to route_stops for delivery tracking integration with 714supply.com
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS tracking_token TEXT;

-- Add customer_email to invoices for delivery notification emails
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_email TEXT;
