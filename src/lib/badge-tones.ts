import type { BookingStatus, ExpensePriority, ExpenseStatus, PaymentStatus, RoomStatus } from "@/lib/database.types";

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

export function expenseStatusTone(status: ExpenseStatus) {
  switch (status) {
    case "paid":
      return "green" as const;
    default:
      return "amber" as const;
  }
}

export function expensePriorityTone(priority: ExpensePriority) {
  switch (priority) {
    case "high":
      return "red" as const;
    case "medium":
      return "blue" as const;
    default:
      return "slate" as const;
  }
}
