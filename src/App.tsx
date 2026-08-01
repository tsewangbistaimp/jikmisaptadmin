import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute, AdminRoute } from "@/components/auth/ProtectedRoute";
import { PageLoader } from "@/components/ui/misc";
import Login from "@/pages/Login";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const NewBooking = lazy(() => import("@/pages/NewBooking"));
const Bookings = lazy(() => import("@/pages/Bookings"));
const OnlineBookings = lazy(() => import("@/pages/OnlineBookings"));
const Guests = lazy(() => import("@/pages/Guests"));
const Rooms = lazy(() => import("@/pages/Rooms"));
const Services = lazy(() => import("@/pages/Services"));
const Transactions = lazy(() => import("@/pages/Transactions"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const Reports = lazy(() => import("@/pages/Reports"));
const UsersSettings = lazy(() => import("@/pages/settings/Users"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function App() {
  return (
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
  );
}

export default App;
