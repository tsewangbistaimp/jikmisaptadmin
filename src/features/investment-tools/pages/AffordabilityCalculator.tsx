import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { NumberField, ToolHeader, ResultGrid, SectionCard, Callout } from "../components/shared";
import { type AffordabilityInputs, calcAffordability } from "../lib/calculations";
import { formatNPR, formatNPRShort, formatPercent } from "../lib/format";

const DEFAULT_INPUTS: AffordabilityInputs = {
  monthlyIncome: 150_000,
  otherMonthlyIncome: 0,
  existingMonthlyDebt: 10_000,
  availableDownPayment: 3_000_000,
  annualRatePct: 10,
  termYears: 20,
  desiredDTIPct: 40,
};

export default function AffordabilityCalculator() {
  const [inputs, setInputs] = React.useState<AffordabilityInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof AffordabilityInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const results = React.useMemo(() => calcAffordability(inputs), [inputs]);

  return (
    <div className="space-y-5">
      <ToolHeader title="Property Affordability Calculator" description="Answers the question: how much property can I likely afford?" />

      <SectionCard title="Your Finances">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Monthly Income" value={inputs.monthlyIncome} min={0} onChange={(v) => set("monthlyIncome", v)} hint={formatNPR(inputs.monthlyIncome)} />
          <NumberField label="Other Monthly Income" value={inputs.otherMonthlyIncome} min={0} onChange={(v) => set("otherMonthlyIncome", v)} />
          <NumberField label="Existing Monthly Debt" value={inputs.existingMonthlyDebt} min={0} onChange={(v) => set("existingMonthlyDebt", v)} />
          <NumberField
            label="Available Down Payment"
            value={inputs.availableDownPayment}
            min={0}
            onChange={(v) => set("availableDownPayment", v)}
            hint={formatNPR(inputs.availableDownPayment)}
          />
          <NumberField label="Interest Rate" value={inputs.annualRatePct} min={0} step="0.1" onChange={(v) => set("annualRatePct", v)} suffix="%" />
          <NumberField label="Loan Term" value={inputs.termYears} min={1} max={40} onChange={(v) => set("termYears", v)} suffix="yrs" />
          <NumberField
            label="Desired Debt-to-Income Ratio"
            value={inputs.desiredDTIPct}
            min={0}
            max={100}
            onChange={(v) => set("desiredDTIPct", v)}
            suffix="%"
            hint="Typical comfortable range: 30–43%"
          />
        </div>
      </SectionCard>

      <Callout title="Your Estimate" tone="success">
        <p className="text-base">
          Estimated affordable property price: <strong>{formatNPR(results.maxEstimatedPropertyPrice)}</strong>
        </p>
        <p className="text-base">
          Estimated monthly EMI: <strong>{formatNPR(results.estimatedEMI)}</strong>
        </p>
        <p className="text-base">
          Estimated down payment: <strong>{formatNPR(results.requiredDownPayment)}</strong>
        </p>
      </Callout>

      <ResultGrid cols={4}>
        <StatCard label="Max Affordable Monthly Payment" value={formatNPRShort(results.maxAffordableMonthlyPayment)} tone="brand" />
        <StatCard label="Max Estimated Loan" value={formatNPRShort(results.maxEstimatedLoan)} />
        <StatCard label="Max Estimated Property Price" value={formatNPRShort(results.maxEstimatedPropertyPrice)} tone="green" />
        <StatCard label="Required Down Payment" value={formatNPRShort(results.requiredDownPayment)} />
        <StatCard label="Estimated EMI" value={formatNPR(results.estimatedEMI)} tone="amber" />
        <StatCard label="Resulting DTI Ratio" value={formatPercent(results.dtiRatioPct)} />
        <StatCard label="Remaining Monthly Income" value={formatNPRShort(results.remainingMonthlyIncome)} tone="green" />
        <StatCard label="Total Monthly Income" value={formatNPRShort(results.totalMonthlyIncome)} />
      </ResultGrid>
    </div>
  );
}
