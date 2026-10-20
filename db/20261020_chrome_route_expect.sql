-- Agent Monitor: the Chrome route (council arc/chrome-keeper, 2026-10-20). Staged by council (docs/evidence/
-- chrome-keeper-staged-press.patch); applied verbatim through the Supabase channel at verify.
-- 1. Register the daily 01:10 CT pre-flight (council environment/system/scheduled-tasks/chrome-preflight.md) — a cloud
--    routine bound to the Mac that proves Claude in Chrome is usable before the night's Chrome jobs. Without this row its
--    `press_agent_checkin('chrome-preflight', …)` raises "unknown check-in agent". Idempotent.
insert into public.press_agent_expect
  (id, app_label, label, what, kind, enabled, source, run_app, run_agent, cron_job, dispatch_only, output_page,
   sched, grace_minutes, fix_hint, fix_links, retry_action, sort, registered_at)
values
('chrome-preflight', 'The Council', 'Chrome route pre-flight', 'Cloud scheduled task bound to the Mac, daily at 1:10 — checks Claude in Chrome works before the night''s Chrome jobs.',
 'browser-task', true, 'checkin', null, null, null, false, null,
 '{"daily":["01:10"]}', 180,
 'Chrome or the Claude in Chrome extension is not connected — open Chrome on the Mac; the keeper (every 30 min) and the 01:00 refresh normally fix it.',
 '[{"label":"Scheduled tasks","url":"https://claude.ai/code/scheduled"}]', null, 76, now())
on conflict (id) do nothing;

-- 2. The chat moved the two Chrome jobs after the 01:00 refresh + 01:10 pre-flight (live triggers updated 2026-10-19
--    22:43 CT): Amazon memos Mon 01:20, Card Scout Wed 01:35. Move their expectations so a real run is never read as late.
update public.press_agent_expect set sched = '{"weekly":{"dow":1,"at":"01:20"}}',
  what = 'Cloud scheduled task bound to the Mac (Chrome), Mondays at 1:20 — adds Amazon order memos to YNAB.'
  where id = 'amazon-memos';
update public.press_agent_expect set sched = '{"weekly":{"dow":3,"at":"01:35"}}',
  what = 'Cloud scheduled task (browser lane) that checks store pages every Wednesday at 1:35.'
  where id = 'card-scout-weekly-store-check';
