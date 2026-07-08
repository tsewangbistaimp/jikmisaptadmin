import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import type { Service } from "@/lib/database.types";

const serviceFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  price: z.number().min(0, "Price can't be negative"),
  status: z.enum(["active", "inactive"]),
});
type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export default function Services() {
  const { isAdmin } = useAuth();
  const [services, setServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<Service | "new" | null>(null);
  const [deleting, setDeleting] = React.useState<Service | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("name");
    setServices((data as Service[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Services & Add-ons</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Laundry, breakfast, and other extras guests can add to a booking.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add Service
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : services.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Add extras like Laundry or Breakfast so receptionists can attach them to a booking."
            icon={<Sparkles className="h-5 w-5" />}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Price</TH>
                    <TH>Status</TH>
                    {isAdmin && <TH className="text-right">Actions</TH>}
                  </TR>
                </THead>
                <TBody>
                  {services.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium text-slate-900 dark:text-slate-100">{s.name}</TD>
                      <TD>{formatCurrency(s.price)}</TD>
                      <TD>
                        <Badge tone={s.status === "active" ? "green" : "slate"} className="capitalize">
                          {s.status}
                        </Badge>
                      </TD>
                      {isAdmin && (
                        <TD>
                          <div className="flex justify-end gap-1">
                            <button
                              title="Edit"
                              onClick={() => setEditing(s)}
                              className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => setDeleting(s)}
                              className="rounded-lg p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">{s.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatCurrency(s.price)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={s.status === "active" ? "green" : "slate"} className="capitalize">
                      {s.status}
                    </Badge>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button
                          title="Edit"
                          onClick={() => setEditing(s)}
                          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => setDeleting(s)}
                          className="rounded-lg p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <ServiceFormDialog
        service={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Bookings that already used this service keep their record — this only removes it from the price list."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const { error } = await supabase.from("services").delete().eq("id", deleting.id);
          if (error) toast.error(error.message);
          else {
            toast.success("Service deleted");
            load();
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}

function ServiceFormDialog({
  service,
  open,
  onClose,
  onSaved,
}: {
  service: Service | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: { name: "", price: 0, status: "active" },
  });

  React.useEffect(() => {
    if (open) {
      reset(service ? { name: service.name, price: service.price, status: service.status } : { name: "", price: 0, status: "active" });
    }
  }, [open, service, reset]);

  const onSubmit = async (values: ServiceFormValues) => {
    const { error } = service
      ? await supabase.from("services").update(values).eq("id", service.id)
      : await supabase.from("services").insert(values);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(service ? "Service updated" : "Service added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={service ? `Edit ${service.name}` : "Add Service"} className="max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input {...register("name")} placeholder="Laundry, Breakfast, Airport Pickup…" error={errors.name?.message} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label>Price</Label>
          <Input type="number" min={0} {...register("price", { valueAsNumber: true })} error={errors.price?.message} />
          <FieldError message={errors.price?.message} />
        </div>
        <div>
          <Label>Status</Label>
          <Select {...register("status")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {service ? "Save Changes" : "Add Service"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
