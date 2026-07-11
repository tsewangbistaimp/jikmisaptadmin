import * as React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  DoorClosed,
  Users,
  Menu,
  Plus,
  CreditCard,
  Sparkles,
  Settings,
  LogOut,
  X,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const tabs = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/bookings", label: "Bookings", icon: ClipboardList },
  { to: "/rooms", label: "Rooms", icon: DoorClosed },
  { to: "/guests", label: "Guests", icon: Users },
];

export function MobileNav() {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Hide the bottom nav and FAB on the New Booking form: it's a long,
  // input-heavy page, and fixed-position chrome at the bottom fights with
  // the on-screen keyboard opening/closing as the receptionist tabs through
  // fields, which is what caused the page to visibly "jump" while typing
  // or scrolling. A dedicated full-screen task flow doesn't need quick nav
  // shortcuts anyway.
  const hideChrome = location.pathname.startsWith("/bookings/new");
  if (hideChrome) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => navigate("/bookings/new")}
        aria-label="New Booking"
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 active:scale-95 transition-transform md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium min-h-12",
                isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium min-h-12 text-slate-400 dark:text-slate-500"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-2 pb-4 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">More</p>
              <button onClick={() => setMoreOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <MoreLink to="/transactions" label="Transactions" icon={CreditCard} onClick={() => setMoreOpen(false)} />
            <MoreLink to="/expenses" label="Expenses" icon={Receipt} onClick={() => setMoreOpen(false)} />
            <MoreLink to="/services" label="Services" icon={Sparkles} onClick={() => setMoreOpen(false)} />
            {isAdmin && <MoreLink to="/settings/users" label="Settings & Staff" icon={Settings} onClick={() => setMoreOpen(false)} />}

            <button
              onClick={async () => {
                setMoreOpen(false);
                await signOut();
                navigate("/login");
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-5 w-5" />
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MoreLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
          isActive
            ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
