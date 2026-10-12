-- 2026-10-12 — RULE (Mark): every email Claude sends comes from Winston (winston.marksclaude@gmail.com).
-- press_winston_mail(subject, body[, to[], cc[]]) is the one SQL entry point: scheduled tasks, Steward runs and any
-- Supabase-connector session call it instead of the Gmail connector. Service-role/postgres only (the connector runs as
-- postgres); it posts via pg_net to the `winston-mail` Edge Function with a Vault-held header secret.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'winston_mail_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'winston_mail_secret',
      'x-winston-mail-secret for the winston-mail edge function');
  end if;
end $$;

create or replace function public.press_winston_mail_secret_ok(candidate text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets s
                 where s.name = 'winston_mail_secret' and s.decrypted_secret = candidate);
$$;
revoke execute on function public.press_winston_mail_secret_ok(text) from public, anon, authenticated;
grant  execute on function public.press_winston_mail_secret_ok(text) to service_role;

create or replace function public.press_winston_mail(subject text, body text, to_addrs text[] default null, cc_addrs text[] default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  if coalesce(trim(subject), '') = '' then raise exception 'press_winston_mail: subject is required'; end if;
  v_payload := jsonb_build_object('subject', left(subject, 200), 'text', left(coalesce(body, ''), 20000));
  if to_addrs is not null and array_length(to_addrs, 1) > 0 then v_payload := v_payload || jsonb_build_object('to', to_jsonb(to_addrs)); end if;
  if cc_addrs is not null and array_length(cc_addrs, 1) > 0 then v_payload := v_payload || jsonb_build_object('cc', to_jsonb(cc_addrs)); end if;
  return net.http_post(
    url := 'https://eepjhpyziczrxvirczio.supabase.co/functions/v1/winston-mail',
    headers := jsonb_build_object('content-type', 'application/json', 'x-winston-mail-secret',
               (select decrypted_secret from vault.decrypted_secrets where name = 'winston_mail_secret')),
    body := v_payload, timeout_milliseconds := 20000);
end $$;
revoke execute on function public.press_winston_mail(text, text, text[], text[]) from public, anon, authenticated;
grant  execute on function public.press_winston_mail(text, text, text[], text[]) to service_role;
