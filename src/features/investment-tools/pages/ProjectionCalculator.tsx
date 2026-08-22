import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { NumberField, ToolHeader, ResultGrid, SectionCard } from "../components/shared";
import { ProjectionValueEquityChart, ProjectionRentalCashFlowChart } from "../components/charts";
import { type ProjectionInputs, buildProjection } from "../lib/calculations";
import { formatNPR, formatNPRShort } from "../lib/format";
import { cn } from "@/lib/utils";

const DEFAULT_INPUTS: ProjectionInputs = {
  propertyPrice: 15_000_000,
  downPaymentPct: 20,
  annualRatePct: 10,
  termYears: 20,
  monthlyRent: 55_000,
  annualRentIncreasePct: 3,
  annualAppreciationPct: 5,
  annualExpenses: 60_000,
  vacancyRatePct: 5,
};

const MILESTONES = [5, 10, 20];

export default function ProjectionCalculator() {
  const [inputs, setInputs] = React.useState<ProjectionInputs>(DEFAULT_INPUTS);
  const set = <K extends keyof ProjectionInputs>(key: K, value: number) => setInputs((prev) => ({ ...prev, [key]: value }));

  const rows = React.useMemo(() => buildProjection(inputs, 20), [inputs]);
  const milestoneRows = MILESTONES.map((y) => rows.find((r) => r.year === y)).filter((r): r is (typeof rows)[number] => Boolean(r));

  return (
    <div className="space-y-5">
      <ToolHeader title="5 / 10 / 20-Year Property Projection" description="See what could happen to a property investment over time — one of the most detailed tools in this suite." />

      <SectionCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField label="Property Price" value={inputs.propertyPrice} min={0} onChange={(v) => set("propertyPrice", v)} hint={formatNPR(inputs.propertyPrice)} />
          <NumberField label="Down Payment %" value={inputs.downPaymentPct} min={0} max={100} onChange={(v) => set("downPaymentPct", v)} />
          <NumberField label="Interest Rate" value={inputs.annualRatePct} min={0} step="0.1" onChange={(v) => set("annualRatePct", v)} suffix="%" />
          <NumberField label="Loan Term" value={inputs.termYears} min={1} max={40} onChange={(v) => set("termYears", v)} suffix="yrs" />
          <NumberField label="Monthly Rent" value={inputs.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(inputs.monthlyRent)} />
          <NumberField label="Annual Rent Increase" value={inputs.annualRentIncreasePct} step="0.1" onChange={(v) => set("annualRentIncreasePct", v)} suffix="%" />
          <NumberField label="Annual Appreciation" value={inputs.annualAppreciationPct} step="0.1" onChange={(v) => set("annualAppreciationPct", v)} suffix="%" />
          <NumberField label="Annual Expenses" value={inputs.annualExpenses} min={0} onChange={(v) => set("annualExpenses", v)} hint={formatNPR(inputs.annualExpenses)} />
          <NumberField label="Vacancy Rate" value={inputs.vacancyRatePct} min={0} max={100} onChange={(v) => set("vacancyRatePct", v)} suffix="%" />
        </div>
      </SectionCard>

      {milestoneRows.map((row) => (
        <div key={row.year} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Year {row.year} Snapshot</h3>
          <ResultGrid cols={4}>
            <StatCard label="Property Value" value={formatNPRShort(row.propertyValue)} tone="brand" />
            <StatCard label="Loan Balance" value={formatNPRShort(row.loanBalance)} />
            <StatCard label="Owner Equity" value={formatNPRShort(row.ownerEquity)} tone="green" />
            <StatCard label="Cumulative Return" value={formatNPRShort(row.cumulativeReturn)} tone={row.cumulativeReturn >= 0 ? "green" : "red"} />
            <StatCard label="Cumulative Rental Income" value={formatNPRShort(row.cumulativeRentalIncome)} />
            <StatCard label="Cumulative Cash Flow" value={formatNPRShort(row.cumulativeCashFlow)} tone={row.cumulativeCashFlow >= 0 ? "green" : "red"} />
            <StatCard label="This Year's Net Cash Flow" value={formatNPRShort(row.netCashFlow)} />
            <StatCard label="Principal Paid to Date" value={formatNPRShort(row.cumulativePrincipalPaid)} />
          </ResultGrid>
        </div>
      ))}

      <ProjectionValueEquityChart rows={rows} />
      <ProjectionRentalCashFlowChart rows={rows} />

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Year</TH>
                <TH>Property Value</TH>
                <TH>Loan Balance</TH>
                <TH>Owner Equity</TH>
                <TH>Rental Income</TH>
                <TH>Net Cash Flow</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.year} className={cn(MILESTONES.includes(r.year) && "bg-brand-50/60 dark:bg-brand-500/10")}>
                  <TD className="font-medium text-slate-700 dark:text-slate-300">{r.year}</TD>
                  <TD>{formatNPRShort(r.propertyValue)}</TD>
                  <TD>{formatNPRShort(r.loanBalance)}</TD>
                  <TD>{formatNPRShort(r.ownerEquity)}</TD>
                  <TD>{formatNPRShort(r.rentalIncome)}</TD>
                  <TD className={r.netCashFlow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {formatNPRShort(r.netCashFlow)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
