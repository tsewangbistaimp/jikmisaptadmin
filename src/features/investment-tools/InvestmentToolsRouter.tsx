// ============================================================================
// Real Estate Investment Tools — feature router.
//
// Mounted once from src/App.tsx as a single "/investment-tools/*" route, so
// adding this entire 10-tool feature only costs App.tsx two lines (one lazy
// import, one <Route>). Everything else — the hub and all 10 tool pages —
// lives inside this folder and is wired up here.
// ============================================================================
import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { PageLoader } from "@/components/ui/misc";
import { lazyWithRetry } from "@/lib/lazy-retry";

// Each tool is its own lazy chunk (same lazyWithRetry helper App.tsx already
// uses for every top-level page) so visiting the hub doesn't download all 10
// calculators — or recharts/jsPDF — until a specific tool is opened.
const InvestmentToolsHub = lazyWithRetry(() => import("./pages/InvestmentToolsHub"));
const MortgageCalculator = lazyWithRetry(() => import("./pages/MortgageCalculator"));
const RentalRoiCalculator = lazyWithRetry(() => import("./pages/RentalRoiCalculator"));
const RentalYieldCalculator = lazyWithRetry(() => import("./pages/RentalYieldCalculator"));
const AppreciationCalculator = lazyWithRetry(() => import("./pages/AppreciationCalculator"));
const PropertyComparison = lazyWithRetry(() => import("./pages/PropertyComparison"));
const ProjectionCalculator = lazyWithRetry(() => import("./pages/ProjectionCalculator"));
const BuyVsRentCalculator = lazyWithRetry(() => import("./pages/BuyVsRentCalculator"));
const AffordabilityCalculator = lazyWithRetry(() => import("./pages/AffordabilityCalculator"));
const RentalCashFlowCalculator = lazyWithRetry(() => import("./pages/RentalCashFlowCalculator"));
const InvestmentReportPage = lazyWithRetry(() => import("./pages/InvestmentReportPage"));

export default function InvestmentToolsRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route index element={<InvestmentToolsHub />} />
        <Route path="mortgage" element={<MortgageCalculator />} />
        <Route path="rental-roi" element={<RentalRoiCalculator />} />
        <Route path="rental-yield" element={<RentalYieldCalculator />} />
        <Route path="appreciation" element={<AppreciationCalculator />} />
        <Route path="compare" element={<PropertyComparison />} />
        <Route path="projection" element={<ProjectionCalculator />} />
        <Route path="buy-vs-rent" element={<BuyVsRentCalculator />} />
        <Route path="affordability" element={<AffordabilityCalculator />} />
        <Route path="cash-flow" element={<RentalCashFlowCalculator />} />
        <Route path="report" element={<InvestmentReportPage />} />
      </Routes>
    </Suspense>
  );
}
