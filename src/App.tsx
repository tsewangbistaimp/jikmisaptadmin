import { Routes, Route } from "react-router-dom";
import { ProtectedRoute, AdminRoute } from "@/components/auth/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NewBooking from "@/pages/NewBooking";
import Bookings from "@/pages/Bookings";
import Guests from "@/pages/Guests";
import Rooms from "@/pages/Rooms";
import Services from "@/pages/Services";
import Transactions from "@/pages/Transactions";
import UsersSettings from "@/pages/settings/Users";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bookings/new" element={<NewBooking />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/guests" element={<Guests />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/services" element={<Services />} />
        <Route path="/transactions" element={<Transactions />} />

        <Route element={<AdminRoute />}>
          <Route path="/settings/users" element={<UsersSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
