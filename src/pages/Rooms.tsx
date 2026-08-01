import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DoorClosed, ImagePlus, Loader2, X, BedDouble, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { RoomCalendar } from "@/components/rooms/RoomCalendar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, todayISO, cn } from "@/lib/utils";
import { addDaysISO } from "@/lib/dashboard-helpers";
import { roomStatusTone } from "@/lib/badge-tones";
import { ROOM_STATUS_LABELS, ADMIN_ROOM_STATUS_OPTIONS } from "@/lib/constants";
import { roomFormSchema, type RoomFormValues } from "@/lib/schemas";
import type { Room } from "@/lib/database.types";

export default function Rooms() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<Room | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Room | null>(null);
  const [viewing, setViewing] = React.useState<Room | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("rooms").select("*").order("room_number");
    setRooms((data as Room[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const h = searchParams.get("highlight");
    if (h) {
      setHighlightId(h);
      const t = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Rooms</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{rooms.length} rooms</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : rooms.length === 0 ? (
        <Card>
          <EmptyState title="No rooms yet" description="Add your first room to start taking bookings." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((r) => (
            <Card
              key={r.id}
              onClick={() => setViewing(r)}
              className={cn(
                "group cursor-pointer overflow-hidden p-0 transition-shadow hover:shadow-lg",
                highlightId === r.id && "ring-2 ring-brand-400"
              )}
            >
              <div className="relative h-36 w-full overflow-hidden">
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt={`Room ${r.room_number}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300 dark:from-slate-900 dark:to-slate-800 dark:text-slate-700">
                    <DoorClosed className="h-9 w-9" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
                <Badge tone={roomStatusTone(r.status)} className="absolute right-3 top-3 capitalize shadow-sm">
                  {ROOM_STATUS_LABELS[r.status]}
                </Badge>
                <p className="absolute bottom-2 left-4 text-base font-semibold text-white drop-shadow-sm">Room {r.room_number}</p>
              </div>

              <div className="p-5 pt-4">
                <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                  <BedDouble className="h-3.5 w-3.5 shrink-0" /> {r.room_type}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-navy-700 dark:text-gold-300">
                  <Wallet className="h-3.5 w-3.5 shrink-0" /> {formatCurrency(r.price)}{" "}
                  <span className="font-normal text-slate-400 dark:text-slate-500">/ night</span>
                </p>

                {isAdmin && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(r);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(r);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <RoomDetailDialog room={viewing} onClose={() => setViewing(null)} />

      <RoomFormDialog
        room={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete Room ${deleting?.room_number}?`}
        description="This cannot be undone. Existing bookings for this room will keep their history."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const { error } = await supabase.from("rooms").delete().eq("id", deleting.id);
          if (error) toast.error(error.message);
          else {
            toast.success("Room deleted");
            load();
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

function RoomDetailDialog({ room, onClose }: { room: Room | null; onClose: () => void }) {
  const [bookings, setBookings] = React.useState<{ check_in: string; check_out: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!room) return;
    setLoading(true);
    supabase
      .from("bookings")
      .select("check_in, check_out")
      .eq("room_id", room.id)
      .in("booking_status", ["confirmed", "checked_in"])
      .order("check_in")
      .then(({ data }) => {
        setBookings((data as { check_in: string; check_out: string }[]) ?? []);
        setLoading(false);
      });
  }, [room]);

  if (!room) return null;

  const today = todayISO();

  // Same chaining logic as the availability calc used elsewhere: two
  // non-overlapping bookings for this room (e.g. one ending Aug 10, the
  // next starting Aug 11) are merged into one continuous occupied
  // stretch so "Available From" reflects the whole run of bookings, not
  // just whichever one happens to be earliest.
  const relevant = bookings
    .filter((b) => b.check_out >= today)
    .sort((a, b) => (a.check_in < b.check_in ? -1 : a.check_in > b.check_in ? 1 : 0));

  let mergedCheckOut: string | null = null;
  for (const b of relevant) {
    if (mergedCheckOut === null) {
      mergedCheckOut = b.check_out;
    } else if (b.check_in <= mergedCheckOut) {
      if (b.check_out > mergedCheckOut) mergedCheckOut = b.check_out;
    } else {
      break;
    }
  }

  const isMaintenance = room.status === "maintenance";
  const isAvailable = !isMaintenance && !mergedCheckOut;
  const availableFrom = mergedCheckOut ? addDaysISO(mergedCheckOut, 1) : null;

  return (
    <Dialog open={!!room} onClose={onClose} title={`Room ${room.room_number}`} description={room.room_type} className="max-w-md">
      <div className="space-y-5">
        <div className="relative h-40 w-full overflow-hidden rounded-xl">
          {room.image_url ? (
            <img src={room.image_url} alt={`Room ${room.room_number}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700">
              <DoorClosed className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Nightly Rate</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(room.price)}</p>
          </div>
          <Badge tone={isMaintenance ? "amber" : isAvailable ? "green" : "slate"} className="capitalize">
            {isMaintenance ? "Under Maintenance" : isAvailable ? "Available now" : "Occupied"}
          </Badge>
        </div>

        {!isMaintenance && !isAvailable && availableFrom && (
          <div className="rounded-xl bg-navy-50 px-4 py-3 dark:bg-navy-500/10">
            <p className="text-xs text-navy-500 dark:text-navy-300">Available From</p>
            <p className="text-base font-semibold text-navy-800 dark:text-navy-100">{formatDate(availableFrom)}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slate-400 dark:text-slate-500">Booking Calendar</p>
          {loading ? <PageLoader rows={3} /> : <RoomCalendar bookedRanges={bookings} />}
        </div>
      </div>
    </Dialog>
  );
}

function RoomFormDialog({
  room,
  open,
  onClose,
  onSaved,
}: {
  room: Room | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { room_number: "", room_type: "", price: 0, status: "available" },
  });

  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      reset(
        room
          ? { room_number: room.room_number, room_type: room.room_type, price: room.price, status: room.status }
          : { room_number: "", room_type: "", price: 0, status: "available" }
      );
      setImageUrl(room?.image_url ?? null);
    }
  }, [open, room, reset]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${room?.id ?? "new"}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("room-images").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("room-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  };

  const onSubmit = async (values: RoomFormValues) => {
    const payload = { ...values, image_url: imageUrl };
    const { error } = room
      ? await supabase.from("rooms").update(payload).eq("id", room.id)
      : await supabase.from("rooms").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(room ? "Room updated" : "Room added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={room ? `Edit Room ${room.room_number}` : "Add Room"} className="max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Room Photo</Label>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {imageUrl ? (
            <div className="relative h-32 w-full overflow-hidden rounded-xl">
              <img src={imageUrl} alt="Room preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                aria-label="Remove photo"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:bg-white dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-brand-500 dark:hover:text-brand-400"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <span className="text-xs font-medium">{uploading ? "Uploading…" : "Click to upload a photo"}</span>
            </button>
          )}
          {imageUrl && !uploading && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              Replace photo
            </button>
          )}
        </div>
        <div>
          <Label>Room Number</Label>
          <Input {...register("room_number")} error={errors.room_number?.message} />
          <FieldError message={errors.room_number?.message} />
        </div>
        <div>
          <Label>Room Type</Label>
          <Input {...register("room_type")} placeholder="Standard, Deluxe, Suite…" error={errors.room_type?.message} />
          <FieldError message={errors.room_type?.message} />
        </div>
        <div>
          <Label>Price / Night</Label>
          <Input type="number" min={0} {...register("price", { valueAsNumber: true })} error={errors.price?.message} />
          <FieldError message={errors.price?.message} />
        </div>
        <div>
          <Label>Status</Label>
          <Select {...register("status")}>
            {Object.entries(ADMIN_ROOM_STATUS_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            "Occupied" isn't listed here — whether a room is booked is always calculated from booking dates.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {room ? "Save Changes" : "Add Room"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
