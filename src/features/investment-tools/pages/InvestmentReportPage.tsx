import * as React from "react";
import { FileDown } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Input, Label } from "@/components/ui/input";
import { NumberField, SelectField, ToolHeader, ResultGrid, SectionCard, Button, Callout } from "../components/shared";
import { type SinglePropertyInputs, type PropertyType, buildSinglePropertyBundle } from "../lib/calculations";
import { formatNPR, formatNPRShort, formatPercent } from "../lib/format";

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "apartment", label: "Apartment" },
  { value: "house", label: "House" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

const DEFAULT_INPUTS: SinglePropertyInputs = {
  propertyName: "Sample Property",
  propertyType: "apartment",
  propertyPrice: 15_000_000,
  downPaymentPct: 20,
  annualRatePct: 10,
  termYears: 20,
  monthlyRent: 55_000,
  monthlyExpenses: 3_000,
  annualMaintenance: 20_000,
  propertyTaxAnnual: 15_000,
  insuranceAnnual: 8_000,
  managementFeePct: 8,
  vacancyRatePct: 5,
  annualAppreciationPct: 5,
  annualRentIncreasePct: 3,
  projectionYears: 20,
};

export default function InvestmentReportPage() {
  const [inputs, setInputs] = React.useState<SinglePropertyInputs>(DEFAULT_INPUTS);
  const [generating, setGenerating] = React.useState(false);
  const set = <K extends keyof SinglePropertyInputs>(key: K, value: SinglePropertyInputs[K]) => setInputs((prev) => ({ ...prev, [key]: value }));

  const bundle = React.useMemo(() => buildSinglePropertyBundle(inputs), [inputs]);
  const last = bundle.projection[bundle.projection.length - 1];

  const handleGeneratePdf = async () => {
    setGenerating(true);
    try {
      const { downloadInvestmentToolsReportPdf } = await import("../pdf/investment-tools-report-pdf");
      downloadInvestmentToolsReportPdf(inputs);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolHeader
        title="Professional PDF Investment Report"
        description="Build a shareable, professional investment analysis for one property — using the exact numbers below."
        actions={
          <Button onClick={handleGeneratePdf} loading={generating}>
            <FileDown className="h-4 w-4" />
            Generate Professional PDF Report
          </Button>
        }
      />

      <SectionCard title="Property">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Property Name</Label>
            <Input value={inputs.propertyName} onChange={(e) => set("propertyName", e.target.value)} placeholder="e.g. Sunrise Apartment, Baneshwor" />
          </div>
          <SelectField label="Property Type" value={inputs.propertyType} onChange={(v) => set("propertyType", v)} options={TYPE_OPTIONS} />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Loan Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <NumberField label="Property Price" value={inputs.propertyPrice} min={0} onChange={(v) => set("propertyPrice", v)} hint={formatNPR(inputs.propertyPrice)} />
            </div>
            <NumberField label="Down Payment %" value={inputs.downPaymentPct} min={0} max={100} onChange={(v) => set("downPaymentPct", v)} />
            <NumberField label="Interest Rate" value={inputs.annualRatePct} min={0} step="0.1" onChange={(v) => set("annualRatePct", v)} suffix="%" />
            <NumberField label="Loan Term" value={inputs.termYears} min={1} max={40} onChange={(v) => set("termYears", v)} suffix="yrs" />
            <NumberField label="Analysis Period" value={inputs.projectionYears} min={1} max={30} onChange={(v) => set("projectionYears", v)} suffix="yrs" />
          </div>
        </SectionCard>

        <SectionCard title="Rent, Growth & Expenses">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Monthly Rent" value={inputs.monthlyRent} min={0} onChange={(v) => set("monthlyRent", v)} hint={formatNPR(inputs.monthlyRent)} />
            <NumberField label="Annual Rent Increase" value={inputs.annualRentIncreasePct} step="0.1" onChange={(v) => set("annualRentIncreasePct", v)} suffix="%" />
            <NumberField label="Annual Appreciation" value={inputs.annualAppreciationPct} step="0.1" onChange={(v) => set("annualAppreciationPct", v)} suffix="%" />
            <NumberField label="Vacancy Rate" value={inputs.vacancyRatePct} min={0} max={100} onChange={(v) => set("vacancyRatePct", v)} suffix="%" />
            <NumberField label="Monthly Expenses" value={inputs.monthlyExpenses} min={0} onChange={(v) => set("monthlyExpenses", v)} />
            <NumberField label="Management Fee" value={inputs.managementFeePct} min={0} max={100} onChange={(v) => set("managementFeePct", v)} suffix="% of rent" />
            <NumberField label="Annual Maintenance" value={inputs.annualMaintenance} min={0} onChange={(v) => set("annualMaintenance", v)} />
            <NumberField label="Annual Property Tax" value={inputs.propertyTaxAnnual} min={0} onChange={(v) => set("propertyTaxAnnual", v)} />
            <NumberField label="Annual Insurance" value={inputs.insuranceAnnual} min={0} onChange={(v) => set("insuranceAnnual", v)} />
          </div>
        </SectionCard>
      </div>

      <ResultGrid cols={4}>
        <StatCard label="Down Payment" value={formatNPRShort(bundle.mortgage.downPayment)} tone="brand" />
        <StatCard label="Loan Amount" value={formatNPRShort(bundle.mortgage.loanAmount)} />
        <StatCard label="Monthly EMI" value={formatNPR(bundle.mortgage.monthlyEMI)} tone="amber" />
        <StatCard label="Annual Cash Flow" value={formatNPRShort(bundle.rentalRoi.annualCashFlow)} tone={bundle.rentalRoi.annualCashFlow >= 0 ? "green" : "red"} />
        <StatCard label="Gross Rental Yield" value={formatPercent(bundle.rentalYield.grossYieldPct)} />
        <StatCard label={`Value After ${inputs.projectionYears} Yrs`} value={formatNPRShort(bundle.appreciation.futureValue)} tone="green" />
        <StatCard label="Owner Equity (Final Year)" value={formatNPRShort(last?.ownerEquity ?? 0)} tone="brand" />
        <StatCard label="Cumulative Return" value={formatNPRShort(last?.cumulativeReturn ?? 0)} tone={(last?.cumulativeReturn ?? 0) >= 0 ? "green" : "red"} />
      </ResultGrid>

      <Callout title="About this report">
        Clicking "Generate Professional PDF Report" builds a 10-page A4 report — cover, executive summary, assumptions, loan analysis,
        rental analysis, property growth, a full {inputs.projectionYears}-year projection table, charts, key findings, and a risks &
        assumptions page — using exactly the numbers shown above. No separate calculations are made for the PDF.
      </Callout>
    </div>
  );
}
