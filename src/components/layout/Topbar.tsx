import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, PlusCircle, LogIn, LogOut, Wallet, Inbox } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Button } from "@/components/ui/button";
import { initials, formatCurrency, formatDate, todayISO, cn } from "@/lib/utils";
import { SPRING_SNAPPY, dropdownVariants, staggerContainer, staggerItem } from "@/lib/motion";

function useGreeting() {
  return React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);
}

type NotificationType = "checkin" | "checkout" | "payment_due";

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
}

interface NotificationBookingRow {
  id: string;
  booking_number: string;
  check_in: string;
  check_out: string;
  booking_status: string;
  remaining_balance: number;
  guest: { full_name: string } | null;
  room: { room_number: string } | null;
}

// How far ahead an unpaid balance's checkout date can be before we start
// surfacing a "payment due soon" notification for it — matches the "3-4
// days" lead time requested for the front desk to start following up.
const PAYMENT_DUE_LOOKAHEAD_DAYS = 4;

export function Topbar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const greeting = useGreeting();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  React.useEffect(() => {
    const today = todayISO();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + PAYMENT_DUE_LOOKAHEAD_DAYS);
    const horizonISO = horizon.toISOString().slice(0, 10);

    supabase
      .from("bookings")
      .select("id, booking_number, check_in, check_out, booking_status, remaining_balance, guest:guests(full_name), room:rooms(room_number)")
      .in("booking_status", ["confirmed", "checked_in"])
      .lte("check_in", horizonISO)
      .gte("check_out", today)
      .then(({ data }) => {
        const rows = (data as unknown as NotificationBookingRow[]) ?? [];
        const items: NotificationItem[] = [];

        // Arriving today
        rows
          .filter((b) => b.check_in === today)
          .forEach((b) =>
            items.push({
              id: `checkin-${b.id}`,
              type: "checkin",
              title: `${b.guest?.full_name ?? "Guest"} checks in today`,
              subtitle: `${b.booking_number} · Room ${b.room?.room_number ?? "—"}`,
            })
          );

        // Departing today (only actually-in-house bookings, i.e. checked_in)
        rows
          .filter((b) => b.check_out === today && b.booking_status === "checked_in")
          .forEach((b) =>
            items.push({
              id: `checkout-${b.id}`,
              type: "checkout",
              title: `${b.guest?.full_name ?? "Guest"} checks out today`,
              subtitle: `${b.booking_number} · Room ${b.room?.room_number ?? "—"}`,
            })
          );

        // Outstanding balance with checkout coming up within the lookahead window
        rows
          .filter((b) => Number(b.remaining_balance) > 0 && b.check_out >= today && b.check_out <= horizonISO)
          .forEach((b) =>
            items.push({
              id: `payment-${b.id}`,
              type: "payment_due",
              title: `${formatCurrency(Number(b.remaining_balance))} due · ${b.guest?.full_name ?? "Guest"}`,
              subtitle: `${b.booking_number} · Checkout ${formatDate(b.check_out)}`,
            })
          );

        setNotifications(items);
      });
  }, []);

  const count = notifications.length;

  const goToBookings = () => {
    setNotifOpen(false);
    navigate("/bookings");
  };

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

          <div className="relative">
            <motion.button
              onClick={() => setNotifOpen((v) => !v)}
              title={count > 0 ? `${count} notifications` : "No notifications"}
              aria-label={count > 0 ? `${count} notifications` : "No notifications"}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.12 }}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-500 shadow-sm hover:bg-slate-50 md:h-10 md:w-10"
            >
              <Bell className="h-4 w-4" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={SPRING_SNAPPY}
                    className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white ring-2 ring-white"
                  >
                    {count > 9 ? "9+" : count}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <AnimatePresence>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <motion.div
                    variants={dropdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ transformOrigin: "top right" }}
                    className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Notifications</p>
                      {count > 0 && <span className="text-xs text-slate-400">{count} new</span>}
                    </div>

                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <Inbox className="h-6 w-6 text-slate-300" />
                        <p className="text-sm text-slate-400">Nothing needs your attention right now.</p>
                      </div>
                    ) : (
                      <motion.div
                        variants={staggerContainer(30)}
                        initial="initial"
                        animate="animate"
                        className="max-h-80 overflow-y-auto scrollbar-thin"
                      >
                        {notifications.map((n) => (
                          <motion.button
                            key={n.id}
                            variants={staggerItem}
                            onClick={goToBookings}
                            className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                          >
                            <div
                              className={cn(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                n.type === "checkin" && "bg-green-50 text-green-600",
                                n.type === "checkout" && "bg-amber-50 text-amber-600",
                                n.type === "payment_due" && "bg-rose-50 text-rose-600"
                              )}
                            >
                              {n.type === "checkin" && <LogIn className="h-4 w-4" />}
                              {n.type === "checkout" && <LogOut className="h-4 w-4" />}
                              {n.type === "payment_due" && <Wallet className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                              <p className="truncate text-xs text-slate-400">{n.subtitle}</p>
                            </div>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

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
