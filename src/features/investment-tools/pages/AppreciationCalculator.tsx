import * as React from "react";
import { StatCard } from "@/components/ui/stat-card";
import { NumberField, ToolHeader, ResultGrid, SectionCard } from "../components/shared";
import { AppreciationLineChart } from "../components/charts";
import { type AppreciationInputs, calcAppreciation } from "../lib/calculations";
import { formatNPR, formatNPRShort, formatPercent } from "../lib/format";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = ["1", "5", "10", "15", "20", "custom"] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];
const PERIOD_LABELS: Record<PeriodOption, string> = { "1": "1 Year", "5": "5 Years", "10": "10 Years", "15": "15 Years", "20": "20 Years", custom: "Custom" };

const DEFAULT_INPUTS: Omit<AppreciationInputs, "years"> = {
  currentValue: 15_000_000,
  annualAppreciationPct: 5,
};

export default function AppreciationCalculator() {
  const [base, setBase] = React.useState(DEFAULT_INPUTS);
  const [period, setPeriod] = React.useState<PeriodOption>("10");
  const [customYears, setCustomYears] = React.useState(10);

  const years = period === "custom" ? Math.max(0, customYears || 0) : Number(period);
  const results = React.useMemo(() => calcAppreciation({ ...base, years }), [base, years]);

  return (
    <div className="space-y-5">
      <ToolHeader title="Property Appreciation Calculator" description="Estimate how much a property could be worth in the future." />

      <SectionCard title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Current Property Value"
            value={base.currentValue}
            min={0}
            onChange={(v) => setBase((p) => ({ ...p, currentValue: v }))}
            hint={formatNPR(base.currentValue)}
          />
          <NumberField
            label="Annual Appreciation Rate"
            value={base.annualAppreciationPct}
            step="0.1"
            onChange={(v) => setBase((p) => ({ ...p, annualAppreciationPct: v }))}
            suffix="%"
          />
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Number of Years</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPeriod(opt)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    period === opt
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  )}
                >
                  {PERIOD_LABELS[opt]}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <input
                type="number"
                min={0}
                max={100}
                value={customYears}
                onChange={(e) => setCustomYears(e.target.value === "" ? 0 : Number(e.target.value))}
                className="h-10 w-24 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            )}
          </div>
        </div>
      </SectionCard>

      <ResultGrid cols={4}>
        <StatCard label="Current Value" value={formatNPRShort(results.currentValue)} />
        <StatCard label="Future Value" value={formatNPRShort(results.futureValue)} tone="brand" hint={`In ${years} ${years === 1 ? "year" : "years"}`} />
        <StatCard label="Total Increase" value={formatNPRShort(results.totalIncrease)} tone="green" />
        <StatCard label="Percentage Increase" value={formatPercent(results.percentIncrease)} tone="green" />
      </ResultGrid>

      <AppreciationLineChart series={results.series} />
    </div>
  );
}
