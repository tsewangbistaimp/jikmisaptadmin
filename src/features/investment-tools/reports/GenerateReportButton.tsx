// ============================================================================
// Real Estate Investment Tools — shared "Generate Professional Report" flow.
//
// Reused by all 9 calculators: Generate → optional settings → Preview
// (in an <iframe> over a jsPDF blob URL, so what you see is exactly what
// downloads) → Download PDF, or Generate New Report to go back and adjust
// settings without touching the calculator's own inputs/results at all.
// Built entirely from the app's existing Dialog/Input/Label/Button
// components, unmodified.
// ============================================================================
import * as React from "react";
import { FileDown, Eye, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BusinessReportContent, ReportSettings } from "./types";
import { downloadBusinessReportPdf, getBusinessReportPreviewUrl } from "./business-report-pdf";

export interface PeriodOption {
  value: string;
  label: string;
}

export interface GenerateReportButtonProps {
  /** Builds this calculator's report content fresh from its current inputs
   *  and results — called only when the user clicks "Preview Report", so it
   *  always reflects whatever is on screen at that moment. Report metadata
   *  (client name, property name, etc.) is handled separately by the engine
   *  from the settings the user enters, so this only needs the calculator's
   *  own data plus, for period-aware calculators, which period was chosen. */
  buildContent: (period?: string) => BusinessReportContent;
  /** Only pass this for calculators with an analysis-period concept. */
  periodOptions?: PeriodOption[];
  defaultPeriod?: string;
}

interface FormState {
  reportTitle: string;
  clientName: string;
  propertyName: string;
  propertyAddress: string;
  companyName: string;
  preparedBy: string;
  reportDate: string;
  period: string;
  customYears: number;
}

function emptyForm(defaultPeriod?: string): FormState {
  return {
    reportTitle: "",
    clientName: "",
    propertyName: "",
    propertyAddress: "",
    companyName: "",
    preparedBy: "",
    reportDate: "",
    period: defaultPeriod ?? "",
    customYears: 10,
  };
}

/** Resolves the period value handed to `buildContent` — for "custom" this is
 *  the entered year count, otherwise it's the option's own value (already a
 *  plain year count string like "5"/"10"/"20"). */
function resolvePeriod(form: FormState): string | undefined {
  if (!form.period) return undefined;
  return form.period === "custom" ? String(Math.max(1, form.customYears || 1)) : form.period;
}

function toSettings(form: FormState, periodOptions?: PeriodOption[]): ReportSettings {
  const settings: ReportSettings = {};
  if (form.reportTitle.trim()) settings.reportTitle = form.reportTitle.trim();
  if (form.clientName.trim()) settings.clientName = form.clientName.trim();
  if (form.propertyName.trim()) settings.propertyName = form.propertyName.trim();
  if (form.propertyAddress.trim()) settings.propertyAddress = form.propertyAddress.trim();
  if (form.companyName.trim()) settings.companyName = form.companyName.trim();
  if (form.preparedBy.trim()) settings.preparedBy = form.preparedBy.trim();
  if (form.reportDate.trim()) settings.reportDate = form.reportDate.trim();
  if (periodOptions && form.period) {
    const resolved = resolvePeriod(form);
    settings.periodLabel = form.period === "custom" ? `${resolved} Years (Custom)` : periodOptions.find((o) => o.value === form.period)?.label;
  }
  return settings;
}

export function GenerateReportButton({ buildContent, periodOptions, defaultPeriod }: GenerateReportButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"settings" | "preview">("settings");
  const [form, setForm] = React.useState<FormState>(() => emptyForm(defaultPeriod ?? periodOptions?.[0]?.value));
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<BusinessReportContent | null>(null);
  const [generating, setGenerating] = React.useState(false);

  const set = <K extends keyof FormState>(key: K, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const revokePreview = React.useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  React.useEffect(() => revokePreview, [revokePreview]);

  const handleClose = () => {
    revokePreview();
    setOpen(false);
    setStep("settings");
  };

  const handlePreview = () => {
    setGenerating(true);
    try {
      const settings = toSettings(form, periodOptions);
      const builtContent = buildContent(resolvePeriod(form));
      revokePreview();
      setPreviewUrl(getBusinessReportPreviewUrl(builtContent, settings));
      setContent(builtContent);
      setStep("preview");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!content) return;
    const settings = toSettings(form, periodOptions);
    downloadBusinessReportPdf(content, settings);
  };

  const handleGenerateNew = () => {
    revokePreview();
    setContent(null);
    setStep("settings");
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <FileDown className="h-4 w-4" />
        Generate Professional Report
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        title={step === "settings" ? "Report Settings" : "Report Preview"}
        description={step === "settings" ? "All fields are optional — leave any blank to omit it from the report." : content?.reportKind}
        className={step === "preview" ? "max-w-3xl" : "max-w-lg"}
      >
        {step === "settings" ? (
          <div className="space-y-4">
            {periodOptions && periodOptions.length > 0 && (
              <div>
                <Label>Analysis Period</Label>
                <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                  {periodOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("period", opt.value)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        form.period === opt.value
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.period === "custom" && (
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.customYears}
                    onChange={(e) => setForm((prev) => ({ ...prev, customYears: e.target.value === "" ? 0 : Number(e.target.value) }))}
                    className="mt-2 w-28"
                  />
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Report Title</Label>
                <Input value={form.reportTitle} onChange={(e) => set("reportTitle", e.target.value)} placeholder="Real Estate Investment Analysis" />
              </div>
              <div>
                <Label>Client / Investor Name</Label>
                <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Property Name</Label>
                <Input value={form.propertyName} onChange={(e) => set("propertyName", e.target.value)} placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <Label>Property Address</Label>
                <Input value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Company / Business Name</Label>
                <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Prepared By</Label>
                <Input value={form.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Report Date</Label>
                <Input type="date" value={form.reportDate} onChange={(e) => set("reportDate", e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} loading={generating}>
                <Eye className="h-4 w-4" />
                Preview Report
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              {previewUrl && <iframe src={previewUrl} title="Report preview" className="h-full w-full" />}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleGenerateNew}>
                <RotateCcw className="h-4 w-4" />
                Generate New Report
              </Button>
              <Button onClick={handleDownload}>
                <FileDown className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
