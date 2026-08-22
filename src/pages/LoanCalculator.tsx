import * as React from "react";
import { Calculator, Building2, Home as HomeIcon, FileDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  type PropertyInputs,
  type PropertyResults,
  calculatePropertyResults,
  calculateAtYear,
  formatNPR,
  formatPct,
} from "@/lib/loan-calculator";

// ============================================================================
// Real-Estate Investment Loan Calculator — a brand-new, fully isolated page.
// Not linked from, imported by, or affecting any existing feature: it reads
// nothing from and writes nothing to Supabase, reuses existing UI components
// (Card, Input, Label, StatCard, Table) exactly as they already are, and all
// math lives in src/lib/loan-calculator.ts. Every input is editable and the
// results recompute live on every keystroke (plain React state + useMemo).
// ============================================================================

const PERIOD_OPTIONS = ["1", "5", "10", "15", "20", "custom"] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

const PERIOD_LABELS: Record<PeriodOption, string> = {
  "1": "1 Year",
  "5": "5 Years",
  "10": "10 Years",
  "15": "15 Years",
  "20": "20 Years",
  custom: "Custom",
};

// Defaults from the spec: Apartment NPR 2.5 crore / rent 90,000-100,000;
// House NPR 6 crore / rent 70,000-90,000 (midpoints used below, editable).
const DEFAULT_APARTMENT: PropertyInputs = {
  price: 25_000_000,
  downPaymentPct: 20,
  annualInterestRatePct: 10,
  loanTermYears: 20,
  monthlyRent: 95_000,
  annualAppreciationPct: 5,
  monthlyExpenses: 5_000,
};

const DEFAULT_HOUSE: PropertyInputs = {
  price: 60_000_000,
  downPaymentPct: 20,
  annualInterestRatePct: 10,
  loanTermYears: 20,
  monthlyRent: 80_000,
  annualAppreciationPct: 5,
  monthlyExpenses: 10_000,
};

function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: string | number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

function PropertyInputCard({
  title,
  icon,
  values,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  values: PropertyInputs;
  onChange: (v: PropertyInputs) => void;
}) {
  const set = <K extends keyof PropertyInputs>(key: K, value: number) => onChange({ ...values, [key]: value });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            {icon}
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>All figures in NPR — every value below is editable.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <NumberField label="Property Price" value={values.price} min={0} onChange={(v) => set("price", v)} hint={formatNPR(values.price)} />
        </div>
        <NumberField
          label="Down Payment %"
          value={values.downPaymentPct}
          min={0}
          max={100}
          onChange={(v) => set("downPaymentPct", Math.min(100, Math.max(0, v)))}
          hint={`Loan-to-value: ${100 - Math.min(100, Math.max(0, values.downPaymentPct))}%`}
        />
        <NumberField label="Annual Interest Rate %" value={values.annualInterestRatePct} min={0} step="0.1" onChange={(v) => set("annualInterestRatePct", v)} />
        <NumberField label="Loan Term (years)" value={values.loanTermYears} min={1} onChange={(v) => set("loanTermYears", v)} />
        <NumberField label="Annual Appreciation %" value={values.annualAppreciationPct} step="0.1" onChange={(v) => set("annualAppreciationPct", v)} />
        <NumberField label="Monthly Rental Income" value={values.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(values.monthlyRent)} />
        <NumberField label="Monthly Expenses" value={values.monthlyExpenses} min={0} onChange={(v) => set("monthlyExpenses", v)} hint={formatNPR(values.monthlyExpenses)} />
      </CardContent>
    </Card>
  );
}

function PropertyResultsPanel({ title, results }: { title: string; results: PropertyResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} — Results</CardTitle>
        <CardDescription>Analysis period: {results.periodYears} {results.periodYears === 1 ? "year" : "years"}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Down Payment" value={formatNPR(results.downPayment)} tone="brand" />
        <StatCard label="Loan Amount" value={formatNPR(results.loanAmount)} hint={`Loan-to-value ${results.loanToValuePct.toFixed(0)}%`} />
        <StatCard label="Monthly EMI" value={formatNPR(results.monthlyEMI)} tone="amber" />
        <StatCard label="Total Payments" value={results.totalPayments} hint="Over the full loan term" />
        <StatCard label="Total Paid to Bank" value={formatNPR(results.totalPaidToBankFullTerm)} hint="Full loan term" />
        <StatCard label="Total Interest" value={formatNPR(results.totalInterestFullTerm)} tone="red" hint="Full loan term" />
        <StatCard label="Principal Paid" value={formatNPR(results.principalPaidInPeriod)} hint={`In ${results.periodYears}yr period`} />
        <StatCard label="Interest Paid" value={formatNPR(results.interestPaidInPeriod)} hint={`In ${results.periodYears}yr period`} />
        <StatCard label="Remaining Loan Balance" value={formatNPR(results.remainingLoanBalance)} hint={`After ${results.periodYears}yr`} />
        <StatCard label="Monthly Rental Income" value={formatNPR(results.monthlyRentalIncome)} tone="green" />
        <StatCard label="Annual Rental Income" value={formatNPR(results.annualRentalIncome)} tone="green" />
        <StatCard label="Rental Yield" value={formatPct(results.rentalYieldPct)} tone="green" />
        <StatCard
          label="Monthly Cash Flow"
          value={formatNPR(results.monthlyCashFlow)}
          tone={results.monthlyCashFlow >= 0 ? "green" : "red"}
          hint="After EMI and expenses"
        />
        <StatCard
          label="Annual Cash Flow"
          value={formatNPR(results.annualCashFlow)}
          tone={results.annualCashFlow >= 0 ? "green" : "red"}
          hint="After EMI and expenses"
        />
        <StatCard label="Future Property Value" value={formatNPR(results.futurePropertyValue)} hint={`In ${results.periodYears}yr`} />
        <StatCard label="Property Appreciation" value={formatNPR(results.propertyAppreciation)} tone="green" />
        <StatCard label="Owner Equity" value={formatNPR(results.ownerEquity)} tone="brand" hint={`In ${results.periodYears}yr`} />
        <StatCard label="Total Rental Income" value={formatNPR(results.totalRentalIncomeInPeriod)} hint={`Over ${results.periodYears}yr`} />
        <StatCard label="Total Expenses" value={formatNPR(results.totalExpensesInPeriod)} hint={`Over ${results.periodYears}yr`} />
        <StatCard
          label="Net Investment Profit/Loss"
          value={formatNPR(results.netInvestmentProfitLoss)}
          tone={results.netInvestmentProfitLoss >= 0 ? "green" : "red"}
          hint="Appreciation + rent - expenses - interest"
        />
      </CardContent>
    </Card>
  );
}

interface ComparisonRow {
  label: string;
  apartment: string;
  house: string;
}

function buildComparisonRows(
  apartmentResults: PropertyResults,
  houseResults: PropertyResults,
  apartment5: ReturnType<typeof calculateAtYear>,
  apartment10: ReturnType<typeof calculateAtYear>,
  house5: ReturnType<typeof calculateAtYear>,
  house10: ReturnType<typeof calculateAtYear>
): ComparisonRow[] {
  return [
    { label: "Initial Investment (Down Payment)", apartment: formatNPR(apartmentResults.downPayment), house: formatNPR(houseResults.downPayment) },
    { label: "Down Payment", apartment: formatNPR(apartmentResults.downPayment), house: formatNPR(houseResults.downPayment) },
    { label: "Loan Amount", apartment: formatNPR(apartmentResults.loanAmount), house: formatNPR(houseResults.loanAmount) },
    { label: "Monthly EMI", apartment: formatNPR(apartmentResults.monthlyEMI), house: formatNPR(houseResults.monthlyEMI) },
    { label: `Total Interest (${apartmentResults.periodYears}yr period)`, apartment: formatNPR(apartmentResults.interestPaidInPeriod), house: formatNPR(houseResults.interestPaidInPeriod) },
    { label: "Monthly Rental Income", apartment: formatNPR(apartmentResults.monthlyRentalIncome), house: formatNPR(houseResults.monthlyRentalIncome) },
    { label: "Rental Yield", apartment: formatPct(apartmentResults.rentalYieldPct), house: formatPct(houseResults.rentalYieldPct) },
    { label: "Monthly Cash Flow", apartment: formatNPR(apartmentResults.monthlyCashFlow), house: formatNPR(houseResults.monthlyCashFlow) },
    { label: "Property Value After 5 Years", apartment: formatNPR(apartment5.propertyValue), house: formatNPR(house5.propertyValue) },
    { label: "Property Value After 10 Years", apartment: formatNPR(apartment10.propertyValue), house: formatNPR(house10.propertyValue) },
    { label: "Remaining Loan After 5 Years", apartment: formatNPR(apartment5.remainingLoanBalance), house: formatNPR(house5.remainingLoanBalance) },
    { label: "Remaining Loan After 10 Years", apartment: formatNPR(apartment10.remainingLoanBalance), house: formatNPR(house10.remainingLoanBalance) },
    { label: "Equity After 5 Years", apartment: formatNPR(apartment5.ownerEquity), house: formatNPR(house5.ownerEquity) },
    { label: "Equity After 10 Years", apartment: formatNPR(apartment10.ownerEquity), house: formatNPR(house10.ownerEquity) },
    { label: `Total Rental Income (${apartmentResults.periodYears}yr period)`, apartment: formatNPR(apartmentResults.totalRentalIncomeInPeriod), house: formatNPR(houseResults.totalRentalIncomeInPeriod) },
    { label: "Net Investment Profit/Loss", apartment: formatNPR(apartmentResults.netInvestmentProfitLoss), house: formatNPR(houseResults.netInvestmentProfitLoss) },
  ];
}

export default function LoanCalculator() {
  const [apartment, setApartment] = React.useState<PropertyInputs>(DEFAULT_APARTMENT);
  const [house, setHouse] = React.useState<PropertyInputs>(DEFAULT_HOUSE);
  const [period, setPeriod] = React.useState<PeriodOption>("5");
  const [customYears, setCustomYears] = React.useState(5);
  const [generatingPdf, setGeneratingPdf] = React.useState(false);

  // Lazy-loaded so jsPDF/autotable only download when a report is actually
  // requested — same code-splitting pattern Reports.tsx already uses for its
  // PDF exports. Passes only the raw calculator inputs; the report module
  // derives every figure itself via the same calculatePropertyResults
  // function this page already uses, so the PDF can never show numbers that
  // disagree with what's on screen.
  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const { downloadInvestmentReportPdf } = await import("@/lib/investment-report-pdf");
      downloadInvestmentReportPdf({ apartment, house });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const periodYears = period === "custom" ? Math.max(0, customYears || 0) : Number(period);

  const apartmentResults = React.useMemo(() => calculatePropertyResults(apartment, periodYears), [apartment, periodYears]);
  const houseResults = React.useMemo(() => calculatePropertyResults(house, periodYears), [house, periodYears]);

  const apartment5 = React.useMemo(() => calculateAtYear(apartment, 5), [apartment]);
  const apartment10 = React.useMemo(() => calculateAtYear(apartment, 10), [apartment]);
  const house5 = React.useMemo(() => calculateAtYear(house, 5), [house]);
  const house10 = React.useMemo(() => calculateAtYear(house, 10), [house]);

  const comparisonRows = buildComparisonRows(apartmentResults, houseResults, apartment5, apartment10, house5, house10);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            <Calculator className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            Loan Calculator
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Compare buying an apartment vs a house with a mortgage — a standalone tool, separate from your booking data.
          </p>
        </div>
        <Button onClick={handleGeneratePdf} loading={generatingPdf} className="shrink-0">
          <FileDown className="h-4 w-4" />
          Generate Professional PDF Report
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Analysis Period</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Applies to both properties below.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt}
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
              <Input
                type="number"
                min={0}
                value={customYears}
                onChange={(e) => setCustomYears(e.target.value === "" ? 0 : Number(e.target.value))}
                className="w-24"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PropertyInputCard title="Apartment" icon={<Building2 className="h-4 w-4" />} values={apartment} onChange={setApartment} />
        <PropertyInputCard title="House" icon={<HomeIcon className="h-4 w-4" />} values={house} onChange={setHouse} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PropertyResultsPanel title="Apartment" results={apartmentResults} />
        <PropertyResultsPanel title="House" results={houseResults} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Apartment vs House — Side by Side</CardTitle>
          <CardDescription>Fixed 5-year and 10-year snapshots are independent of the analysis period above.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Metric</TH>
                <TH>Apartment</TH>
                <TH>House</TH>
              </TR>
            </THead>
            <TBody>
              {comparisonRows.map((row) => (
                <TR key={row.label}>
                  <TD className="font-medium text-slate-700 dark:text-slate-300">{row.label}</TD>
                  <TD>{row.apartment}</TD>
                  <TD>{row.house}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
