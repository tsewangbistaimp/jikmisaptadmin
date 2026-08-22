import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { NumberField, ToolHeader, ResultGrid, SectionCard, Callout } from "../components/shared";
import { type RentalYieldInputs, calcRentalYield } from "../lib/calculations";
import { formatNPR, formatPercent } from "../lib/format";

const DEFAULT_INPUTS: RentalYieldInputs = {
  propertyPrice: 15_000_000,
  monthlyRent: 55_000,
  annualExpenses: 60_000,
};

export default function RentalYieldCalculator() {
  const [inputs, setInputs] = React.useState<RentalYieldInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof RentalYieldInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const results = React.useMemo(() => calcRentalYield(inputs), [inputs]);

  return (
    <div className="space-y-5">
      <ToolHeader title="Rental Yield Calculator" description="How much rental income a property generates compared with its value." />

      <SectionCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField label="Property Price" value={inputs.propertyPrice} min={0} onChange={(v) => set("propertyPrice", v)} hint={formatNPR(inputs.propertyPrice)} />
          <NumberField label="Monthly Rent" value={inputs.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(inputs.monthlyRent)} />
          <NumberField label="Annual Expenses" value={inputs.annualExpenses} min={0} onChange={(v) => set("annualExpenses", v)} hint={formatNPR(inputs.annualExpenses)} />
        </div>
      </SectionCard>

      <ResultGrid cols={3}>
        <StatCard label="Annual Rent" value={formatNPR(results.annualRent)} />
        <StatCard label="Gross Rental Yield" value={formatPercent(results.grossYieldPct)} tone="brand" />
        <StatCard label="Net Rental Yield" value={formatPercent(results.netYieldPct)} tone={results.netYieldPct >= 0 ? "green" : "red"} />
      </ResultGrid>

      <Callout title="What's the difference?">
        <p className="mb-1">
          <strong>Gross yield</strong> looks at rent before expenses — annual rent divided by property price.
        </p>
        <p>
          <strong>Net yield</strong> looks at rent after expenses — it subtracts annual expenses (maintenance, tax, insurance, etc.) before
          dividing by property price, so it's a more realistic picture of the return.
        </p>
      </Callout>
    </div>
  );
}
