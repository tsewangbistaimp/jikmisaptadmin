// ============================================================================
// Real Estate Investment Tools — dashboard hub.
// Brand-new, isolated page. Lists all 10 tools as cards; nothing here reads
// from or writes to Supabase, and nothing here is imported by any existing
// page.
// ============================================================================
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Calculator,
  PiggyBank,
  Percent,
  TrendingUp,
  Layers,
  LineChart as LineChartIcon,
  Home as HomeIcon,
  Wallet,
  Banknote,
  FileDown,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ToolDef {
  to: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const TOOLS: ToolDef[] = [
  { to: "/investment-tools/mortgage", title: "Mortgage / EMI Calculator", description: "How much you'd pay each month for a property loan.", icon: Calculator },
  { to: "/investment-tools/rental-roi", title: "Rental ROI Calculator", description: "How profitable a rental property may be, including cash-on-cash return.", icon: PiggyBank },
  { to: "/investment-tools/rental-yield", title: "Rental Yield Calculator", description: "Rent as a percentage of property price — gross and net.", icon: Percent },
  { to: "/investment-tools/appreciation", title: "Property Appreciation Calculator", description: "Estimate future property value at any number of years.", icon: TrendingUp },
  { to: "/investment-tools/compare", title: "Compare Properties", description: "Compare 2–5 properties side by side across every key metric.", icon: Layers },
  { to: "/investment-tools/projection", title: "5 / 10 / 20-Year Projection", description: "Year-by-year value, equity, income and cash flow, with charts.", icon: LineChartIcon },
  { to: "/investment-tools/buy-vs-rent", title: "Buy vs Rent Calculator", description: "Estimate whether buying or renting looks financially stronger.", icon: HomeIcon },
  { to: "/investment-tools/affordability", title: "Property Affordability Calculator", description: "How much property you can likely afford, in plain numbers.", icon: Wallet },
  { to: "/investment-tools/cash-flow", title: "Rental Cash Flow Calculator", description: "What a rental actually generates each month, after every expense.", icon: Banknote },
  { to: "/investment-tools/report", title: "Generate PDF Report", description: "A professional, shareable investment analysis PDF for one property.", icon: FileDown },
];

export default function InvestmentToolsHub() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Real Estate Investment Tools</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A standalone toolkit for evaluating property investments — separate from your booking data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.to} to={tool.to} className="block">
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tool.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                    Open tool
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
