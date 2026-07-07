import * as React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  CreditCard,
  DoorClosed,
  Users,
  Sparkles,
  Settings,
  Building2,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Management",
    items: [
      { to: "/bookings/new", label: "New Booking", icon: PlusCircle },
      { to: "/bookings", label: "Bookings", icon: ClipboardList },
      { to: "/rooms", label: "Rooms", icon: DoorClosed },
      { to: "/guests", label: "Guests", icon: Users },
      { to: "/services", label: "Services", icon: Sparkles },
    ],
  },
  {
    label: "Finance",
    items: [{ to: "/transactions", label: "Transactions", icon: CreditCard }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Jikmis Apartment</p>
          <p className="text-xs text-slate-400 leading-tight">Front Desk</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-500 text-white shadow-sm shadow-brand-900/40"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </p>
            <NavLink
              to="/settings/users"
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-500 text-white shadow-sm shadow-brand-900/40"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <Settings className="h-4 w-4" />
              Settings & Staff
            </NavLink>
          </div>
        )}
      </nav>

      <div className="relative border-t border-white/10 p-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {initials(profile?.full_name ?? "?")}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-white leading-tight">{profile?.full_name}</p>
            <p className="text-xs text-slate-400 leading-tight capitalize">{profile?.role}</p>
          </div>
          <ChevronUp className={cn("h-4 w-4 text-slate-400 transition-transform", menuOpen && "rotate-180")} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-3 right-3 z-20 mb-2 rounded-xl border border-white/10 bg-slate-800 p-1.5 shadow-xl">
              <button
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
