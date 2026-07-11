import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Receipt, ImagePlus, Loader2, X } from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { EXPENSE_PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/schemas";
import { todayISO } from "@/lib/utils";
import type { ExpenseCategory, ExpenseWithCategory } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Add / edit expense — mirrors RoomFormDialog's react-hook-form + zod pattern,
// and the guest-ID-document private-bucket upload pattern for the receipt.
// ---------------------------------------------------------------------------
export function ExpenseFormDialog({
  expense,
  open,
  onClose,
  onSaved,
  categories,
  onCategoriesChanged,
}: {
  expense: ExpenseWithCategory | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: ExpenseCategory[];
  onCategoriesChanged: () => Promise<void> | void;
}) {
  const { isAdmin } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: "",
      category_id: "",
      amount: 0,
      date: todayISO(),
      payment_method: "cash",
      paid_by: "",
      description: "",
      status: "paid",
    },
  });

  const [receiptPath, setReceiptPath] = React.useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [addingCategory, setAddingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [savingCategory, setSavingCategory] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            title: expense.title,
            category_id: expense.category_id,
            amount: expense.amount,
            date: expense.date,
            payment_method: expense.payment_method,
            paid_by: expense.paid_by ?? "",
            description: expense.description ?? "",
            status: expense.status,
          }
        : {
            title: "",
            category_id: categories[0]?.id ?? "",
            amount: 0,
            date: todayISO(),
            payment_method: "cash",
            paid_by: "",
            description: "",
            status: "paid",
          }
    );
    setAddingCategory(false);
    setNewCategoryName("");
    if (expense?.receipt_url) {
      setReceiptPath(expense.receipt_url);
      supabase.storage
        .from("expense-receipts")
        .createSignedUrl(expense.receipt_url, 3600)
        .then(({ data }) => setReceiptPreviewUrl(data?.signedUrl ?? null));
    } else {
      setReceiptPath(null);
      setReceiptPreviewUrl(null);
    }
  }, [open, expense, reset, categories]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("expense-receipts").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReceiptPath(path);
    setReceiptPreviewUrl(URL.createObjectURL(file));
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Enter a category name");
      return;
    }
    setSavingCategory(true);
    const { data, error } = await supabase
      .from("expense_categories")
      .insert({ name: newCategoryName.trim() })
      .select()
      .single();
    setSavingCategory(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await onCategoriesChanged();
    setValue("category_id", data.id);
    setAddingCategory(false);
    setNewCategoryName("");
    toast.success("Category added");
  };

  const onSubmit = async (values: ExpenseFormValues) => {
    const payload = {
      ...values,
      paid_by: values.paid_by || null,
      description: values.description || null,
      receipt_url: receiptPath,
    };
    const { error } = expense
      ? await supabase.from("expenses").update(payload).eq("id", expense.id)
      : await supabase.from("expenses").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(expense ? "Expense updated" : "Expense added");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={expense ? "Edit Expense" : "Add Expense"} className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Expense Title</Label>
          <Input {...register("title")} placeholder="e.g. July Electricity Bill" error={errors.title?.message} />
          <FieldError message={errors.title?.message} />
        </div>

        <div>
          <Label>Category</Label>
          {!addingCategory ? (
            <div className="flex items-center gap-2">
              <Select {...register("category_id")} className="min-w-0 flex-1" error={errors.category_id?.message}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {isAdmin && (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAddingCategory(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="min-w-0 flex-1 basis-full sm:basis-auto"
              />
              <Button type="button" size="sm" className="shrink-0" onClick={addCategory} loading={savingCategory}>
                Add
              </Button>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAddingCategory(false)}>
                Cancel
              </Button>
            </div>
          )}
          <FieldError message={errors.category_id?.message} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Amount (NPR)</Label>
            <Input type="number" min={0} step="0.01" {...register("amount", { valueAsNumber: true })} error={errors.amount?.message} />
            <FieldError message={errors.amount?.message} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" {...register("date")} error={errors.date?.message} />
            <FieldError message={errors.date?.message} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Payment Method</Label>
            <Select {...register("payment_method")}>
              {Object.entries(EXPENSE_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select {...register("status")}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Paid By (optional)</Label>
          <Input {...register("paid_by")} placeholder="e.g. Front desk cash, Admin" />
        </div>

        <div>
          <Label>Description / Notes (optional)</Label>
          <Textarea {...register("description")} placeholder="Any extra details about this expense" />
        </div>

        <div>
          <Label>Receipt Image (optional)</Label>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          {receiptPreviewUrl ? (
            <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <img src={receiptPreviewUrl} alt="Receipt preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setReceiptPath(null);
                  setReceiptPreviewUrl(null);
                }}
                aria-label="Remove receipt"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:bg-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-brand-300 hover:text-brand-500 dark:border-slate-700"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <span className="text-xs font-medium">{uploading ? "Uploading…" : "Click to upload a receipt photo"}</span>
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            <Receipt className="h-4 w-4" /> {expense ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------
export function DeleteExpenseDialog({
  expense,
  onClose,
  onDeleted,
}: {
  expense: ExpenseWithCategory | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = React.useState(false);

  if (!expense) return null;

  const confirmDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense deleted");
    onDeleted();
    onClose();
  };

  return (
    <ConfirmDialog
      open={!!expense}
      onClose={onClose}
      onConfirm={confirmDelete}
      title={`Delete "${expense.title}"?`}
      description="This will permanently remove this expense record. This cannot be undone."
      confirmLabel="Delete"
      destructive
      loading={loading}
    />
  );
}
