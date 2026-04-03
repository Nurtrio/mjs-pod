export interface Driver {
  id: string;
  name: string;
  pin: string | null;
  active: boolean;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_address: string | null;
  pdf_storage_path: string | null;
  status: 'unassigned' | 'assigned' | 'in_progress' | 'delivered';
  created_at: string;
  uploaded_by: string | null;
}

export interface Route {
  id: string;
  driver_id: string;
  route_date: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  driver?: Driver;
  stops?: RouteStop[];
}

export interface RouteStop {
  id: string;
  route_id: string;
  invoice_id: string;
  stop_order: number;
  status: 'pending' | 'completed' | 'skipped';
  signature_storage_path: string | null;
  photo_storage_path: string | null;
  pod_pdf_storage_path: string | null;
  google_drive_file_id: string | null;
  completed_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  notes: string | null;
  invoice?: Invoice;
}

export interface RouteWithDetails extends Route {
  driver: Driver;
  stops: (RouteStop & { invoice: Invoice })[];
}
