import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";

export function ProtectedRoute() {
  const { session, profile } = useAuth();

  if (!session) return <Navigate to="/login" replace />;
  if (profile && profile.status === "disabled") {
    return <Navigate to="/login" replace state={{ disabled: true }} />;
  }
  // A session can exist with no matching profiles row (e.g. the row was
  // deleted, or a signup never got provisioned) — without this check that
  // case would silently render the dashboard with every admin-only control
  // hidden instead of clearly telling the person to contact an admin.
  if (!profile) {
    return <Navigate to="/login" replace state={{ noProfile: true }} />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export function AdminRoute() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
