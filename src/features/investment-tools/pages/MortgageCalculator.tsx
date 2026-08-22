import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { NumberField, ToolHeader, ResultGrid, SectionCard } from "../components/shared";
import { PrincipalVsInterestChart } from "../components/charts";
import { type MortgageInputs, calcMortgage } from "../lib/calculations";
import { formatNPR, formatNPRShort } from "../lib/format";

const DEFAULT_INPUTS: MortgageInputs = {
  propertyPrice: 15_000_000,
  downPaymentPct: 20,
  annualRatePct: 10,
  termYears: 20,
};

export default function MortgageCalculator() {
  const [inputs, setInputs] = React.useState<MortgageInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof MortgageInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const results = React.useMemo(() => calcMortgage(inputs), [inputs]);

  return (
    <div className="space-y-5">
      <ToolHeader title="Mortgage / EMI Calculator" description="See how much you'd need to pay every month for a property loan." />

      <SectionCard title="Loan Details" description="All figures in NPR — every value below is editable.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <NumberField label="Property Price" value={inputs.propertyPrice} min={0} onChange={(v) => set("propertyPrice", v)} hint={formatNPR(inputs.propertyPrice)} />
          </div>
          <NumberField
            label="Down Payment %"
            value={inputs.downPaymentPct}
            min={0}
            max={100}
            onChange={(v) => set("downPaymentPct", Math.min(100, Math.max(0, v)))}
            hint={`Down payment amount: ${formatNPR(results.downPayment)}`}
          />
          <NumberField label="Annual Interest Rate" value={inputs.annualRatePct} min={0} step="0.1" onChange={(v) => set("annualRatePct", v)} suffix="%" />
          <NumberField label="Loan Term (years)" value={inputs.termYears} min={1} max={40} onChange={(v) => set("termYears", v)} suffix="yrs" />
          <div>
            <p className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Loan Amount</p>
            <p className="flex h-12 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 md:h-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {formatNPR(results.loanAmount)}
            </p>
          </div>
        </div>
      </SectionCard>

      <ResultGrid cols={3}>
        <StatCard label="Down Payment" value={formatNPRShort(results.downPayment)} tone="brand" />
        <StatCard label="Loan Amount" value={formatNPRShort(results.loanAmount)} />
        <StatCard label="Monthly EMI" value={formatNPR(results.monthlyEMI)} tone="amber" />
        <StatCard label="Total Payments" value={results.totalPayments} hint="Number of monthly installments" />
        <StatCard label="Total Amount Paid" value={formatNPRShort(results.totalAmountPaid)} />
        <StatCard label="Total Principal" value={formatNPRShort(results.totalPrincipal)} tone="green" />
        <StatCard label="Total Interest" value={formatNPRShort(results.totalInterest)} tone="red" />
      </ResultGrid>

      <PrincipalVsInterestChart principal={results.totalPrincipal} interest={results.totalInterest} />
    </div>
  );
}
