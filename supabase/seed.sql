-- ============================================================================
-- Optional starter data. Run after migrations.
-- The Super Admin account itself is NOT created here — see README "Initial
-- Setup" for creating it securely through Supabase Auth (so the password is
-- hashed by Supabase, never stored in plain text in this repo or the DB).
-- ============================================================================

insert into public.rooms (room_number, room_type, price, status) values
  ('101', 'Standard', 2500, 'available'),
  ('102', 'Standard', 2500, 'available'),
  ('201', 'Deluxe',   3500, 'available'),
  ('202', 'Deluxe',   3500, 'available'),
  ('301', 'Suite',    5500, 'available')
on conflict (room_number) do nothing;
