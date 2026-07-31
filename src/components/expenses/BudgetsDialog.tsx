import * as React from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory } from "@/lib/database.types";

/**
 * Admin-only "Manage Budgets" dialog — one monthly-budget input per
 * category, saved as a batch of updates. Leaving a field blank clears
 * that category's budget (null = "no budget set", not zero).
 */
export function BudgetsDialog({
  open,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const c of categories) next[c.id] = c.monthly_budget != null ? String(c.monthly_budget) : "";
    setValues(next);
  }, [open, categories]);

  const save = async () => {
    setSaving(true);
    const updates = categories.map((c) => {
      const raw = values[c.id]?.trim();
      const monthly_budget = raw ? Number(raw) : null;
      return supabase.from("expense_categories").update({ monthly_budget }).eq("id", c.id);
    });
    const results = await Promise.all(updates);
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      return;
    }
    toast.success("Budgets updated");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Manage Category Budgets" description="Set a monthly spending budget per category. Leave blank for no budget." className="max-w-md">
      <div className="max-h-[60vh] space-y-3 overflow-y-auto scrollbar-thin pr-1">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <Label className="mb-0 flex-1 truncate">{c.name}</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="No budget"
              value={values[c.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [c.id]: e.target.value }))}
              className="h-9 w-32"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={saving}>
          Save Budgets
        </Button>
      </div>
    </Dialog>
  );
}
