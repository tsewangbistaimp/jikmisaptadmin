import * as React from "react";
import { Link } from "react-router-dom";
import { Search, Bell, PlusCircle, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Button } from "@/components/ui/button";

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
  const { theme, toggleTheme } = useTheme();
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
      <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:flex-row md:items-center md:gap-4 md:px-6 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
              {greeting}, {firstName} <span className="align-middle">👋</span>
            </p>
            <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              Here's what's happening at Jikmis Apartment today.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2 md:justify-end">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="flex min-h-12 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 hover:bg-slate-100 md:min-h-10 md:max-w-xs dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden truncate sm:inline">Search anything…</span>
            <span className="truncate sm:hidden">Search…</span>
            <kbd className="ml-auto hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 md:inline dark:border-slate-700 dark:bg-slate-800">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 md:h-10 md:w-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            title={pendingCount > 0 ? `${pendingCount} bookings with pending balance` : "No pending balances"}
            aria-label={pendingCount > 0 ? `${pendingCount} bookings with pending balance` : "No pending balances"}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 md:h-10 md:w-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Bell className="h-4 w-4" />
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>

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
