-- db/20260926_press_agent_snag_inlet.sql — register the council snag inlet agent.
--
-- The snag inlet (council repo instruments/snag/inlet/, Edge Function `snag-inlet`) receives a dictated
-- snag from the Siri Shortcut "Snag", classifies it with one forced-tool Haiku call against the snag
-- registry, and files a GitHub Issue on the right app's repo. kind = inlet (x-snag-secret header),
-- tier = sealed/response-only: its ONLY database write is the one press_agent_runs ledger row per tick.
--
-- This migration creates NO table, so it carries no GRANT lines (BACKLOG item 5, explicit grants from
-- 2026-10-30, applies only to CREATE TABLE in public). It inserts the one registry row that puts the
-- agent on agent-health.html and in the daily notifier (registry-driven — never a per-agent edit).
-- cadence_minutes NULL: an event-driven inlet with no expected cadence, so the heartbeat never marks it
-- dead for being quiet. review_threshold 0.6 = the confidence floor below which a snag routes to triage.
--
-- Apply via Cowork's Supabase connector (or Mark's Desktop MCP) — Code's MCP is read-only. Idempotent.
insert into public.press_agent_registry
  (app, agent, kind, enabled, model, prompt_version, cadence_minutes, review_threshold)
values
  ('council', 'snag-inlet', 'inlet', true, 'claude-haiku-4-5', 'snag-v1', null, 0.6)
on conflict (app, agent) do update set
  kind = excluded.kind,
  enabled = excluded.enabled,
  model = excluded.model,
  prompt_version = excluded.prompt_version,
  cadence_minutes = excluded.cadence_minutes,
  review_threshold = excluded.review_threshold;

-- Verify (read-only):
--   select app, agent, kind, enabled, model, cadence_minutes, last_ok_at
--   from public.press_agent_registry where agent = 'snag-inlet';   -- expect 1 row, last_ok_at null until the first real tick
