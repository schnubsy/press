-- Agent Monitor: register the weekly Steward watch (council v4.14.0 `watch` instrument) as a check-in task.
-- Without this row its `press_agent_checkin('steward-watch', …)` raises "unknown check-in agent".
-- Council arc/dispatch-env-safari S0(d), 2026-10-12. Idempotent.
insert into public.press_agent_expect
  (id, app_label, label, what, kind, enabled, source, run_app, run_agent, cron_job, dispatch_only, output_page,
   sched, grace_minutes, fix_hint, fix_links, retry_action, sort, registered_at)
values
('steward-watch', 'The Council', 'Steward watch', 'Mac Desktop scheduled task, Mondays at 8:47 — weekly diff-only environment watch.',
 'mac-task', true, 'checkin', null, null, null, false, 'steward.html',
 '{"weekly":{"dow":1,"at":"08:47"}}', 1440,
 'Wake the Mac, open Claude Desktop → Code → Routines, and run "Steward watch" now.', '[]', null, 74, now())
on conflict (id) do nothing;
