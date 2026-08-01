import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute, AdminRoute } from "@/components/auth/ProtectedRoute";
import { PageLoader } from "@/components/ui/misc";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazy-retry";
import Login from "@/pages/Login";

// lazyWithRetry (not React.lazy directly) so that a stale chunk after a new
// deploy — the browser tab was open before Vercel replaced the JS files —
// triggers one automatic reload instead of crashing to a blank screen. See
// src/lib/lazy-retry.ts.
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const NewBooking = lazyWithRetry(() => import("@/pages/NewBooking"));
const Bookings = lazyWithRetry(() => import("@/pages/Bookings"));
const OnlineBookings = lazyWithRetry(() => import("@/pages/OnlineBookings"));
const Guests = lazyWithRetry(() => import("@/pages/Guests"));
const Rooms = lazyWithRetry(() => import("@/pages/Rooms"));
const Services = lazyWithRetry(() => import("@/pages/Services"));
const Transactions = lazyWithRetry(() => import("@/pages/Transactions"));
const Expenses = lazyWithRetry(() => import("@/pages/Expenses"));
const Reports = lazyWithRetry(() => import("@/pages/Reports"));
const UsersSettings = lazyWithRetry(() => import("@/pages/settings/Users"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bookings/new" element={<NewBooking />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/online-bookings" element={<OnlineBookings />} />
            <Route path="/guests" element={<Guests />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/services" element={<Services />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/reports" element={<Reports />} />

            <Route element={<AdminRoute />}>
              <Route path="/settings/users" element={<UsersSettings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
