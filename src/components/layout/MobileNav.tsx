import * as React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
import { backdropFade, sheetVariants, SPRING_SNAPPY } from "@/lib/motion";

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
      <motion.button
        onClick={() => navigate("/bookings/new")}
        aria-label="New Booking"
        whileTap={{ scale: 0.9 }}
        whileHover={{ y: -2 }}
        transition={SPRING_SNAPPY}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/40 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      {/* Bottom tab bar — floating "liquid glass" pill: frosted dark
          backdrop blur, a soft top sheen for the glass highlight, and a
          spring-animated pill that slides behind whichever tab is active
          instead of the highlight just popping to the new spot. */}
      <nav
        className="fixed inset-x-4 z-30 flex items-center justify-around gap-1 rounded-full border border-white/10 bg-slate-900/75 p-1.5 shadow-2xl shadow-slate-900/30 backdrop-blur-xl md:hidden"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          boxShadow: "0 12px 32px -8px rgba(15,23,42,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} aria-label={tab.label} className="relative flex h-12 flex-1 items-center justify-center rounded-full">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-active-pill"
                    transition={SPRING_SNAPPY}
                    className="absolute inset-1 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-500/50"
                  />
                )}
                <motion.span whileTap={{ scale: 0.82 }} transition={{ duration: 0.12 }} className="relative z-10 flex h-full w-full items-center justify-center">
                  <tab.icon className={cn("h-5 w-5 transition-colors duration-150", isActive ? "text-white" : "text-slate-300")} />
                </motion.span>
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} aria-label="More" className="relative flex h-12 flex-1 items-center justify-center rounded-full">
          <motion.span whileTap={{ scale: 0.82 }} transition={{ duration: 0.12 }} className="flex h-full w-full items-center justify-center">
            <Menu className="h-5 w-5 text-slate-300" />
          </motion.span>
        </button>
      </nav>

      {/* "More" sheet */}
      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              variants={backdropFade}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              variants={sheetVariants}
              initial="initial"
              animate="animate"
              exit="exit"
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
