import type { BookingStatus, PaymentStatus, RoomStatus } from "@/lib/database.types";

export function paymentStatusTone(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "green" as const;
    case "partial":
      return "amber" as const;
    default:
      return "red" as const;
  }
}

export function bookingStatusTone(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "blue" as const;
    case "checked_in":
      return "green" as const;
    case "checked_out":
      return "slate" as const;
    default:
      return "red" as const;
  }
}

export function roomStatusTone(status: RoomStatus) {
  switch (status) {
    case "available":
      return "green" as const;
    case "occupied":
      return "amber" as const;
    case "cleaning":
      return "blue" as const;
    default:
      return "red" as const;
  }
}
