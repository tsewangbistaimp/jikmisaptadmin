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
export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";
export type TransactionType = "advance" | "partial" | "final" | "refund";

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
  created_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: RoomStatus;
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
  booking_source: BookingSource;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
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

export interface BookingWithRelations extends Booking {
  guest: Guest;
  room: Room;
}

export interface TransactionWithRelations extends Transaction {
  booking: Pick<Booking, "id" | "booking_number"> | null;
  guest: Pick<Guest, "id" | "full_name"> | null;
}

// Minimal Supabase `Database` generic used by the typed client.
// Kept loose (not table-by-table) so the app compiles without the CLI-generated file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
