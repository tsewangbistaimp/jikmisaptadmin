import * as React from "react";
import { toast } from "sonner";
import { Search, Eye, CheckCircle2, XCircle, Pencil, ArrowUpDown, Globe, TrendingDown, RotateCw, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState, PageLoader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { bookingStatusTone } from "@/lib/badge-tones";
import { PRICING_METHOD_LABELS, BOOKING_STATUS_LABELS } from "@/lib/constants";
import { useOnlineBookings, useNotificationLog } from "@/hooks/useOnlineBookings";
import { retryNotification } from "@/lib/notifications/NotificationService";
import type { BookingWithRelations, NotificationLog } from "@/lib/database.types";
import {
  OnlineBookingDetailDialog,
  ApproveBookingDialog,
  RejectBookingDialog,
  ModifyBookingStayDialog,
  PaymentReviewDialog,
  NotificationStatusBadge,
} from "@/components/bookings/OnlineBookingDialogs";

const PAGE_SIZE = 10;
type Tab = "pending_approval" | "payment_under_review" | "confirmed" | "rejected" | "all" | "notifications";
type SortKey = "created_at" | "check_in" | "total_amount";

const TABS: { value: Tab; label: string }[] = [
  { value: "pending_approval", label: "Pending" },
  { value: "payment_under_review", label: "Payment Review" },
  { value: "confirmed", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
  { value: "notifications", label: "Notifications" },
];

export default function OnlineBookings() {
  const { bookings, loading, reload } = useOnlineBookings();
  const { notifications, loading: notificationsLoading, reload: reloadNotifications } = useNotificationLog();
  const [tab, setTab] = React.useState<Tab>("pending_approval");
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);

  const [viewing, setViewing] = React.useState<BookingWithRelations | null>(null);
  const [approving, setApproving] = React.useState<BookingWithRelations | null>(null);
  const [rejecting, setRejecting] = React.useState<BookingWithRelations | null>(null);
  const [modifying, setModifying] = React.useState<BookingWithRelations | null>(null);
  const [reviewingPayment, setReviewingPayment] = React.useState<BookingWithRelations | null>(null);

  const pendingCount = bookings.filter((b) => b.booking_status === "pending_approval").length;

  // Opportunistic sweep — this project has no cron/scheduled-task
  // infrastructure, so a website booking that's sat unpaid in
  // pending_approval/payment_under_review past 24h only actually flips to
  // 'expired' the next time someone loads this page. See
  // expire_stale_payment_reviews() in the 20260803000000 migration.
  React.useEffect(() => {
    supabase.rpc("expire_stale_payment_reviews").then(({ data, error }) => {
      if (!error && typeof data === "number" && data > 0) reload();
    });
  }, [reload]);

  const filtered = React.useMemo(() => {
    if (tab === "notifications") return [];
    let rows = bookings;
    if (tab !== "all") rows = rows.filter((b) => b.booking_status === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          b.booking_number.toLowerCase().includes(q) ||
          b.guest?.full_name?.toLowerCase().includes(q) ||
          b.guest?.phone?.toLowerCase().includes(q) ||
          b.room?.room_number?.toLowerCase().includes(q)
      );
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [bookings, tab, query, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  React.useEffect(() => setPage(1), [tab, query]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const openFromDetail = (setter: (b: BookingWithRelations) => void) => (b: BookingWithRelations) => {
    setViewing(null);
    setter(b);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            <Globe className="h-5 w-5 text-brand-500" /> Online Booking Requests
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pendingCount > 0 ? `${pendingCount} awaiting your review` : "Guest website requests, reviewed here before confirmation"}
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => {
              const count =
                t.value === "all"
                  ? bookings.length
                  : t.value === "notifications"
                    ? notifications.filter((n) => n.status === "failed").length
                    : bookings.filter((b) => b.booking_status === t.value).length;
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    tab === t.value
                      ? "bg-brand-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs",
                      tab === t.value ? "bg-white/20" : "bg-white text-slate-500 dark:bg-slate-900"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guest, phone, booking ID or room…"
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {tab === "notifications" ? (
        <NotificationsPanel notifications={notifications} loading={notificationsLoading} bookings={bookings} onReload={reloadNotifications} />
      ) : (
      <Card className="overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No requests here"
            description={tab === "pending_approval" ? "No pending online booking requests right now." : "Nothing matches this view yet."}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Booking ID</TH>
                    <TH>Guest</TH>
                    <TH>Room</TH>
                    <SortableTH label="Check-in" onClick={() => toggleSort("check_in")} />
                    <TH>Nights</TH>
                    <TH>Pricing</TH>
                    <SortableTH label="Total" onClick={() => toggleSort("total_amount")} />
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {paginated.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-medium text-slate-900 dark:text-slate-100">{b.booking_number}</TD>
                      <TD>
                        <p className="text-slate-700 dark:text-slate-300">{b.guest?.full_name}</p>
                        <p className="text-xs text-slate-400">{b.guest?.phone}</p>
                      </TD>
                      <TD>
                        {b.room?.room_number} <span className="text-xs text-slate-400">· {b.room?.room_type}</span>
                      </TD>
                      <TD>
                        {formatDate(b.check_in)} <span className="text-xs text-slate-400">→ {formatDate(b.check_out)}</span>
                      </TD>
                      <TD>{b.nights}</TD>
                      <TD>
                        {b.pricing_method && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            {b.pricing_method === "monthly" && <TrendingDown className="h-3 w-3 text-emerald-500" />}
                            {PRICING_METHOD_LABELS[b.pricing_method]}
                          </span>
                        )}
                      </TD>
                      <TD className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(b.total_amount)}</TD>
                      <TD>
                        <Badge tone={bookingStatusTone(b.booking_status)} className="w-fit">
                          {BOOKING_STATUS_LABELS[b.booking_status] ?? b.booking_status}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <IconButton title="View" onClick={() => setViewing(b)}>
                            <Eye className="h-4 w-4" />
                          </IconButton>
                          {b.booking_status === "pending_approval" && (
                            <>
                              <IconButton title="Modify" onClick={() => setModifying(b)}>
                                <Pencil className="h-4 w-4" />
                              </IconButton>
                              <IconButton title="Reject" onClick={() => setRejecting(b)} destructive>
                                <XCircle className="h-4 w-4" />
                              </IconButton>
                              <IconButton title="Approve" onClick={() => setApproving(b)}>
                                <CheckCircle2 className="h-4 w-4" />
                              </IconButton>
                            </>
                          )}
                          {b.booking_status === "payment_under_review" && (
                            <IconButton title="Review Payment" onClick={() => setReviewingPayment(b)}>
                              <Wallet className="h-4 w-4" />
                            </IconButton>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
              {paginated.map((b) => (
                <div key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{b.booking_number}</p>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-400">{b.guest?.full_name}</p>
                      <p className="text-xs text-slate-400">{b.guest?.phone}</p>
                    </div>
                    <Badge tone={bookingStatusTone(b.booking_status)} className="w-fit shrink-0">
                      {BOOKING_STATUS_LABELS[b.booking_status] ?? b.booking_status}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Room</p>
                      <p className="text-slate-700 dark:text-slate-300">{b.room?.room_number ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Check-in / out</p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {formatDate(b.check_in)} – {formatDate(b.check_out)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Pricing</p>
                      <p className="text-slate-700 dark:text-slate-300">{b.pricing_method ? PRICING_METHOD_LABELS[b.pricing_method] : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Total</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(b.total_amount)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <IconButton title="View" onClick={() => setViewing(b)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    {b.booking_status === "pending_approval" && (
                      <>
                        <IconButton title="Modify" onClick={() => setModifying(b)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="Reject" onClick={() => setRejecting(b)} destructive>
                          <XCircle className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="Approve" onClick={() => setApproving(b)}>
                          <CheckCircle2 className="h-4 w-4" />
                        </IconButton>
                      </>
                    )}
                    {b.booking_status === "payment_under_review" && (
                      <IconButton title="Review Payment" onClick={() => setReviewingPayment(b)}>
                        <Wallet className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
      )}

      <OnlineBookingDetailDialog
        booking={viewing}
        onClose={() => setViewing(null)}
        onApprove={openFromDetail(setApproving)}
        onReject={openFromDetail(setRejecting)}
        onModify={openFromDetail(setModifying)}
        onReviewPayment={openFromDetail(setReviewingPayment)}
      />
      <ApproveBookingDialog booking={approving} onClose={() => setApproving(null)} onDone={reload} />
      <RejectBookingDialog booking={rejecting} onClose={() => setRejecting(null)} onDone={reload} />
      <ModifyBookingStayDialog booking={modifying} onClose={() => setModifying(null)} onDone={reload} />
      <PaymentReviewDialog booking={reviewingPayment} onClose={() => setReviewingPayment(null)} onDone={reload} />
    </div>
  );
}

/** Cross-booking notification history — the "Admins should also be able to
 *  view complete notification history" requirement. Joins against the
 *  already-loaded bookings list (has guest/room relations) purely
 *  client-side to avoid a second round-trip query. */
function NotificationsPanel({
  notifications,
  loading,
  bookings,
  onReload,
}: {
  notifications: NotificationLog[];
  loading: boolean;
  bookings: BookingWithRelations[];
  onReload: () => void;
}) {
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const bookingById = React.useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const handleRetry = async (row: NotificationLog) => {
    setRetryingId(row.id);
    const outcome = await retryNotification(row);
    setRetryingId(null);
    if (outcome.status === "sent") {
      toast.success("Notification delivered on retry.");
    } else {
      toast.warning(`Retry failed: ${outcome.failureReason ?? "delivery unsuccessful"}`);
    }
    onReload();
  };

  return (
    <Card className="overflow-hidden">
      {loading ? (
        <PageLoader />
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="Guest notifications queue up here as soon as a booking is approved or rejected." />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((n) => {
            const booking = n.booking_id ? bookingById.get(n.booking_id) : undefined;
            return (
              <div key={n.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <NotificationStatusBadge status={n.status} />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {booking?.booking_number ?? "—"}
                    </span>
                    <span className="text-xs capitalize text-slate-400">{n.channel}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                    {booking?.guest?.full_name ?? "Guest"} · {n.recipient || "no contact on file"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {n.status === "sent" && n.sent_at ? `Sent ${formatDateTime(n.sent_at)}` : n.failure_reason ?? `Queued ${formatDateTime(n.created_at)}`}
                    {n.retry_count > 0 && ` · retried ${n.retry_count}×`}
                  </p>
                </div>
                {n.status === "failed" && (
                  <Button size="sm" variant="outline" onClick={() => handleRetry(n)} loading={retryingId === n.id} className="shrink-0">
                    <RotateCw className="h-3.5 w-3.5" /> Retry
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SortableTH({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <TH>
      <button onClick={onClick} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TH>
  );
}
