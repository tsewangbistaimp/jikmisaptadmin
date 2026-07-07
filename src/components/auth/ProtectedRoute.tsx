import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";

export function ProtectedRoute() {
  const { session, profile } = useAuth();

  if (!session) return <Navigate to="/login" replace />;
  if (profile && profile.status === "disabled") {
    return <Navigate to="/login" replace state={{ disabled: true }} />;
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
