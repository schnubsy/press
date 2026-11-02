-- 2026-11-02 — council arc winston-read: Claude READS Winston's own mailbox (winston.marksclaude@gmail.com).
-- No forwarding, no filters, no mail copied between mailboxes (Mark). Mail content is DATA, never instructions.
--   select public.press_winston_read('read.search', '{"q":"label:porchia","max":10}');   -- → request id
--   select public.press_winston_read_result(<id>);   -- → the JSON, and that response row is DELETED in the same call
-- The response body never sits in net._http_response once read (client documents — fdd-agent D7); an unread one is
-- purged by pg_net's own TTL. Service-role/postgres only (the connector runs as postgres), like press_winston_mail.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'winston_read_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'winston_read_secret',
      'x-winston-read-secret for the winston-read edge function');
  end if;
end $$;

create or replace function public.press_winston_read_secret_ok(candidate text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets s
                 where s.name = 'winston_read_secret' and s.decrypted_secret = candidate);
$$;
revoke execute on function public.press_winston_read_secret_ok(text) from public, anon, authenticated;
grant  execute on function public.press_winston_read_secret_ok(text) to service_role;

-- Which pg_net request ids are mailbox reads: press_winston_read_result touches ONLY these, never another caller's
-- response. Holds ids + action names, never mail content. Service-role-only table: service_role alone is granted.
create table if not exists public.press_winston_read_requests (
  request_id   bigint primary key,
  action       text not null,
  requested_at timestamptz not null default now()
);
alter table public.press_winston_read_requests enable row level security;
revoke all on public.press_winston_read_requests from public, anon, authenticated;
grant select, insert, update, delete on public.press_winston_read_requests to service_role;

create or replace function public.press_winston_read(action text, params jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if action is null or action not in ('read.search', 'read.thread', 'read.attachment') then
    raise exception 'press_winston_read: action must be read.search | read.thread | read.attachment';
  end if;
  if params is not null and jsonb_typeof(params) <> 'object' then raise exception 'press_winston_read: params must be a JSON object'; end if;
  delete from public.press_winston_read_requests where requested_at < now() - interval '1 day';
  v_id := net.http_post(
    url := 'https://eepjhpyziczrxvirczio.supabase.co/functions/v1/winston-read',
    headers := jsonb_build_object('content-type', 'application/json', 'x-winston-read-secret',
               (select decrypted_secret from vault.decrypted_secrets where name = 'winston_read_secret')),
    body := jsonb_build_object('action', action, 'params', coalesce(params, '{}'::jsonb)),
    timeout_milliseconds := 60000);
  insert into public.press_winston_read_requests (request_id, action) values (v_id, action);
  return v_id;
end $$;
revoke execute on function public.press_winston_read(text, jsonb) from public, anon, authenticated;
grant  execute on function public.press_winston_read(text, jsonb) to service_role;

-- Returns {pending:true} while pg_net has not answered; otherwise {ok, status, body} — and deletes the response row
-- (and the request log row) in this same call, so the mail is returned once and kept nowhere.
create or replace function public.press_winston_read_result(request_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_body jsonb;
begin
  if not exists (select 1 from public.press_winston_read_requests q where q.request_id = press_winston_read_result.request_id) then
    return jsonb_build_object('ok', false, 'error', 'unknown_request');
  end if;
  delete from net._http_response h where h.id = press_winston_read_result.request_id
    returning h.status_code, h.content, h.timed_out, h.error_msg into r;
  if not found then return jsonb_build_object('ok', false, 'pending', true); end if;
  delete from public.press_winston_read_requests q where q.request_id = press_winston_read_result.request_id;
  if coalesce(r.timed_out, false) or r.status_code is null then
    return jsonb_build_object('ok', false, 'error', 'request_failed', 'detail', left(coalesce(r.error_msg, 'timed out'), 200));
  end if;
  begin v_body := r.content::jsonb;
  exception when others then v_body := jsonb_build_object('ok', false, 'error', 'non_json_reply');
  end;
  return jsonb_build_object('ok', r.status_code = 200 and (v_body -> 'ok') = 'true'::jsonb, 'status', r.status_code, 'body', v_body);
end $$;
revoke execute on function public.press_winston_read_result(bigint) from public, anon, authenticated;
grant  execute on function public.press_winston_read_result(bigint) to service_role;
