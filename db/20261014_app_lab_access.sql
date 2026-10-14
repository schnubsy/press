-- App Lab (family wing) — register the page with the access framework BEFORE its gate ships
-- (press docs/spec.md → Tenants: "for a family page, a press_access_apps row (gated) BEFORE the gate ships").
-- Opt-out access (2026-09-24): every active person is in unless a switch is off — no grant rows needed.
-- No new table, so no Data API grants are needed. Idempotent: insert if missing, force gated on.
insert into public.press_access_apps (page, label, gated) values
  ('app-lab.html', 'App Lab', true)
on conflict (page) do update set gated = true, label = excluded.label;
