-- ============================================================================
-- Fix: room availability must be calculated from booking dates, not a
-- permanent "occupied" status on the room itself.
--
-- Previously the app set rooms.status = 'occupied' when a booking was
-- created and left it that way (or set it to 'cleaning' on checkout), which
-- meant a room could stay blocked forever even after its booking's
-- check-out date had passed — new bookings for future date ranges were
-- incorrectly rejected in the UI.
--
-- The database already prevents true overlapping bookings via the
-- `no_overlapping_room_bookings` exclusion constraint (see
-- 20260707000000_init.sql), which correctly uses a half-open date range
-- `[check_in, check_out)` — so a booking checking in on another booking's
-- check-out date is allowed. That part was always correct.
--
-- The app layer has been updated to stop writing 'occupied' on booking
-- creation and 'cleaning' on checkout, and instead computes availability
-- live from the bookings table for the guest's selected dates. This
-- migration is a one-time data fix for any rooms already stuck from the
-- old behavior.
-- ============================================================================

update public.rooms
set status = 'available'
where status = 'occupied';
