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
