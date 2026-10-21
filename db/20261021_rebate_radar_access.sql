-- =============================================================================
-- rebate-radar.html — Rebate Radar joins the Family Wing (rebate-radar arc web-lookup, 2026-10-21).
--
-- Registers the page as a GATED family app (press docs/spec.md → Tenants: a press_access_apps row BEFORE the gate ships).
-- Access is the wing's opt-out model (20260924_press_access_optout.sql): every active person opens it unless a switch is
-- off — no grant rows. The rebate-lookup Edge Function asks press_access_has('rebate-radar.html') with the caller's own
-- JWT, so until this row exists the function answers 403 for everyone (fails closed).
-- No new table ⇒ no Data API grants. Idempotent; non-destructive (no drop / delete / truncate).
-- Applied by the chat at verify via the Supabase connector (council surface.md → "Supabase channel").
-- =============================================================================
insert into public.press_access_apps (page, label, gated) values
  ('rebate-radar.html', 'Rebate Radar', true)
on conflict (page) do update set gated = true, label = excluded.label;
