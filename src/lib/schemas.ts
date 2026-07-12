import { z } from "zod";

export const bookingFormSchema = z
  .object({
    // Guest information
    full_name: z.string().trim().min(2, "Guest name is required"),
    phone: z
      .string()
      .trim()
      .min(7, "Enter a valid phone number")
      .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number"),
    nationality: z.string().trim().optional(),
    passport_number: z.string().trim().optional(),
    guest_count: z.number().int().min(1, "At least 1 guest"),

    // Booking information
    room_id: z.string().min(1, "Select a room"),
    check_in: z.string().min(1, "Check-in date is required"),
    check_out: z.string().min(1, "Check-out date is required"),
    booking_source: z.enum(["walk_in", "phone", "whatsapp", "website", "booking_com", "airbnb"]),
    notes: z.string().trim().optional(),

    // Payment information
    total_amount: z.number().min(0, "Total amount can't be negative"),
    advance_paid: z.number().min(0, "Advance paid can't be negative"),
    payment_method: z.enum(["cash", "esewa", "khalti", "bank_transfer"]).optional(),
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  })
  // Note: advance_paid vs. grand total (room + add-ons) is validated in
  // NewBooking.tsx's onSubmit, since add-ons live outside this form schema.
  .refine((data) => data.advance_paid <= 0 || !!data.payment_method, {
    message: "Select a payment method",
    path: ["payment_method"],
  });

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export const roomFormSchema = z.object({
  room_number: z.string().trim().min(1, "Room number is required"),
  room_type: z.string().trim().min(1, "Room type is required"),
  price: z.number().min(0, "Price can't be negative"),
  status: z.enum(["available", "occupied", "cleaning", "maintenance"]),
});

export type RoomFormValues = z.infer<typeof roomFormSchema>;

export const staffFormSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-z0-9._-]+$/i, "Letters, numbers, dots, dashes and underscores only"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "receptionist"]),
});

export type StaffFormValues = z.infer<typeof staffFormSchema>;

export const expenseFormSchema = z.object({
  title: z.string().trim().min(2, "Expense title is required"),
  category_id: z.string().min(1, "Select a category"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  payment_method: z.enum(["cash", "bank_transfer", "online_payment"]),
  paid_by: z.string().trim().optional(),
  description: z.string().trim().optional(),
  status: z.enum(["paid", "pending"]),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const reminderFormSchema = z.object({
  title: z.string().trim().min(2, "Reminder title is required"),
  due_date: z.string().trim().optional(),
  amount: z.number().min(0, "Amount can't be negative").optional(),
  priority: z.enum(["low", "medium", "high"]),
});

export type ReminderFormValues = z.infer<typeof reminderFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, "Category name is required"),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const guestFormSchema = z.object({
  full_name: z.string().trim().min(2, "Guest name is required"),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .regex(/^[0-9+\-\s()]+$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  nationality: z.string().trim().optional(),
  passport_number: z.string().trim().optional(),
  guest_count: z.number().int().min(1, "At least 1 guest"),
  notes: z.string().trim().optional(),
});

export type GuestFormValues = z.infer<typeof guestFormSchema>;
