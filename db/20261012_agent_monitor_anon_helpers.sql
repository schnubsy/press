-- hotfix (2026-10-12): the public monitor view calls press_agent_last_due / press_agent_next_due, and Postgres
-- checks EXECUTE on functions as the CALLING role even inside a definer-owned view — anon got "permission denied",
-- PostgREST answered 401 and agent-health.html showed "Can't check the agents right now". Both are pure schedule
-- maths (no table access, not security definer), so anon/authenticated may execute them.
grant execute on function public.press_agent_last_due(jsonb, timestamptz) to anon, authenticated;
grant execute on function public.press_agent_next_due(jsonb, timestamptz) to anon, authenticated;
