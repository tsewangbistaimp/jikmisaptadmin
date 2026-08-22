import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { NumberField, SelectField, ToolHeader, Button, Callout } from "../components/shared";
import { type ComparisonPropertyInput, type PropertyType, compareProperties } from "../lib/calculations";
import { formatNPR, formatNPRShort, formatPercent } from "../lib/format";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

let nextId = 1;
function makeProperty(name: string): ComparisonPropertyInput {
  nextId += 1;
  return {
    id: `prop-${nextId}-${Date.now()}`,
    name,
    type: "apartment",
    price: 15_000_000,
    downPaymentPct: 20,
    annualRatePct: 10,
    termYears: 20,
    monthlyRent: 50_000,
    monthlyExpenses: 3_000,
    annualAppreciationPct: 5,
    vacancyRatePct: 5,
  };
}

export default function PropertyComparison() {
  const [properties, setProperties] = React.useState<ComparisonPropertyInput[]>([makeProperty("Property A"), makeProperty("Property B")]);

  const updateProperty = <K extends keyof ComparisonPropertyInput>(id: string, key: K, value: ComparisonPropertyInput[K]) => {
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  };

  const addProperty = () => {
    if (properties.length >= 5) return;
    setProperties((prev) => [...prev, makeProperty(`Property ${String.fromCharCode(65 + prev.length)}`)]);
  };

  const removeProperty = (id: string) => {
    if (properties.length <= 2) return;
    setProperties((prev) => prev.filter((p) => p.id !== id));
  };

  const results = React.useMemo(() => compareProperties(properties), [properties]);

  const bestIndex = (values: number[], mode: "min" | "max"): number => {
    if (values.length === 0) return -1;
    let idx = 0;
    for (let i = 1; i < values.length; i++) {
      if (mode === "min" ? values[i] < values[idx] : values[i] > values[idx]) idx = i;
    }
    return idx;
  };

  const rows: { label: string; mode: "min" | "max"; format: (v: number) => string; values: number[] }[] = [
    { label: "Purchase Price", mode: "min", format: formatNPR, values: results.map((r) => r.price) },
    { label: "Down Payment", mode: "min", format: formatNPR, values: results.map((r) => r.downPayment) },
    { label: "Loan Amount", mode: "min", format: formatNPR, values: results.map((r) => r.loanAmount) },
    { label: "Monthly EMI", mode: "min", format: formatNPR, values: results.map((r) => r.monthlyEMI) },
    { label: "Total Interest (Full Term)", mode: "min", format: formatNPR, values: results.map((r) => r.totalInterestFullTerm) },
    { label: "Monthly Rent", mode: "max", format: formatNPR, values: results.map((r) => r.monthlyRent) },
    { label: "Annual Rent", mode: "max", format: formatNPR, values: results.map((r) => r.annualRent) },
    { label: "Rental Yield", mode: "max", format: (v) => formatPercent(v), values: results.map((r) => r.rentalYieldPct) },
    { label: "Monthly Cash Flow", mode: "max", format: formatNPR, values: results.map((r) => r.monthlyCashFlow) },
    { label: "5-Year Property Value", mode: "max", format: formatNPR, values: results.map((r) => r.value5yr) },
    { label: "10-Year Property Value", mode: "max", format: formatNPR, values: results.map((r) => r.value10yr) },
    { label: "Remaining Loan (5-Yr)", mode: "min", format: formatNPR, values: results.map((r) => r.remainingLoan5yr) },
    { label: "Remaining Loan (10-Yr)", mode: "min", format: formatNPR, values: results.map((r) => r.remainingLoan10yr) },
    { label: "Owner Equity (5-Yr)", mode: "max", format: formatNPR, values: results.map((r) => r.equity5yr) },
    { label: "Owner Equity (10-Yr)", mode: "max", format: formatNPR, values: results.map((r) => r.equity10yr) },
    { label: "Total Rental Income (10-Yr)", mode: "max", format: formatNPR, values: results.map((r) => r.totalRentalIncome10yr) },
    { label: "Total Expenses (10-Yr)", mode: "min", format: formatNPR, values: results.map((r) => r.totalExpenses10yr) },
    { label: "Estimated Return (10-Yr)", mode: "max", format: formatNPR, values: results.map((r) => r.estimatedReturn10yr) },
  ];

  return (
    <div className="space-y-5">
      <ToolHeader
        title="Property Comparison Calculator"
        description="Compare 2–5 properties side by side to see which looks financially stronger, based on your assumptions."
        actions={
          <Button variant="outline" onClick={addProperty} disabled={properties.length >= 5}>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {properties.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <input
                  value={p.name}
                  onChange={(e) => updateProperty(p.id, "name", e.target.value)}
                  className="w-full rounded-lg border border-transparent bg-transparent text-sm font-semibold text-slate-900 focus:border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 dark:text-slate-100 dark:focus:border-slate-700 dark:focus:bg-slate-900"
                  placeholder="Property name"
                />
                {properties.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeProperty(p.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <SelectField label="Type" value={p.type} onChange={(v) => updateProperty(p.id, "type", v)} options={TYPE_OPTIONS} />
              <NumberField label="Purchase Price" value={p.price} min={0} onChange={(v) => updateProperty(p.id, "price", v)} hint={formatNPRShort(p.price)} />
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Down Payment %" value={p.downPaymentPct} min={0} max={100} onChange={(v) => updateProperty(p.id, "downPaymentPct", v)} />
                <NumberField label="Interest Rate" value={p.annualRatePct} min={0} step="0.1" onChange={(v) => updateProperty(p.id, "annualRatePct", v)} suffix="%" />
                <NumberField label="Loan Term" value={p.termYears} min={1} max={40} onChange={(v) => updateProperty(p.id, "termYears", v)} suffix="yrs" />
                <NumberField label="Vacancy Rate" value={p.vacancyRatePct} min={0} max={100} onChange={(v) => updateProperty(p.id, "vacancyRatePct", v)} suffix="%" />
                <NumberField label="Monthly Rent" value={p.monthlyRent} min={0} onChange={(v) => updateProperty(p.id, "monthlyRent", v)} />
                <NumberField label="Monthly Expenses" value={p.monthlyExpenses} min={0} onChange={(v) => updateProperty(p.id, "monthlyExpenses", v)} />
                <NumberField
                  label="Appreciation"
                  value={p.annualAppreciationPct}
                  step="0.1"
                  onChange={(v) => updateProperty(p.id, "annualAppreciationPct", v)}
                  suffix="%"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Metric</TH>
                {results.map((r) => (
                  <TH key={r.id}>{r.name}</TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => {
                const best = bestIndex(row.values, row.mode);
                return (
                  <TR key={row.label}>
                    <TD className="font-medium text-slate-700 dark:text-slate-300">{row.label}</TD>
                    {row.values.map((v, i) => (
                      <TD
                        key={results[i]?.id ?? i}
                        className={cn(i === best && "font-semibold text-green-700 dark:text-green-400")}
                      >
                        {row.format(v)}
                        {i === best && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">Best</span>}
                      </TD>
                    ))}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Callout title="How to read this table">
        "Best" simply marks the strongest number in each row based on the assumptions you entered — it isn't a recommendation. A property
        that looks weaker on one metric (e.g. a higher price) may still be the stronger overall choice depending on what matters most to
        you.
      </Callout>
    </div>
  );
}
