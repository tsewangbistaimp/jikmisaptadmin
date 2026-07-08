import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, DoorClosed } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, cn } from "@/lib/utils";
import { roomStatusTone } from "@/lib/badge-tones";
import { ROOM_STATUS_LABELS } from "@/lib/constants";
import { roomFormSchema, type RoomFormValues } from "@/lib/schemas";
import type { Room } from "@/lib/database.types";

export default function Rooms() {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<Room | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Room | null>(null);
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
              className={cn(
                "p-5 transition-shadow",
                highlightId === r.id && "ring-2 ring-brand-400"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <DoorClosed className="h-5 w-5" />
                </div>
                <Badge tone={roomStatusTone(r.status)} className="capitalize">
                  {ROOM_STATUS_LABELS[r.status]}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Room {r.room_number}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{r.room_type}</p>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{formatCurrency(r.price)} / night</p>

              {isAdmin && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(r)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleting(r)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

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

  React.useEffect(() => {
    if (open) {
      reset(
        room
          ? { room_number: room.room_number, room_type: room.room_type, price: room.price, status: room.status }
          : { room_number: "", room_type: "", price: 0, status: "available" }
      );
    }
  }, [open, room, reset]);

  const onSubmit = async (values: RoomFormValues) => {
    const { error } = room
      ? await supabase.from("rooms").update(values).eq("id", room.id)
      : await supabase.from("rooms").insert(values);
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
            {Object.entries(ROOM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
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
