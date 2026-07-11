import * as React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion";

function useGreeting() {
  return React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);
}

export function Topbar() {
  const { profile } = useAuth();
  const greeting = useGreeting();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  React.useEffect(() => {
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gt("remaining_balance", 0)
      .in("booking_status", ["confirmed", "checked_in"])
      .then(({ count }) => setPendingCount(count ?? 0));
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
              {greeting}, {firstName} <span className="align-middle">👋</span>
            </p>
            <p className="hidden text-xs text-slate-400 sm:block">
              Here's what's happening at Jikmis Apartment today.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 md:justify-end">
          <motion.button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            whileFocus={{ boxShadow: "0 0 0 3px rgba(61,99,245,0.15)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="flex min-h-12 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-400 shadow-sm transition-colors hover:bg-slate-100 md:min-h-10 md:max-w-xs"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden truncate sm:inline">Search anything…</span>
            <span className="truncate sm:hidden">Search…</span>
            <kbd className="ml-auto hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 md:inline">
              ⌘K
            </kbd>
          </motion.button>

          <motion.button
            title={pendingCount > 0 ? `${pendingCount} bookings with pending balance` : "No pending balances"}
            aria-label={pendingCount > 0 ? `${pendingCount} bookings with pending balance` : "No pending balances"}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.12 }}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-500 shadow-sm hover:bg-slate-50 md:h-10 md:w-10"
          >
            <Bell className="h-4 w-4" />
            <AnimatePresence>
              {pendingCount > 0 && (
                <motion.span
                  key={pendingCount}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING_SNAPPY}
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white ring-2 ring-white"
                >
                  {pendingCount > 9 ? "9+" : pendingCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <div className="hidden shrink-0 items-center gap-2.5 rounded-full border border-slate-100 bg-white py-1 pl-1 pr-3 shadow-sm sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">
              {initials(profile?.full_name ?? "?")}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
              <p className="text-xs capitalize text-slate-400">{profile?.role === "admin" ? "Superadmin" : profile?.role}</p>
            </div>
          </div>

          <Link to="/bookings/new" className="hidden shrink-0 sm:block">
            <Button size="sm">
              <PlusCircle className="h-4 w-4" /> New Booking
            </Button>
          </Link>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
