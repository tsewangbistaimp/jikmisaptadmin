import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { NumberField, ToolHeader, ResultGrid, SectionCard, StatusPill } from "../components/shared";
import { type CashFlowInputs, calcRentalCashFlow } from "../lib/calculations";
import { formatNPR, formatPercent } from "../lib/format";

const DEFAULT_INPUTS: CashFlowInputs = {
  monthlyRent: 55_000,
  vacancyRatePct: 5,
  emi: 18_000,
  propertyTaxMonthly: 1_200,
  insuranceMonthly: 600,
  maintenanceMonthly: 2_000,
  managementMonthly: 3_000,
  utilitiesMonthly: 1_500,
  otherExpensesMonthly: 0,
  cashInvested: 0,
};

export default function RentalCashFlowCalculator() {
  const [inputs, setInputs] = React.useState<CashFlowInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof CashFlowInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const results = React.useMemo(() => calcRentalCashFlow(inputs), [inputs]);

  const breakdown: { label: string; value: number; negative?: boolean }[] = [
    { label: "Gross Monthly Rent", value: results.grossMonthlyRent },
    { label: "Vacancy Loss", value: -results.vacancyLoss, negative: true },
    { label: "EMI", value: -nonNegSafe(inputs.emi), negative: true },
    { label: "Property Tax", value: -nonNegSafe(inputs.propertyTaxMonthly), negative: true },
    { label: "Insurance", value: -nonNegSafe(inputs.insuranceMonthly), negative: true },
    { label: "Maintenance", value: -nonNegSafe(inputs.maintenanceMonthly), negative: true },
    { label: "Management", value: -nonNegSafe(inputs.managementMonthly), negative: true },
    { label: "Utilities", value: -nonNegSafe(inputs.utilitiesMonthly), negative: true },
    { label: "Other Expenses", value: -nonNegSafe(inputs.otherExpensesMonthly), negative: true },
  ];

  return (
    <div className="space-y-5">
      <ToolHeader title="Rental Cash Flow Calculator" description="See exactly how much money a rental property generates each month." />

      <SectionCard title="Rent & Monthly Costs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Monthly Rent" value={inputs.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(inputs.monthlyRent)} />
          <NumberField label="Vacancy Rate" value={inputs.vacancyRatePct} min={0} max={100} onChange={(v) => set("vacancyRatePct", v)} suffix="%" />
          <NumberField label="EMI" value={inputs.emi} min={0} onChange={(v) => set("emi", v)} />
          <NumberField label="Property Tax (Monthly)" value={inputs.propertyTaxMonthly} min={0} onChange={(v) => set("propertyTaxMonthly", v)} />
          <NumberField label="Insurance (Monthly)" value={inputs.insuranceMonthly} min={0} onChange={(v) => set("insuranceMonthly", v)} />
          <NumberField label="Maintenance (Monthly)" value={inputs.maintenanceMonthly} min={0} onChange={(v) => set("maintenanceMonthly", v)} />
          <NumberField label="Property Management (Monthly)" value={inputs.managementMonthly} min={0} onChange={(v) => set("managementMonthly", v)} />
          <NumberField label="Utilities (Monthly)" value={inputs.utilitiesMonthly} min={0} onChange={(v) => set("utilitiesMonthly", v)} />
          <NumberField label="Other Expenses (Monthly)" value={inputs.otherExpensesMonthly} min={0} onChange={(v) => set("otherExpensesMonthly", v)} />
          <NumberField
            label="Cash Invested (Optional)"
            value={inputs.cashInvested ?? 0}
            min={0}
            onChange={(v) => set("cashInvested", v)}
            hint="Enter your down payment to also see cash-on-cash return"
          />
        </div>
      </SectionCard>

      <SectionCard title="Monthly Breakdown">
        <div className="space-y-2">
          {breakdown.map((row) => (
            <div key={row.label} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
              <span className={row.negative ? "text-red-600 dark:text-red-400" : "font-medium text-slate-700 dark:text-slate-300"}>
                {row.value < 0 ? "-" : ""}
                {formatNPR(Math.abs(row.value))}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 text-base font-semibold">
            <span className="text-slate-900 dark:text-slate-100">Net Monthly Cash Flow</span>
            <span className={results.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {formatNPR(results.netMonthlyCashFlow)}
            </span>
          </div>
          <div className="flex justify-end pt-1">
            <StatusPill positive={results.isPositive} positiveLabel="Positive Cash Flow" negativeLabel="Negative Cash Flow" />
          </div>
        </div>
      </SectionCard>

      <ResultGrid cols={4}>
        <StatCard label="Annual Cash Flow" value={formatNPR(results.annualCashFlow)} tone={results.isPositive ? "green" : "red"} />
        <StatCard label="Annual Rental Income" value={formatNPR(results.annualRentalIncome)} hint="After vacancy" />
        <StatCard label="Annual Expenses" value={formatNPR(results.annualExpenses)} hint="Excludes EMI" />
        <StatCard label="Cash Flow After Debt" value={formatNPR(results.cashFlowAfterDebt)} hint="Same as annual cash flow — already accounts for EMI" />
        <StatCard
          label="Cash-on-Cash Return"
          value={results.cashOnCashReturnPct === null ? "—" : formatPercent(results.cashOnCashReturnPct)}
          hint={results.cashOnCashReturnPct === null ? "Enter cash invested above" : "Annual cash flow vs cash invested"}
        />
      </ResultGrid>
    </div>
  );
}

function nonNegSafe(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
}
