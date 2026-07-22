-- Add separate storage paths for invoice ticket photo and product photos
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS invoice_photo_storage_path TEXT;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS product_photo_storage_paths TEXT[];
