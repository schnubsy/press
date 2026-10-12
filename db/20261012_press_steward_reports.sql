-- press_steward_reports — the Steward's weekly watch + monthly audit reports, for the marquee's PRIVATE wing.
-- CONTRACT (council v4.14.0, skills/hand/references/watch.md → Outputs). Applied by the press arc
-- "press: steward report page" (docs/migration/next-dispatch.md), via the Supabase connector — not by the council arc.
-- Writers: the watch + audit runs (service role, via the connector). Reader: Mark only, through the private wing's
-- passkey-gated read path (press/docs/spec.md → Tenants) — so the table is SERVICE-ROLE-ONLY: no anon, no
-- authenticated grant, RLS on with no policies (deny-all to every non-service role).
create table if not exists public.press_steward_reports (
  id          bigint generated always as identity primary key,
  run_at      timestamptz not null default now(),
  cadence     text not null check (cadence in ('weekly', 'monthly')),
  headline    text not null check (headline in ('🟢', '🟡', '🔴')),
  summary     text not null,                       -- the one-line headline text
  sections    jsonb not null default '{}'::jsonb,  -- { needs_you: [], fixed_for_you: [], cost_moves: [], all_clear: "" }
  model       text,                                -- the model that ran it (e.g. 'sonnet')
  cost_usd    numeric(10, 4)                       -- the run's own cost, when readable
);
create index if not exists press_steward_reports_run_at on public.press_steward_reports (run_at desc);
alter table public.press_steward_reports enable row level security;
-- Data API grants (control-files.md): service-role-only by design — reads go through the private-wing gate.
revoke all on public.press_steward_reports from anon, authenticated;
grant select, insert, update, delete on public.press_steward_reports to service_role;
