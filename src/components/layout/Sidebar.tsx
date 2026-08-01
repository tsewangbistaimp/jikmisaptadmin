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
  ChevronsLeft,
  ChevronsRight,
  Receipt,
  BarChart3,
  Globe,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePendingOnlineBookingsCount } from "@/hooks/useOnlineBookings";
import { dropdownVariants, SPRING_SOFT, DURATION } from "@/lib/motion";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badgeKey?: "online-bookings";
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
      { to: "/online-bookings", label: "Online Bookings", icon: Globe, badgeKey: "online-bookings" },
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
      { to: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

const COLLAPSE_KEY = "jikmis-sidebar-collapsed";

// Shared nav row: renders a Framer Motion pill (shared layoutId) behind
// whichever item is currently active, so switching pages slides the
// highlight smoothly to the new item instead of instantly popping there.
// When collapsed, the label is hidden and the row centers its icon —
// `title` on the NavLink still gives a native browser tooltip on hover.
function SidebarNavLink({
  to,
  end,
  onClick,
  icon: Icon,
  label,
  collapsed,
  badgeCount,
}: {
  to: string;
  end?: boolean;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  badgeCount?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={collapsed ? (badgeCount ? `${label} (${badgeCount})` : label) : undefined}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-full px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800",
        collapsed && "justify-center px-0"
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-pill"
              className="absolute inset-0 rounded-full bg-brand-50 dark:bg-brand-500/15"
              transition={SPRING_SOFT}
            />
          )}
          <span className="relative z-10 shrink-0">
            <Icon
              className={cn(
                "h-4 w-4 transition-[color,transform] duration-150 ease-out group-hover:scale-105",
                isActive ? "text-brand-700 dark:text-brand-400" : "text-slate-500 dark:text-slate-400"
              )}
            />
            {!!badgeCount && collapsed && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </span>
          {!collapsed && (
            <span
              className={cn(
                "relative z-10 flex flex-1 items-center justify-between truncate transition-colors duration-150",
                isActive ? "font-semibold text-brand-700 dark:text-brand-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100"
              )}
            >
              <span className="truncate">{label}</span>
              {!!badgeCount && (
                <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, profile, signOut } = useAuth();
  const pendingOnlineBookings = usePendingOnlineBookingsCount();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
    setMenuOpen(false);
  };

  return (
    <motion.div
      animate={{ width: collapsed ? 84 : 256 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-100 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      <div className={cn("flex items-center gap-2.5 px-5 py-5", collapsed && "justify-center px-2")}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">JIKMISAPARTMENT</p>
            <p className="text-xs leading-tight text-slate-400 dark:text-slate-500">Front Desk</p>
          </div>
        )}
        {collapsed && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
            JA
          </div>
        )}
      </div>

      {profile && (
        <div
          className={cn(
            "mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-800/60",
            collapsed && "mx-2 justify-center px-0"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white">
            {initials(profile.full_name)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">Hello, {profile.full_name.split(" ")[0]}</p>
              <p className="truncate text-xs leading-tight text-slate-400 dark:text-slate-500">{profile.username}</p>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden scrollbar-thin px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarNavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  icon={item.icon}
                  label={item.label}
                  collapsed={collapsed}
                  badgeCount={item.badgeKey === "online-bookings" ? pendingOnlineBookings : undefined}
                />
              ))}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div>
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Admin
              </p>
            )}
            <SidebarNavLink to="/settings/users" onClick={onNavigate} icon={Settings} label="Settings & Staff" collapsed={collapsed} />
          </div>
        )}
      </nav>

      <div className="relative border-t border-slate-100 p-3 dark:border-slate-800">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title={collapsed ? profile?.full_name : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
            {initials(profile?.full_name ?? "?")}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">{profile?.full_name}</p>
                <p className="text-xs capitalize leading-tight text-slate-400 dark:text-slate-500">{profile?.role}</p>
              </div>
              <ChevronUp className={cn("h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform", menuOpen && "rotate-180")} />
            </>
          )}
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
                className={cn(
                  "absolute bottom-full z-20 mb-2 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900",
                  collapsed ? "left-2 w-48" : "left-3 right-3"
                )}
              >
                <button
                  onClick={toggleCollapsed}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                  {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                </button>
                <button
                  onClick={async () => {
                    await signOut();
                    navigate("/login");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
