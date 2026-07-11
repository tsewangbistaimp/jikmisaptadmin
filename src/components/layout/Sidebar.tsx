import * as React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  CreditCard,
  DoorClosed,
  Users,
  Sparkles,
  Settings,
  LogOut,
  ChevronUp,
  Receipt,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { dropdownVariants, SPRING_SOFT, DURATION } from "@/lib/motion";

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
    items: [
      { to: "/transactions", label: "Transactions", icon: CreditCard },
      { to: "/expenses", label: "Expenses", icon: Receipt },
    ],
  },
];

// Shared nav row: renders a Framer Motion pill (shared layoutId) behind
// whichever item is currently active, so switching pages slides the
// highlight smoothly to the new item instead of instantly popping there.
function SidebarNavLink({
  to,
  end,
  onClick,
  icon: Icon,
  label,
}: {
  to: string;
  end?: boolean;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className="group relative flex items-center gap-3 overflow-hidden rounded-full px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-pill"
              className="absolute inset-0 rounded-full bg-brand-50"
              transition={SPRING_SOFT}
            />
          )}
          <Icon
            className={cn(
              "relative z-10 h-4 w-4 shrink-0 transition-[color,transform] duration-150 ease-out group-hover:scale-105",
              isActive ? "text-brand-700" : "text-slate-500"
            )}
          />
          <span className={cn("relative z-10 transition-colors duration-150", isActive ? "font-semibold text-brand-700" : "text-slate-500 group-hover:text-slate-900")}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-100 bg-white text-slate-500">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">JIKMISAPARTMENT</p>
          <p className="text-xs leading-tight text-slate-400">Front Desk</p>
        </div>
      </div>

      {profile && (
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white">
            {initials(profile.full_name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900">Hello, {profile.full_name.split(" ")[0]}</p>
            <p className="truncate text-xs leading-tight text-slate-400">{profile.username}</p>
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarNavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} icon={item.icon} label={item.label} />
              ))}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Admin
            </p>
            <SidebarNavLink to="/settings/users" onClick={onNavigate} icon={Settings} label="Settings & Staff" />
          </div>
        )}
      </nav>

      <div className="relative border-t border-slate-100 p-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {initials(profile?.full_name ?? "?")}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium leading-tight text-slate-900">{profile?.full_name}</p>
            <p className="text-xs capitalize leading-tight text-slate-400">{profile?.role}</p>
          </div>
          <ChevronUp className={cn("h-4 w-4 text-slate-400 transition-transform", menuOpen && "rotate-180")} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <motion.div
                variants={dropdownVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ transformOrigin: "bottom" }}
                className="absolute bottom-full left-3 right-3 z-20 mb-2 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl"
              >
                <button
                  onClick={async () => {
                    await signOut();
                    navigate("/login");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
