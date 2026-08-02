import * as React from "react";
import { Maximize2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Lower-level building block for charts that already own a custom header
 * (granularity toggles, legends, etc.) and just need the "download PNG" /
 * "view fullscreen" actions bolted on without restructuring that header.
 * `ref` goes on the element wrapping the chart that should be captured;
 * `Toolbar` renders the two icon buttons; `Modal` renders the fullscreen
 * dialog (pass the same chart element as children — it's a cheap,
 * side-effect-free re-render, same pattern already used for mobile/desktop
 * dual layouts elsewhere in this app).
 */
export function useChartExport(filename: string) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  const download = async () => {
    if (!ref.current || downloading) return;
    setDownloading(true);
    try {
      // html2canvas-pro, not plain html2canvas — the latter can't parse the
      // oklch() colors Tailwind v4's default palette compiles to.
      const { default: html2canvas } = await import("html2canvas-pro");
      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(ref.current, { backgroundColor: isDark ? "#0f172a" : "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `${filename.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Chart downloaded");
    } catch {
      toast.error("Couldn't export chart image");
    } finally {
      setDownloading(false);
    }
  };

  return { ref, fullscreen, setFullscreen, download, downloading };
}

export function ChartToolbarButtons({
  onDownload,
  onFullscreen,
  downloading,
}: {
  onDownload: () => void;
  onFullscreen: () => void;
  downloading?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        title="Download as PNG"
        aria-label="Download chart as PNG"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={onFullscreen}
        title="View fullscreen"
        aria-label="View chart fullscreen"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ChartFullscreenDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-4xl">
      <div className="h-[65vh] min-h-[320px] w-full">{children}</div>
    </Dialog>
  );
}

/**
 * Drop-in wrapper for Recharts-based cards across Reports/Dashboard. Adds
 * two premium-dashboard staples without touching any chart's own data or
 * calculation logic: a "view fullscreen" modal (same chart, rendered larger
 * in a Dialog) and a "download as PNG" button that snapshots the chart's
 * rendered DOM via html2canvas — purely visual/export additions, so the
 * underlying <ResponsiveContainer>/recharts children are passed through
 * completely unmodified.
 */
export function ChartCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const [fullscreen, setFullscreen] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const captureRef = React.useRef<HTMLDivElement>(null);

  const downloadPng = async () => {
    if (!captureRef.current || downloading) return;
    setDownloading(true);
    try {
      // html2canvas-pro, not plain html2canvas — the latter can't parse the
      // oklch() colors Tailwind v4's default palette compiles to.
      const { default: html2canvas } = await import("html2canvas-pro");
      const isDark = document.documentElement.classList.contains("dark");
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: isDark ? "#0f172a" : "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Chart downloaded");
    } catch {
      toast.error("Couldn't export chart image");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={downloadPng}
              disabled={downloading}
              title="Download as PNG"
              aria-label="Download chart as PNG"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              title="View fullscreen"
              aria-label="View chart fullscreen"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <div ref={captureRef} className={cn("p-5", contentClassName)}>
          {children}
        </div>
      </Card>

      <Dialog open={fullscreen} onClose={() => setFullscreen(false)} title={title} description={description} className="max-w-4xl">
        <div className="h-[65vh] min-h-[320px] w-full">{children}</div>
      </Dialog>
    </>
  );
}
