// Hand-written types mirroring supabase/migrations/20260707000000_init.sql.
// If you change the schema, update this file (or regenerate with:
//   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// once your Supabase project is live).

export type UserRole = "admin" | "receptionist";
export type StaffStatus = "active" | "disabled";
export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";
export type BookingSource = "walk_in" | "phone" | "whatsapp" | "website" | "booking_com" | "airbnb";
export type PaymentMethod = "cash" | "esewa" | "khalti" | "bank_transfer";
export type PaymentStatus = "paid" | "partial" | "unpaid";
export type BookingStatus = "pending_approval" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "rejected";
export type TransactionType = "advance" | "partial" | "final" | "refund";
export type PricingMethod = "daily" | "monthly";

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  phone: string | null;
  role: UserRole;
  status: StaffStatus;
  created_by: string | null;
  created_at: string;
}

export interface Guest {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  passport_number: string | null;
  guest_count: number;
  notes: string | null;
  id_document_path: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: RoomStatus;
  image_url: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  guest_id: string;
  room_id: string;
  guest_count: number;
  check_in: string;
  check_out: string;
  nights: number;
  total_amount: number;
  advance_paid: number;
  remaining_balance: number;
  /** Informational line-item, not netted into total_amount automatically. */
  discount: number;
  /** Informational line-item, not netted into total_amount automatically. */
  tax: number;
  booking_source: BookingSource;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  pricing_method: PricingMethod | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Return shape of the shared public.calculate_booking_price() RPC — the
 *  single place daily-vs-monthly pricing is decided, called by both this
 *  dashboard and the guest website. */
export interface BookingPriceQuote {
  nights: number;
  pricing_method: PricingMethod;
  daily_rate: number;
  monthly_rate: number | null;
  /** Monthly rate ÷ 30, rounded to 2 decimals — what's actually charged per
   *  night once a stay hits the long-stay threshold. Prorated, not a flat
   *  monthly fee, so a 45-night stay costs more than a 30-night one. */
  long_term_daily_rate: number | null;
  total_amount: number;
}

export interface PricingSettingsRow {
  room_type_key: "single" | "double" | "family";
  monthly_rate: number;
  updated_at: string;
}

export interface PricingConfigRow {
  id: true;
  long_stay_threshold_nights: number;
  updated_at: string;
}

export interface Transaction {
  id: string;
  booking_id: string;
  guest_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  transaction_type: TransactionType;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type ServiceStatus = "active" | "inactive";

export interface Service {
  id: string;
  name: string;
  price: number;
  status: ServiceStatus;
  created_at: string;
}

export interface BookingService {
  id: string;
  booking_id: string;
  service_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  created_at: string;
}

export interface BookingWithRelations extends Booking {
  guest: Guest;
  room: Room;
}

export interface TransactionWithRelations extends Transaction {
  booking: Pick<Booking, "id" | "booking_number"> | null;
  guest: Pick<Guest, "id" | "full_name"> | null;
}

export interface AuthCode {
  id: string;
  code: string;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  booking_id: string | null;
  performed_by: string | null;
  admin_id: string | null;
  auth_code_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export type ExpensePaymentMethod = "cash" | "bank_transfer" | "online_payment";
export type ExpenseStatus = "paid" | "pending";
export type ExpensePriority = "low" | "medium" | "high";
export type RecurrenceInterval = "weekly" | "monthly" | "yearly";

export interface ExpenseCategory {
  id: string;
  name: string;
  is_default: boolean;
  /** Null = no budget set for this category (not the same as a 0 budget). */
  monthly_budget: number | null;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  title: string;
  category_id: string;
  amount: number;
  date: string;
  payment_method: ExpensePaymentMethod;
  paid_by: string | null;
  description: string | null;
  receipt_url: string | null;
  status: ExpenseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithCategory extends Expense {
  category: Pick<ExpenseCategory, "id" | "name"> | null;
}

export interface ExpenseReminder {
  id: string;
  title: string;
  due_date: string | null;
  amount: number | null;
  priority: ExpensePriority;
  is_completed: boolean;
  completed_at: string | null;
  is_recurring: boolean;
  recurrence_interval: RecurrenceInterval | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Minimal Supabase `Database` generic used by the typed client.
// Kept loose (not table-by-table) so the app compiles without the CLI-generated file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
