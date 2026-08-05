export const BOOKING_SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  website: "Website",
  booking_com: "Booking.com",
  airbnb: "Airbnb",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
  bank_transfer: "Bank Transfer",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  payment_under_review: "Payment Under Review",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  cancelled: "Cancelled",
  rejected: "Rejected",
  expired: "Expired",
};

export const PRICING_METHOD_LABELS: Record<string, string> = {
  daily: "Daily Rate",
  monthly: "Monthly Apartment Rate",
};

export const REJECTION_REASON_PRESETS = [
  "Room unavailable",
  "Maintenance",
  "Fully booked",
  "Invalid guest information",
  "Other",
];

export const ROOM_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

// Statuses an admin can manually set on a room. "Occupied" is deliberately
// excluded — whether a room is occupied is always calculated live from
// booking dates, never set by hand, so it shouldn't be a choice here.
export const ADMIN_ROOM_STATUS_OPTIONS: Record<string, string> = {
  available: "Available",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  online_payment: "Online Payment",
};

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
};

export const EXPENSE_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** Category names to spotlight in the Expenses page's "Utility Tracking"
 *  section — matches the default categories seeded in
 *  20260711040000_expenses.sql. Any category not in this list (custom
 *  ones admins add) simply won't appear there, which is intentional:
 *  this section is specifically about recurring utility-style bills. */
export const UTILITY_CATEGORY_NAMES = [
  "Electricity Bill",
  "Water Bill",
  "Internet/WiFi Bill",
  "Gas Bill",
  "Maintenance & Repair",
  "Cleaning Supplies",
  "Staff Salary",
  "Other Expenses",
];

/** Human-readable labels for audit_logs.action, written by the triggers in
 *  20260801050000_audit_log_triggers.sql / 20260801060000_audit_log_login_trigger.sql
 *  plus the pre-existing 'delete_booking' action from delete_booking_with_code(). */
export const ACTIVITY_LOG_LABELS: Record<string, string> = {
  delete_booking: "Deleted booking",
  payment: "Payment recorded",
  refund: "Refund issued",
  booking_insert: "Booking created",
  booking_update: "Booking updated",
  booking_approved: "Online booking approved",
  booking_rejected: "Online booking rejected",
  expenses_insert: "Expense added",
  expenses_update: "Expense updated",
  expenses_deleted: "Expense deleted",
  rooms_insert: "Room added",
  rooms_update: "Room updated",
  rooms_deleted: "Room deleted",
  guests_insert: "Guest created",
  guests_update: "Guest updated",
  profiles_insert: "Staff account created",
  profiles_update: "Staff account updated",
  profiles_deleted: "Staff account deleted",
  login: "Signed in",
};

/** Grouping used by the Activity Log filter dropdown in settings/Users.tsx. */
export const ACTIVITY_LOG_FILTERS: { value: string; label: string; actions: string[] }[] = [
  { value: "all", label: "All Activity", actions: [] },
  { value: "payments", label: "Payments & Refunds", actions: ["payment", "refund"] },
  { value: "bookings", label: "Bookings", actions: ["booking_insert", "booking_update", "booking_approved", "booking_rejected", "delete_booking"] },
  { value: "expenses", label: "Expenses", actions: ["expenses_insert", "expenses_update", "expenses_deleted"] },
  { value: "rooms", label: "Rooms", actions: ["rooms_insert", "rooms_update", "rooms_deleted"] },
  { value: "guests", label: "Guests", actions: ["guests_insert", "guests_update"] },
  { value: "staff", label: "Staff Accounts", actions: ["profiles_insert", "profiles_update", "profiles_deleted"] },
  { value: "logins", label: "Login History", actions: ["login"] },
];
