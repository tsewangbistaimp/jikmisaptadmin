import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Textarea, Select, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { bookingFormSchema, type BookingFormValues } from "@/lib/schemas";
import { BOOKING_SOURCE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, nightsBetween, todayISO } from "@/lib/utils";
import { paymentStatusTone } from "@/lib/badge-tones";
import type { Guest, Room } from "@/lib/database.types";

export default function NewBooking() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [matchingGuest, setMatchingGuest] = React.useState<Guest | null>(null);
  const [usingExistingGuest, setUsingExistingGuest] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      guest_count: 1,
      check_in: todayISO(),
      booking_source: "walk_in",
      total_amount: 0,
      advance_paid: 0,
    },
  });

  React.useEffect(() => {
    supabase
      .from("rooms")
      .select("*")
      .order("room_number")
      .then(({ data }) => setRooms((data as Room[]) ?? []));
  }, []);

  const phone = watch("phone");
  const checkIn = watch("check_in");
  const checkOut = watch("check_out");
  const roomId = watch("room_id");
  const totalAmount = Number(watch("total_amount")) || 0;
  const advancePaid = Number(watch("advance_paid")) || 0;

  const nights = nightsBetween(checkIn, checkOut);
  const remaining = Math.max(totalAmount - advancePaid, 0);
  const paymentStatus = advancePaid <= 0 ? "unpaid" : advancePaid >= totalAmount && totalAmount > 0 ? "paid" : "partial";

  // Look up existing guest by phone as the receptionist types
  React.useEffect(() => {
    const p = phone?.trim();
    if (!p || p.length < 7) {
      setMatchingGuest(null);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.from("guests").select("*").eq("phone", p).limit(1).maybeSingle();
      setMatchingGuest((data as Guest) ?? null);
    }, 350);
    return () => clearTimeout(t);
  }, [phone]);

  // Auto-fill price from selected room * nights (still editable)
  React.useEffect(() => {
    const room = rooms.find((r) => r.id === roomId);
    if (room && nights > 0) {
      setValue("total_amount", room.price * nights);
    }
  }, [roomId, nights, rooms, setValue]);

  const applyExistingGuest = () => {
    if (!matchingGuest) return;
    setValue("full_name", matchingGuest.full_name);
    setValue("nationality", matchingGuest.nationality ?? "");
    setValue("passport_number", matchingGuest.passport_number ?? "");
    setUsingExistingGuest(true);
    toast.success("Loaded existing guest details");
  };

  const onSubmit = async (values: BookingFormValues) => {
    try {
      // 1. Reuse or create guest
      let guestId = usingExistingGuest && matchingGuest ? matchingGuest.id : null;

      if (!guestId) {
        const { data: existing } = await supabase
          .from("guests")
          .select("id")
          .eq("phone", values.phone)
          .limit(1)
          .maybeSingle();

        if (existing) {
          guestId = existing.id;
          await supabase
            .from("guests")
            .update({
              full_name: values.full_name,
              nationality: values.nationality || null,
              passport_number: values.passport_number || null,
              guest_count: values.guest_count,
            })
            .eq("id", existing.id);
        } else {
          const { data: newGuest, error: guestError } = await supabase
            .from("guests")
            .insert({
              full_name: values.full_name,
              phone: values.phone,
              nationality: values.nationality || null,
              passport_number: values.passport_number || null,
              guest_count: values.guest_count,
            })
            .select("id")
            .single();
          if (guestError) throw guestError;
          guestId = newGuest.id;
        }
      }

      // 2. Create booking
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          guest_id: guestId,
          room_id: values.room_id,
          guest_count: values.guest_count,
          check_in: values.check_in,
          check_out: values.check_out,
          total_amount: values.total_amount,
          advance_paid: values.advance_paid,
          booking_source: values.booking_source,
          payment_method: values.payment_method || null,
          payment_status: paymentStatus,
          notes: values.notes || null,
          created_by: profile?.id ?? null,
        })
        .select("id, booking_number")
        .single();

      if (bookingError) {
        if (bookingError.message?.toLowerCase().includes("overlap") || bookingError.code === "23P01") {
          throw new Error("This room is already booked for the selected dates.");
        }
        throw bookingError;
      }

      // 3. Record initial payment as a transaction
      if (values.advance_paid > 0 && values.payment_method) {
        const { error: txError } = await supabase.from("transactions").insert({
          booking_id: booking.id,
          guest_id: guestId,
          amount: values.advance_paid,
          payment_method: values.payment_method,
          transaction_type: "advance",
          notes: "Advance payment at booking",
          created_by: profile?.id ?? null,
        });
        if (txError) throw txError;
      }

      // 4. Mark room occupied
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", values.room_id);

      toast.success(`Booking ${booking.booking_number} saved`);
      reset();
      navigate("/bookings");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save booking");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Booking</h1>
        <p className="text-sm text-slate-500">Complete a booking in under 2 minutes.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Guest Information</CardTitle>
            <CardDescription>Who is staying with us?</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" {...register("phone")} placeholder="98XXXXXXXX" error={errors.phone?.message} />
              <FieldError message={errors.phone?.message} />
              {matchingGuest && !usingExistingGuest && (
                <button
                  type="button"
                  onClick={applyExistingGuest}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Found existing guest "{matchingGuest.full_name}" — click to reuse their details
                </button>
              )}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register("full_name")} placeholder="Guest full name" error={errors.full_name?.message} />
              <FieldError message={errors.full_name?.message} />
            </div>

            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" {...register("nationality")} placeholder="e.g. Nepali" />
            </div>

            <div>
              <Label htmlFor="passport_number">Passport / ID Number (Optional)</Label>
              <Input id="passport_number" {...register("passport_number")} placeholder="Optional" />
            </div>

            <div>
              <Label htmlFor="guest_count">Number of Guests</Label>
              <Input id="guest_count" type="number" min={1} {...register("guest_count", { valueAsNumber: true })} error={errors.guest_count?.message} />
              <FieldError message={errors.guest_count?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Information</CardTitle>
            <CardDescription>Room and stay details.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="room_id">Room</Label>
              <Select id="room_id" {...register("room_id")} error={errors.room_id?.message}>
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status !== "available"}>
                    {r.room_number} · {r.room_type} · {formatCurrency(r.price)}/night
                    {r.status !== "available" ? ` (${r.status})` : ""}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.room_id?.message} />
            </div>

            <div>
              <Label htmlFor="check_in">Check-in Date</Label>
              <Input id="check_in" type="date" {...register("check_in")} error={errors.check_in?.message} />
              <FieldError message={errors.check_in?.message} />
            </div>
            <div>
              <Label htmlFor="check_out">Check-out Date</Label>
              <Input id="check_out" type="date" {...register("check_out")} error={errors.check_out?.message} />
              <FieldError message={errors.check_out?.message} />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium">{nights}</span> night{nights === 1 ? "" : "s"}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="booking_source">Booking Source</Label>
              <Select id="booking_source" {...register("booking_source")}>
                {Object.entries(BOOKING_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="notes">Special Notes</Label>
              <Textarea id="notes" {...register("notes")} placeholder="Any special requests…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
            <CardDescription>Balance and payment status are calculated automatically.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="total_amount">Total Amount</Label>
              <Input id="total_amount" type="number" min={0} step="0.01" {...register("total_amount", { valueAsNumber: true })} error={errors.total_amount?.message} />
              <FieldError message={errors.total_amount?.message} />
            </div>
            <div>
              <Label htmlFor="advance_paid">Advance Paid</Label>
              <Input id="advance_paid" type="number" min={0} step="0.01" {...register("advance_paid", { valueAsNumber: true })} error={errors.advance_paid?.message} />
              <FieldError message={errors.advance_paid?.message} />
            </div>

            <div>
              <Label htmlFor="payment_method">Payment Method</Label>
              <Controller
                control={control}
                name="payment_method"
                render={({ field }) => (
                  <Select id="payment_method" {...field} value={field.value ?? ""} error={errors.payment_method?.message}>
                    <option value="">Select method</option>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              />
              <FieldError message={errors.payment_method?.message} />
            </div>

            <div>
              <Label>Payment Status</Label>
              <div className="flex h-10 items-center">
                <Badge tone={paymentStatusTone(paymentStatus)} className="capitalize">
                  {paymentStatus}
                </Badge>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">Remaining Balance</span>
              <span className="text-lg font-semibold text-slate-900">{formatCurrency(remaining)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save Booking
          </Button>
        </div>
      </form>
    </div>
  );
}
