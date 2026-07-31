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
  confirmed: "Confirmed",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  cancelled: "Cancelled",
};

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
