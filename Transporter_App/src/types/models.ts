export interface Transporter {
  transporter_id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string;
  license_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface TransportJob {
  job_id: string;
  harvest_id: string;
  transporter_id: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  pickup_location: string;
  delivery_location: string;
  scheduled_pickup_time: string;
  actual_pickup_time: string | null;
  scheduled_delivery_time: string;
  actual_delivery_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface GPSLog {
  log_id: string;
  job_id: string;
  transporter_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: string;
  created_at: string;
}

export interface DeliveryReceipt {
  receipt_id: string;
  job_id: string;
  transporter_id: string;
  photo_url: string;
  received_by: string;
  notes: string | null;
  signature_data: string | null; // Base64 encoded signature
  created_at: string;
}

export interface QRScanResult {
  harvest_uuid: string;
  timestamp: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Form types
export interface TransporterRegistrationForm {
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string;
  license_id: string;
}

// Add this to your existing types/models.ts
export type RootStackParamList = {
  Welcome: undefined;
  Register: undefined;
  Main: undefined;
  JobDetails: { jobId: string };
  ReceiptUpload: { jobId: string };
  Scanner: undefined;
  DashboardTab: { jobId?: string }; // FIX: Added DashboardTab type
  ActiveJobTab: { jobId?: string };
}


