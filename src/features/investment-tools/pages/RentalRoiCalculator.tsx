import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { NumberField, ToolHeader, ResultGrid, SectionCard, Callout } from "../components/shared";
import { type RentalRoiInputs, calcRentalRoi } from "../lib/calculations";
import { formatNPR, formatNPRShort, formatPercent } from "../lib/format";

const DEFAULT_INPUTS: RentalRoiInputs = {
  propertyPrice: 15_000_000,
  downPayment: 3_000_000,
  annualRatePct: 10,
  loanTermYears: 20,
  monthlyRent: 55_000,
  monthlyExpenses: 3_000,
  annualMaintenance: 20_000,
  propertyTaxAnnual: 15_000,
  insuranceAnnual: 8_000,
  managementFeePct: 8,
  vacancyRatePct: 5,
  annualAppreciationPct: 5,
};

export default function RentalRoiCalculator() {
  const [inputs, setInputs] = React.useState<RentalRoiInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof RentalRoiInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const results = React.useMemo(() => calcRentalRoi(inputs), [inputs]);

  return (
    <div className="space-y-5">
      <ToolHeader title="Rental ROI Calculator" description="Estimate how profitable a rental property may be, after every cost." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Property & Loan">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <NumberField label="Property Price" value={inputs.propertyPrice} min={0} onChange={(v) => set("propertyPrice", v)} hint={formatNPR(inputs.propertyPrice)} />
            </div>
            <NumberField label="Down Payment" value={inputs.downPayment} min={0} onChange={(v) => set("downPayment", v)} hint={formatNPR(inputs.downPayment)} />
            <NumberField label="Interest Rate" value={inputs.annualRatePct} min={0} step="0.1" onChange={(v) => set("annualRatePct", v)} suffix="%" />
            <NumberField label="Loan Term" value={inputs.loanTermYears} min={1} max={40} onChange={(v) => set("loanTermYears", v)} suffix="yrs" />
            <NumberField label="Annual Appreciation" value={inputs.annualAppreciationPct} step="0.1" onChange={(v) => set("annualAppreciationPct", v)} suffix="%" />
          </div>
        </SectionCard>

        <SectionCard title="Rent & Expenses">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Monthly Rent" value={inputs.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(inputs.monthlyRent)} />
            <NumberField label="Vacancy Rate" value={inputs.vacancyRatePct} min={0} max={100} onChange={(v) => set("vacancyRatePct", v)} suffix="%" />
            <NumberField label="Monthly Expenses" value={inputs.monthlyExpenses} min={0} onChange={(v) => set("monthlyExpenses", v)} hint={formatNPR(inputs.monthlyExpenses)} />
            <NumberField label="Management Fee" value={inputs.managementFeePct} min={0} max={100} onChange={(v) => set("managementFeePct", v)} suffix="% of rent" />
            <NumberField label="Annual Maintenance" value={inputs.annualMaintenance} min={0} onChange={(v) => set("annualMaintenance", v)} hint={formatNPR(inputs.annualMaintenance)} />
            <NumberField label="Annual Property Tax" value={inputs.propertyTaxAnnual} min={0} onChange={(v) => set("propertyTaxAnnual", v)} hint={formatNPR(inputs.propertyTaxAnnual)} />
            <NumberField label="Annual Insurance" value={inputs.insuranceAnnual} min={0} onChange={(v) => set("insuranceAnnual", v)} hint={formatNPR(inputs.insuranceAnnual)} />
          </div>
        </SectionCard>
      </div>

      <ResultGrid cols={4}>
        <StatCard label="Annual Rental Income" value={formatNPRShort(results.effectiveAnnualRent)} tone="green" hint="After vacancy" />
        <StatCard label="Annual Expenses" value={formatNPRShort(results.annualExpenses)} hint="Excludes loan payment" />
        <StatCard label="Net Rental Income" value={formatNPRShort(results.netOperatingIncome)} hint="Rent minus expenses" />
        <StatCard label="Annual Cash Flow" value={formatNPRShort(results.annualCashFlow)} tone={results.annualCashFlow >= 0 ? "green" : "red"} hint="After loan payment" />
        <StatCard label="Rental ROI" value={formatPercent(results.rentalROIPct)} tone="brand" hint="Cash flow + appreciation, vs cash invested" />
        <StatCard label="Cash-on-Cash Return" value={formatPercent(results.cashOnCashReturnPct)} hint="Cash flow only, vs cash invested" />
        <StatCard label="Monthly EMI" value={formatNPR(results.monthlyEMI)} tone="amber" />
        <StatCard label="Estimated Value (1 Yr)" value={formatNPRShort(results.estimatedPropertyValueYear1)} />
      </ResultGrid>

      <Callout title="In plain terms">
        This property is estimated to bring in {formatNPRShort(results.effectiveAnnualRent)} a year after vacancy, against{" "}
        {formatNPRShort(results.annualExpenses + results.annualDebtService)} in expenses and loan payments — leaving{" "}
        <strong>{formatNPRShort(results.annualCashFlow)}</strong> per year in your pocket
        {results.annualCashFlow >= 0 ? "." : ", meaning this property would need extra cash to cover its costs."} Cash-on-cash return only
        counts that cash flow; Rental ROI also adds in the property's estimated yearly appreciation.
      </Callout>
    </div>
  );
}
