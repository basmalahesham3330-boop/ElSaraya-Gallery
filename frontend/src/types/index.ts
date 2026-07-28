// Type definitions for Gallery ERP Frontend

export interface Customer {
  id: string;
  full_name: string;
  phone_number: string;
  alternative_phone?: string;
  city?: string;
  governorate?: string;
  address?: string;
  location_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  quotation_date: string;
  status: QuotationStatus;
  total_price: string;
  discount: string;
  final_price: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: QuotationItem[];
}

export type QuotationStatus =
  | 'draft'
  | 'waiting_for_measurement'
  | 'measured'
  | 'under_negotiation'
  | 'sent'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface Job {
  id: string;
  quotation_id: string;
  status: JobStatus;
  measurement_date?: string;
  production_start?: string;
  production_end?: string;
  installation_date?: string;
  delivery_date?: string;
  completion_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type JobStatus =
  | 'pending'
  | 'measuring'
  | 'in_production'
  | 'ready_for_installation'
  | 'installed'
  | 'completed'
  | 'cancelled';

export interface Measurement {
  id: string;
  job_id: string;
  measurement_number: number;
  visit_date?: string;
  measured_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface MeasurementItem {
  id: string;
  measurement_id: string;
  quotation_item_id: string;
  room_name?: string;
  piece_number?: string;
  width?: string;
  height?: string;
  quantity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  job_id: string;
  action: string;
  description: string;
  created_at: string;
}

export interface Payment {
  id: string;
  job_id: string;
  payment_order: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  percentage: string;
  amount: string;
  due_date?: string;
  paid_date?: string;
  status: PaymentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type PaymentType =
  | 'deposit'
  | 'production'
  | 'final';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'instapay'
  | 'cheque'
  | 'other';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface QuotationWithJobResponse {
  quotation: Quotation;
  job: Job | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
