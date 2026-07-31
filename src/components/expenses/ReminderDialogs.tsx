import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ListTodo } from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { reminderFormSchema, type ReminderFormValues } from "@/lib/schemas";
import { RECURRENCE_LABELS } from "@/lib/constants";
import type { ExpenseReminder } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Add / edit an expense reminder (bill-payment todo)
// ---------------------------------------------------------------------------
export function ReminderFormDialog({
  reminder,
  open,
  onClose,
  onSaved,
}: {
  reminder: ExpenseReminder | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: { title: "", due_date: "", amount: undefined, priority: "medium", is_recurring: false, recurrence_interval: "monthly" },
  });

  const isRecurring = watch("is_recurring");

  React.useEffect(() => {
    if (!open) return;
    reset(
      reminder
        ? {
            title: reminder.title,
            due_date: reminder.due_date ?? "",
            amount: reminder.amount ?? undefined,
            priority: reminder.priority,
            is_recurring: reminder.is_recurring,
            recurrence_interval: reminder.recurrence_interval ?? "monthly",
          }
        : { title: "", due_date: "", amount: undefined, priority: "medium", is_recurring: false, recurrence_interval: "monthly" }
    );
  }, [open, reminder, reset]);

  const onSubmit = async (values: ReminderFormValues) => {
    const payload = {
      title: values.title,
      due_date: values.due_date || null,
      amount: values.amount ?? null,
      priority: values.priority,
      is_recurring: values.is_recurring ?? false,
      recurrence_interval: values.is_recurring ? values.recurrence_interval ?? "monthly" : null,
    };
    const { error } = reminder
      ? await supabase.from("expense_reminders").update(payload).eq("id", reminder.id)
      : await supabase.from("expense_reminders").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(reminder ? "Reminder updated" : "Reminder added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={reminder ? "Edit Reminder" : "Add Expense Reminder"} className="max-w-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input {...register("title")} placeholder="e.g. Pay Electricity Bill" error={errors.title?.message} />
          <FieldError message={errors.title?.message} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Due Date</Label>
            <Input type="date" {...register("due_date")} />
          </div>
          <div>
            <Label>Amount (optional)</Label>
            <Input type="number" min={0} step="0.01" {...register("amount", { valueAsNumber: true })} error={errors.amount?.message} />
            <FieldError message={errors.amount?.message} />
          </div>
        </div>
        <div>
          <Label>Priority</Label>
          <Select {...register("priority")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" {...register("is_recurring")} className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
            Repeats
          </label>
          {isRecurring && (
            <div className="mt-2">
              <Select {...register("recurrence_interval")}>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-400">A new reminder is created automatically each time this one is marked done.</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <ListTodo className="h-4 w-4" /> {reminder ? "Save Changes" : "Add Reminder"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
export function DeleteReminderDialog({
  reminder,
  onClose,
  onDeleted,
}: {
  reminder: ExpenseReminder | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = React.useState(false);

  if (!reminder) return null;

  const confirmDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from("expense_reminders").delete().eq("id", reminder.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reminder deleted");
    onDeleted();
    onClose();
  };

  return (
    <ConfirmDialog
      open={!!reminder}
      onClose={onClose}
      onConfirm={confirmDelete}
      title={`Delete "${reminder.title}"?`}
      description="This cannot be undone."
      confirmLabel="Delete"
      destructive
      loading={loading}
    />
  );
}
