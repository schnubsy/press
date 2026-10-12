-- db/20261012_agent_monitor_watch_cron.sql — the agent watcher's secret check + its 15-minute pg_cron job
-- (arc marquee-wings-monitor, slice 4). Applied AFTER the agent-watch Edge Function was deployed.
--
-- The shared secret is generated INSIDE the database and lives only in Supabase Vault (`agent-watch_secret`):
-- pg_cron reads it into the x-agent-watch-secret header, and agent-watch verifies it by calling
-- press_agent_watch_secret_ok() — so no human or function env var ever holds the value.
-- Creates no table (no GRANT lines needed). Idempotent.

-- 1. the secret (generated once; never printed)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'agent-watch_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'agent-watch_secret',
                                'agent-watch Edge Function shared secret (pg_cron header)');
  end if;
end $$;

-- 2. secret check (service_role only — called by agent-watch with its service key)
create or replace function public.press_agent_watch_secret_ok(p text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(length(p) >= 32, false) and exists (
    select 1 from vault.decrypted_secrets where name = 'agent-watch_secret' and decrypted_secret = p);
$$;
revoke execute on function public.press_agent_watch_secret_ok(text) from public;
revoke execute on function public.press_agent_watch_secret_ok(text) from anon, authenticated;
grant execute on function public.press_agent_watch_secret_ok(text) to service_role;

-- 3. the 15-minute schedule (cron.schedule upserts by name)
select cron.schedule('agent-watch', '*/15 * * * *', $cron$
  select net.http_post(
    url     := 'https://eepjhpyziczrxvirczio.supabase.co/functions/v1/agent-watch',
    headers := jsonb_build_object(
      'content-type',         'application/json',
      'x-agent-watch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'agent-watch_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$cron$);
