import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  CreditCard,
  DoorClosed,
  Users,
  Settings,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/bookings/new", label: "New Booking", icon: PlusCircle },
  { to: "/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/transactions", label: "Transactions", icon: CreditCard },
  { to: "/rooms", label: "Rooms", icon: DoorClosed },
  { to: "/guests", label: "Guests", icon: Users },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin } = useAuth();

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 leading-tight">Jikmis Apartment</p>
          <p className="text-xs text-slate-400 leading-tight">Front Desk</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-slate-100" />
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Admin
            </p>
            <NavLink
              to="/settings/users"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )
              }
            >
              <Settings className="h-4 w-4" />
              Settings & Staff
            </NavLink>
          </>
        )}
      </nav>

      <div className="border-t border-slate-100 px-4 py-4 text-xs text-slate-400">
        v1.0 · Jikmis Apartment
      </div>
    </div>
  );
}
