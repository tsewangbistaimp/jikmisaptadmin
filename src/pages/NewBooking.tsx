import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  UserCheck,
  Sparkles,
  Minus,
  Plus,
  X,
  PlusCircle,
  User,
  Phone,
  Globe,
  CreditCard,
  Users,
  BedDouble,
  CalendarDays,
  Tag,
  FileText,
  Wallet,
  ShieldCheck,
  Zap,
  DoorClosed,
  CalendarCheck,
  IdCard,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Input, Label, Textarea, Select, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { bookingFormSchema, type BookingFormValues } from "@/lib/schemas";
import { BOOKING_SOURCE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency, nightsBetween, todayISO, cn } from "@/lib/utils";
import { paymentStatusTone } from "@/lib/badge-tones";
import type { Guest, Room, Service } from "@/lib/database.types";

const FORM_ID = "new-booking-form";

function StepHeader({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <CardHeader className="flex-row items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
        {step}
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <CardDescription>{description}</CardDescription>
      </div>
    </CardHeader>
  );
}

function IconField({
  icon: Icon,
  align = "center",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  align?: "center" | "top";
  children: React.ReactElement<{ className?: string }>;
}) {
  return (
    <div className="relative">
      <Icon
        className={cn(
          "pointer-events-none absolute left-3 h-4 w-4 text-slate-400",
          align === "center" ? "top-1/2 -translate-y-1/2" : "top-3.5"
        )}
      />
      {React.cloneElement(children, {
        className: cn("pl-9", children.props.className),
      })}
    </div>
  );
}

export default function NewBooking() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [addOnQty, setAddOnQty] = React.useState<Record<string, number>>({});
  const [customItems, setCustomItems] = React.useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [addingCustom, setAddingCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customPrice, setCustomPrice] = React.useState("");
  const [customQty, setCustomQty] = React.useState("1");
  const [matchingGuest, setMatchingGuest] = React.useState<Guest | null>(null);
  const [usingExistingGuest, setUsingExistingGuest] = React.useState(false);
  const [bookedRoomIds, setBookedRoomIds] = React.useState<Set<string>>(new Set());
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);
  const [idDocPath, setIdDocPath] = React.useState<string | null>(null);
  const [idDocPreviewUrl, setIdDocPreviewUrl] = React.useState<string | null>(null);
  const [idDocUploading, setIdDocUploading] = React.useState(false);
  const idFileInputRef = React.useRef<HTMLInputElement>(null);

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
    supabase
      .from("services")
      .select("*")
      .eq("status", "active")
      .order("name")
      .then(({ data }) => setServices((data as Service[]) ?? []));
  }, []);

  const phone = watch("phone");
  const fullName = watch("full_name");
  const checkIn = watch("check_in");
  const checkOut = watch("check_out");
  const roomId = watch("room_id");
  const guestCount = Number(watch("guest_count")) || 1;
  const totalAmount = Number(watch("total_amount")) || 0;
  const advancePaid = Number(watch("advance_paid")) || 0;

  const nights = nightsBetween(checkIn, checkOut);
  const selectedRoom = rooms.find((r) => r.id === roomId);
  const servicesTotal = services.reduce((sum, s) => sum + s.price * (addOnQty[s.id] ?? 0), 0);
  const customTotal = customItems.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const addOnsTotal = servicesTotal + customTotal;
  const grandTotal = totalAmount + addOnsTotal;
  const remaining = Math.max(grandTotal - advancePaid, 0);
  const paymentStatus = advancePaid <= 0 ? "unpaid" : advancePaid >= grandTotal && grandTotal > 0 ? "paid" : "partial";

  const setQty = (serviceId: string, qty: number) => {
    setAddOnQty((prev) => ({ ...prev, [serviceId]: Math.max(0, qty) }));
  };

  const addCustomItem = () => {
    const name = customName.trim();
    const price = Number(customPrice);
    const qty = Math.max(1, Math.floor(Number(customQty)) || 1);
    if (!name) {
      toast.error("Enter a name for the item");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    setCustomItems((prev) => [...prev, { id: crypto.randomUUID(), name, price, quantity: qty }]);
    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
    setAddingCustom(false);
  };

  const removeCustomItem = (id: string) => {
    setCustomItems((prev) => prev.filter((c) => c.id !== id));
  };

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

  // Room availability is calculated live from actual booking dates — a room
  // is only unavailable if another confirmed/checked-in booking overlaps the
  // selected check-in/check-out range. We deliberately do NOT rely on a
  // static "occupied" flag on the room, since that can get stuck and block
  // future dates even after a guest has checked out.
  React.useEffect(() => {
    if (!checkIn || !checkOut || new Date(checkOut) <= new Date(checkIn)) {
      setBookedRoomIds(new Set());
      return;
    }
    let cancelled = false;
    setCheckingAvailability(true);
    supabase
      .from("bookings")
      .select("room_id")
      .in("booking_status", ["confirmed", "checked_in"])
      .lt("check_in", checkOut)
      .gt("check_out", checkIn)
      .then(({ data }) => {
        if (cancelled) return;
        setBookedRoomIds(new Set((data ?? []).map((b: { room_id: string }) => b.room_id)));
        setCheckingAvailability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut]);

  // If the currently selected room becomes unavailable because the dates
  // changed, clear the selection so the guest can't accidentally submit a
  // conflicting booking.
  React.useEffect(() => {
    if (roomId && bookedRoomIds.has(roomId)) {
      setValue("room_id", "");
      toast.error("That room is no longer available for the selected dates — please choose another.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedRoomIds]);

  const applyExistingGuest = async () => {
    if (!matchingGuest) return;
    setValue("full_name", matchingGuest.full_name);
    setValue("nationality", matchingGuest.nationality ?? "");
    setValue("passport_number", matchingGuest.passport_number ?? "");
    setUsingExistingGuest(true);
    setIdDocPath(matchingGuest.id_document_path ?? null);
    if (matchingGuest.id_document_path) {
      const { data } = await supabase.storage
        .from("guest-documents")
        .createSignedUrl(matchingGuest.id_document_path, 3600);
      setIdDocPreviewUrl(data?.signedUrl ?? null);
    } else {
      setIdDocPreviewUrl(null);
    }
    toast.success("Loaded existing guest details");
  };

  const handleIdDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be smaller than 8MB");
      return;
    }
    setIdDocUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("guest-documents").upload(path, file);
    setIdDocUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setIdDocPath(path);
    setIdDocPreviewUrl(URL.createObjectURL(file));
  };

  const onSubmit = async (values: BookingFormValues) => {
    if (values.advance_paid > grandTotal) {
      toast.error("Advance paid can't exceed the total amount (room + add-ons)");
      return;
    }

    // Defense in depth: re-check availability right before submitting, in
    // case another booking was created for this room/date range while this
    // form was open. The database's exclusion constraint is the ultimate
    // safety net (caught below), but this gives a faster, clearer error.
    const { data: conflicting } = await supabase
      .from("bookings")
      .select("id")
      .eq("room_id", values.room_id)
      .in("booking_status", ["confirmed", "checked_in"])
      .lt("check_in", values.check_out)
      .gt("check_out", values.check_in)
      .limit(1);
    if (conflicting && conflicting.length > 0) {
      toast.error("This room was just booked for an overlapping date range. Please pick another room or dates.");
      return;
    }

    try {
      // 1. Reuse or create guest
      let guestId = usingExistingGuest && matchingGuest ? matchingGuest.id : null;

      if (guestId && idDocPath && idDocPath !== (matchingGuest?.id_document_path ?? null)) {
        await supabase.from("guests").update({ id_document_path: idDocPath }).eq("id", guestId);
      }

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
              ...(idDocPath ? { id_document_path: idDocPath } : {}),
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
              id_document_path: idDocPath,
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
          total_amount: grandTotal,
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

      // 3. Attach any selected add-on services + manually added custom items
      const selectedAddOns = [
        ...services
          .filter((s) => (addOnQty[s.id] ?? 0) > 0)
          .map((s) => ({
            booking_id: booking.id,
            service_id: s.id,
            name: s.name,
            unit_price: s.price,
            quantity: addOnQty[s.id],
          })),
        ...customItems.map((c) => ({
          booking_id: booking.id,
          service_id: null,
          name: c.name,
          unit_price: c.price,
          quantity: c.quantity,
        })),
      ];
      if (selectedAddOns.length > 0) {
        const { error: addOnError } = await supabase.from("booking_services").insert(selectedAddOns);
        if (addOnError) throw addOnError;
      }

      // 4. Record initial payment as a transaction
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

      // Room occupancy is calculated from booking dates, not a manual
      // status flag — no need to mutate rooms.status here at all.

      toast.success(`Booking ${booking.booking_number} saved`);
      reset();
      setAddOnQty({});
      setCustomItems([]);
      setIdDocPath(null);
      setIdDocPreviewUrl(null);
      setUsingExistingGuest(false);
      navigate("/bookings");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save booking");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Booking</h1>
        <p className="text-sm text-slate-500">Create a new booking in just a few simple steps.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-6 lg:col-span-2">
        <Card>
          <StepHeader step={1} title="Guest Information" description="Information about your guest" />
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="phone">Phone Number</Label>
              <IconField icon={Phone}>
                <Input id="phone" {...register("phone")} placeholder="98XXXXXXXX" error={errors.phone?.message} />
              </IconField>
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
              <IconField icon={User}>
                <Input id="full_name" {...register("full_name")} placeholder="Enter guest full name" error={errors.full_name?.message} />
              </IconField>
              <FieldError message={errors.full_name?.message} />
            </div>

            <div>
              <Label htmlFor="nationality">Nationality</Label>
              <IconField icon={Globe}>
                <Input id="nationality" {...register("nationality")} placeholder="e.g. Nepali" />
              </IconField>
            </div>

            <div>
              <Label htmlFor="passport_number">Passport / ID Number (Optional)</Label>
              <IconField icon={CreditCard}>
                <Input id="passport_number" {...register("passport_number")} placeholder="Enter passport or ID number" />
              </IconField>
            </div>

            <div className="sm:col-span-2">
              <Label>Guest ID Photo (Optional)</Label>
              <input ref={idFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleIdDocChange} />
              {idDocPreviewUrl ? (
                <div className="relative flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                  <img src={idDocPreviewUrl} alt="Guest ID preview" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex-1 text-sm text-slate-600">Photo attached</div>
                  <button
                    type="button"
                    onClick={() => idFileInputRef.current?.click()}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdDocPath(null);
                      setIdDocPreviewUrl(null);
                    }}
                    aria-label="Remove ID photo"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => idFileInputRef.current?.click()}
                  disabled={idDocUploading}
                  className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-500"
                >
                  {idDocUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <span className="text-sm font-medium">
                    {idDocUploading ? "Uploading…" : "Upload a photo of the guest's ID or passport"}
                  </span>
                </button>
              )}
              <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                <IdCard className="h-3 w-3" /> Only staff can view this photo — it's never public.
              </p>
            </div>

            <div>
              <Label htmlFor="guest_count">Number of Guests</Label>
              <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 md:h-10">
                <Users className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 text-sm font-medium text-slate-700">{guestCount}</span>
                <button
                  type="button"
                  aria-label="Decrease guests"
                  onClick={() => setValue("guest_count", Math.max(1, guestCount - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Increase guests"
                  onClick={() => setValue("guest_count", guestCount + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <input type="hidden" {...register("guest_count", { valueAsNumber: true })} />
              <FieldError message={errors.guest_count?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <StepHeader step={2} title="Booking Information" description="Details about the stay" />
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="room_id">Room</Label>
              <IconField icon={BedDouble}>
                <Select id="room_id" {...register("room_id")} error={errors.room_id?.message}>
                  <option value="">{checkingAvailability ? "Checking availability…" : "Select a room"}</option>
                  {rooms.map((r) => {
                    const isMaintenance = r.status === "maintenance";
                    const isBooked = bookedRoomIds.has(r.id);
                    const unavailable = isMaintenance || isBooked;
                    return (
                      <option key={r.id} value={r.id} disabled={unavailable}>
                        {r.room_number} · {r.room_type} · {formatCurrency(r.price)}/night
                        {isMaintenance ? " (under maintenance)" : isBooked ? " (booked for these dates)" : ""}
                      </option>
                    );
                  })}
                </Select>
              </IconField>
              <FieldError message={errors.room_id?.message} />
              {!checkIn || !checkOut ? (
                <p className="mt-1.5 text-xs text-slate-400">Pick check-in and check-out dates to see which rooms are free.</p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-400">Showing availability for {formatDateShort(checkIn)} – {formatDateShort(checkOut)}.</p>
              )}
            </div>

            <div>
              <Label htmlFor="check_in">Check-in Date</Label>
              <IconField icon={CalendarDays}>
                <Input id="check_in" type="date" {...register("check_in")} error={errors.check_in?.message} />
              </IconField>
              <FieldError message={errors.check_in?.message} />
            </div>
            <div>
              <Label htmlFor="check_out">Check-out Date</Label>
              <IconField icon={CalendarDays}>
                <Input id="check_out" type="date" {...register("check_out")} error={errors.check_out?.message} />
              </IconField>
              <FieldError message={errors.check_out?.message} />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium">{nights}</span> night{nights === 1 ? "" : "s"}
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="booking_source">Booking Source</Label>
              <IconField icon={Tag}>
                <Select id="booking_source" {...register("booking_source")}>
                  {Object.entries(BOOKING_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </IconField>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="notes">Special Notes (Optional)</Label>
              <IconField icon={FileText} align="top">
                <Textarea id="notes" {...register("notes")} placeholder="Any special requests or notes…" />
              </IconField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <StepHeader step={3} title="Services & Add-ons" description="Laundry, breakfast, and other extras — optional" />
          <CardContent className="space-y-2">
            {services.map((s) => {
              const qty = addOnQty[s.id] ?? 0;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors",
                    qty > 0 ? "border-brand-200 bg-brand-50" : "border-slate-200 dark:border-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn("h-4 w-4", qty > 0 ? "text-brand-500" : "text-slate-300 dark:text-slate-600")} />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatCurrency(s.price)} each</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(s.id, qty - 1)}
                      disabled={qty === 0}
                      aria-label="Decrease quantity"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 md:h-7 md:w-7 dark:hover:bg-slate-800 disabled:opacity-30"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-medium text-slate-700 dark:text-slate-300">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(s.id, qty + 1)}
                      aria-label="Increase quantity"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 md:h-7 md:w-7 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {customItems.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {c.name} {c.quantity > 1 ? `× ${c.quantity}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatCurrency(c.price)} each · custom item
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(c.price * c.quantity)}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomItem(c.id)}
                    aria-label="Remove item"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-red-50 md:h-7 md:w-7 dark:bg-red-500/10 hover:text-red-500 dark:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {addingCustom ? (
              <div className="space-y-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input
                    placeholder="Item name (e.g. Extra towel)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="sm:col-span-1 col-span-2"
                    autoFocus
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Price"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="sm:w-28"
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="sm:w-20"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setAddingCustom(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={addCustomItem}>
                    Add Item
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustom(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-brand-300 hover:text-brand-600"
              >
                <PlusCircle className="h-4 w-4" />
                Add custom item
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <StepHeader step={4} title="Payment Information" description="Balance and payment status are calculated automatically" />
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="total_amount">Room Total</Label>
              <IconField icon={Wallet}>
                <Input id="total_amount" type="number" min={0} step="0.01" {...register("total_amount", { valueAsNumber: true })} error={errors.total_amount?.message} />
              </IconField>
              <FieldError message={errors.total_amount?.message} />
            </div>
            <div>
              <Label htmlFor="advance_paid">Advance Paid</Label>
              <IconField icon={Wallet}>
                <Input id="advance_paid" type="number" min={0} step="0.01" {...register("advance_paid", { valueAsNumber: true })} error={errors.advance_paid?.message} />
              </IconField>
              <FieldError message={errors.advance_paid?.message} />
            </div>

            <div>
              <Label htmlFor="payment_method">Payment Method</Label>
              <Controller
                control={control}
                name="payment_method"
                render={({ field }) => (
                  <IconField icon={CreditCard}>
                    <Select id="payment_method" {...field} value={field.value ?? ""} error={errors.payment_method?.message}>
                      <option value="">Select method</option>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </IconField>
                )}
              />
              <FieldError message={errors.payment_method?.message} />
            </div>

            <div>
              <Label>Payment Status</Label>
              <div className="flex h-12 items-center md:h-10">
                <Badge tone={paymentStatusTone(paymentStatus)} className="capitalize">
                  {paymentStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-8 lg:hidden">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save Booking
          </Button>
        </div>
        </form>

        {/* Booking summary sidebar */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
          <Card className="flex items-start gap-3 bg-brand-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Quick & Easy</p>
              <p className="text-xs text-slate-500">Complete a booking in under 2 minutes.</p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-5 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-900">Booking Summary</p>
              </div>
            </div>

            <div className="mx-5 mt-4 h-28 overflow-hidden rounded-xl">
              {selectedRoom?.image_url ? (
                <img src={selectedRoom.image_url} alt={`Room ${selectedRoom.room_number}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                  <DoorClosed className="h-9 w-9 opacity-90" />
                </div>
              )}
            </div>

            <div className="space-y-3 p-5 text-sm">
              <SummaryRow icon={BedDouble} label="Room" value={selectedRoom ? `${selectedRoom.room_type}` : "Not selected"} badge={selectedRoom?.room_number} />
              <SummaryRow icon={User} label="Guest" value={fullName || "Not entered"} />
              <SummaryRow icon={CalendarDays} label="Check-in" value={checkIn ? formatDateShort(checkIn) : "—"} />
              <SummaryRow icon={CalendarCheck} label="Check-out" value={checkOut ? formatDateShort(checkOut) : "—"} />
              <SummaryRow icon={CalendarDays} label="Nights" value={String(nights)} />

              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Room Charge</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Extra Services</span>
                  <span>{formatCurrency(addOnsTotal)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
                <span>Total Amount</span>
                <span className="text-brand-600">{formatCurrency(grandTotal)}</span>
              </div>
              {advancePaid > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Remaining Balance</span>
                  <span>{formatCurrency(remaining)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 p-5 pt-0">
              <Button type="submit" form={FORM_ID} className="w-full" loading={isSubmitting}>
                <CalendarCheck className="h-4 w-4" /> Create Booking
              </Button>
              <Button type="button" variant="outline" className="hidden w-full lg:flex" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Your booking information is secure
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs">{label}</p>
          <p className="truncate font-medium text-slate-800">{value}</p>
        </div>
      </div>
      {badge && <Badge tone="slate">{badge}</Badge>}
    </div>
  );
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
