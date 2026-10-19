-- Agent Monitor: register the weekly Amazon memos task (council arc/night-window-amazon-memos, 2026-10-19) as a
-- check-in task. A chat-created cloud routine bound to the Mac: Claude in Chrome (the Amazon order pages) + the Mac's
-- ynab-mcp-server write the memos. Night window (council dispatch.md → "Night window"): Mondays 01:43 CT.
-- Without this row its `press_agent_checkin('amazon-memos', …)` raises "unknown check-in agent". Idempotent.
insert into public.press_agent_expect
  (id, app_label, label, what, kind, enabled, source, run_app, run_agent, cron_job, dispatch_only, output_page,
   sched, grace_minutes, fix_hint, fix_links, retry_action, sort, registered_at)
values
('amazon-memos', 'The Money', 'Amazon memos', 'Cloud scheduled task bound to the Mac (Chrome), Mondays at 1:43 — adds Amazon order memos to YNAB.',
 'browser-task', true, 'checkin', null, null, null, false, null,
 '{"weekly":{"dow":1,"at":"01:43"}}', 1440,
 'Mac asleep, Chrome closed or ynab-mcp-server down — wake the Mac, reopen Chrome, check Settings → Developer.',
 '[{"label":"Scheduled tasks","url":"https://claude.ai/code/scheduled"}]', null, 75, now())
on conflict (id) do nothing;

-- Night window (council RULE 2026-10-18): move the existing check-in expectations to the tasks' new times so a real run
-- is never read as late. Idempotent (plain sets).
update public.press_agent_expect set sched = '{"weekly":{"dow":3,"at":"03:41"}}',
  what = 'Cloud scheduled task (browser lane) that checks store pages every Wednesday at 3:41.'
  where id = 'card-scout-weekly-store-check';
update public.press_agent_expect set sched = '{"weekly":{"dow":1,"at":"02:52"}}',
  what = 'Cloud scheduled task every Monday 2:52 — checks whether the Cowork Supabase pop-up bug is fixed.'
  where id = 'cowork-popup-watch';
update public.press_agent_expect set sched = '{"monthly":{"dom":2,"at":"02:13"}}',
  what = 'Cloud scheduled task on the 2nd at 2:13 — works the snag backlog.'
  where id = 'snag-train';
update public.press_agent_expect set sched = '{"monthly":{"dom":1,"at":"04:14"}}',
  what = 'Mac Desktop scheduled task on the 1st at 4:14 — plugin drift audit.'
  where id = 'steward-audit';
update public.press_agent_expect set sched = '{"weekly":{"dow":1,"at":"04:24"}}',
  what = 'Mac Desktop scheduled task, Mondays at 4:24 — weekly diff-only environment watch.'
  where id = 'steward-watch';
