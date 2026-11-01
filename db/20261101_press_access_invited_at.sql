-- 2026-11-01 — family-wing-invites slice 1: when the invite email last went out (rate limit + "Invited <date>" on the
-- Access Manager card). One additive column. Existing RLS (admin write · own-row read) already covers it; no new table,
-- so no new grants. Written only by the access-invite Edge Function (service role) and read by the admin.
alter table public.press_access_people add column if not exists invited_at timestamptz;
