import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { NumberField, ToolHeader, SectionCard, Callout } from "../components/shared";
import { BuyVsRentChart } from "../components/charts";
import { type BuyVsRentInputs, compareBuyVsRent } from "../lib/calculations";
import { formatNPR, formatNPRShort } from "../lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_INPUTS: BuyVsRentInputs = {
  propertyPrice: 15_000_000,
  downPaymentPct: 20,
  annualRatePct: 10,
  termYears: 20,
  annualMaintenance: 30_000,
  propertyTaxAnnual: 15_000,
  insuranceAnnual: 8_000,
  annualAppreciationPct: 5,
  sellingCostsPct: 5,
  monthlyRent: 45_000,
  annualRentIncreasePct: 5,
  expectedInvestmentReturnPct: 8,
};

const MILESTONES = [5, 10, 20];

export default function BuyVsRentCalculator() {
  const [inputs, setInputs] = React.useState<BuyVsRentInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof BuyVsRentInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const yearly = React.useMemo(() => compareBuyVsRent(inputs, 20), [inputs]);
  const chartRows = yearly.map((y) => ({ year: y.year, buyNet: y.buy.netPosition, rentNet: y.rent.netPosition }));
  const milestones = MILESTONES.map((y) => yearly.find((r) => r.year === y)).filter((r): r is (typeof yearly)[number] => Boolean(r));

  return (
    <div className="space-y-5">
      <ToolHeader title="Buy vs Rent Calculator" description="Estimate whether buying or renting looks financially stronger, based on your assumptions." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="If You Buy">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <NumberField label="Property Price" value={inputs.propertyPrice} min={0} onChange={(v) => set("propertyPrice", v)} hint={formatNPR(inputs.propertyPrice)} />
            </div>
            <NumberField label="Down Payment %" value={inputs.downPaymentPct} min={0} max={100} onChange={(v) => set("downPaymentPct", v)} />
            <NumberField label="Interest Rate" value={inputs.annualRatePct} min={0} step="0.1" onChange={(v) => set("annualRatePct", v)} suffix="%" />
            <NumberField label="Loan Term" value={inputs.termYears} min={1} max={40} onChange={(v) => set("termYears", v)} suffix="yrs" />
            <NumberField label="Annual Appreciation" value={inputs.annualAppreciationPct} step="0.1" onChange={(v) => set("annualAppreciationPct", v)} suffix="%" />
            <NumberField label="Annual Maintenance" value={inputs.annualMaintenance} min={0} onChange={(v) => set("annualMaintenance", v)} />
            <NumberField label="Annual Property Tax" value={inputs.propertyTaxAnnual} min={0} onChange={(v) => set("propertyTaxAnnual", v)} />
            <NumberField label="Annual Insurance" value={inputs.insuranceAnnual} min={0} onChange={(v) => set("insuranceAnnual", v)} />
            <NumberField label="Selling Costs" value={inputs.sellingCostsPct} min={0} max={100} onChange={(v) => set("sellingCostsPct", v)} suffix="%" />
          </div>
        </SectionCard>

        <SectionCard title="If You Rent">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Monthly Rent" value={inputs.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(inputs.monthlyRent)} />
            <NumberField label="Annual Rent Increase" value={inputs.annualRentIncreasePct} step="0.1" onChange={(v) => set("annualRentIncreasePct", v)} suffix="%" />
            <div className="sm:col-span-2">
              <NumberField
                label="Expected Investment Return"
                value={inputs.expectedInvestmentReturnPct}
                step="0.1"
                onChange={(v) => set("expectedInvestmentReturnPct", v)}
                suffix="%"
                hint="On the down payment and any monthly savings, if invested instead of spent on buying"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {milestones.map((m) => (
        <div key={m.year} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">After {m.year} Years</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Buy</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Total Payments" value={formatNPRShort(m.buy.totalPaid)} />
                  <StatCard label="Property Value" value={formatNPRShort(m.buy.propertyValue)} />
                  <StatCard label="Remaining Loan" value={formatNPRShort(m.buy.remainingLoan)} />
                  <StatCard label="Owner Equity" value={formatNPRShort(m.buy.ownerEquity)} tone="green" />
                  <StatCard label="Total Costs" value={formatNPRShort(m.buy.totalCosts)} />
                  <StatCard label="Net Position" value={formatNPRShort(m.buy.netPosition)} tone="brand" hint="After selling costs" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Rent</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Total Rent Paid" value={formatNPRShort(m.rent.totalRentPaid)} />
                  <StatCard label="Investment Value" value={formatNPRShort(m.rent.investmentValue)} tone="green" hint="Saved cash, invested" />
                  <StatCard label="Total Costs" value={formatNPRShort(m.rent.totalCosts)} />
                  <StatCard label="Net Position" value={formatNPRShort(m.rent.netPosition)} tone="brand" />
                </div>
              </CardContent>
            </Card>
          </div>
          <Callout tone={m.difference >= 0 ? "success" : "warning"}>
            Estimated financial difference after {m.year} years:{" "}
            <strong>{formatNPRShort(Math.abs(m.difference))} {m.difference >= 0 ? "in favor of buying" : "in favor of renting"}</strong>, based
            on the assumptions entered above.
          </Callout>
        </div>
      ))}

      <BuyVsRentChart rows={chartRows} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Year</TH>
                <TH>Buy — Net Position</TH>
                <TH>Rent — Net Position</TH>
                <TH>Difference</TH>
              </TR>
            </THead>
            <TBody>
              {yearly.map((r) => (
                <TR key={r.year} className={cn(MILESTONES.includes(r.year) && "bg-brand-50/60 dark:bg-brand-500/10")}>
                  <TD className="font-medium text-slate-700 dark:text-slate-300">{r.year}</TD>
                  <TD>{formatNPRShort(r.buy.netPosition)}</TD>
                  <TD>{formatNPRShort(r.rent.netPosition)}</TD>
                  <TD className={r.difference >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {formatNPRShort(r.difference)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Callout tone="warning" title="This is an estimate, not financial advice">
        This comparison depends entirely on the assumptions entered — property price, rent, interest rate, appreciation, and the return you'd
        expect from investing elsewhere. Actual outcomes can differ significantly.
      </Callout>
    </div>
  );
}
