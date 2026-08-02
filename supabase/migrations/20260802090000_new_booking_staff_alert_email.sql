-- ============================================================================
-- Staff alert email on new online booking requests
--
-- When a guest submits a booking on the website, staff should hear about it
-- by email too (not just the realtime dashboard popup), in case nobody has
-- the admin dashboard open. This is a brief heads-up, not the full guest-
-- facing confirmation/rejection template — just enough to know a request is
-- waiting and to go review it.
--
-- Widens notification_log.template to accept 'new_booking_alert' alongside
-- the existing 'booking_approved' / 'booking_rejected' guest templates. The
-- row itself is written by the new send-only `notify-new-booking` edge
-- function (supabase/functions/notify-new-booking), using the service-role
-- key — same "no client insert policy at all" outbox pattern as every other
-- notification_log row.
-- ============================================================================

alter table public.notification_log
  drop constraint if exists notification_log_template_check;

alter table public.notification_log
  add constraint notification_log_template_check
  check (template in ('booking_approved', 'booking_rejected', 'new_booking_alert'));
