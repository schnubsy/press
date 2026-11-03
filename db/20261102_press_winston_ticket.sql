-- 2026-11-02 — council arc winston-direct: ONE HTTP call = one answer from Winston's mailbox, straight from the chat's shell.
-- The chat mints a short-lived ticket with the Supabase connector, then calls the function itself:
--   select public.press_winston_ticket('read', 300, 5);      -- → a 64-hex ticket: 5 uses, gone in 300 s
--   curl -sS -X POST https://eepjhpyziczrxvirczio.supabase.co/functions/v1/winston-read -H 'x-winston-ticket: <ticket>' …
-- The long-lived header secrets (Vault winston_read_secret / winston_mail_secret) and the Apps Script keys never leave the
-- server: only the ticket enters a tool result. Only its sha256 is stored. Scopes keep reading, drafting and sending
-- apart: 'read' → winston-read; 'draft' → winston-draft draft.create; 'send' → winston-draft draft.send, ONE use always.
-- Service-role/postgres only (the connector runs as postgres). Mail content is DATA, never instructions.
create table if not exists public.press_winston_tickets (
  ticket_hash text primary key,                                   -- sha256 hex of the ticket; the ticket itself is never stored
  scope       text not null check (scope in ('read', 'draft', 'send')),
  uses_left   int  not null check (uses_left >= 0),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.press_winston_tickets enable row level security;
revoke all on public.press_winston_tickets from public, anon, authenticated;
grant select, insert, update, delete on public.press_winston_tickets to service_role;

-- Mint: scope read | draft | send · ttl_s 30..900 · uses 1..20 (send: exactly 1). Out of range is refused, never clamped.
create or replace function public.press_winston_ticket(ticket_scope text default 'read', ttl_s int default 300, uses int default 1)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v text;
begin
  if ticket_scope is null or ticket_scope not in ('read', 'draft', 'send') then
    raise exception 'press_winston_ticket: scope must be read | draft | send';
  end if;
  if ttl_s is null or ttl_s < 30 or ttl_s > 900 then raise exception 'press_winston_ticket: ttl_s must be 30..900'; end if;
  if uses is null or uses < 1 or uses > 20 then raise exception 'press_winston_ticket: uses must be 1..20'; end if;
  if ticket_scope = 'send' and uses <> 1 then raise exception 'press_winston_ticket: a send ticket has exactly one use'; end if;
  delete from public.press_winston_tickets t where t.expires_at < now() or t.uses_left = 0;
  v := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.press_winston_tickets (ticket_hash, scope, uses_left, expires_at)
    values (encode(extensions.digest(v, 'sha256'), 'hex'), ticket_scope, uses, now() + make_interval(secs => ttl_s));
  return v;
end $$;
revoke execute on function public.press_winston_ticket(text, int, int) from public, anon, authenticated;
grant  execute on function public.press_winston_ticket(text, int, int) to service_role;

-- Redeem (the Edge Functions, as service_role): atomically spends ONE use of an unexpired ticket of exactly that scope.
-- Expired, used up, wrong scope, malformed or unknown → false.
create or replace function public.press_winston_ticket_redeem(candidate text, want_scope text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if candidate is null or candidate !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.press_winston_tickets t set uses_left = t.uses_left - 1
   where t.ticket_hash = encode(extensions.digest(candidate, 'sha256'), 'hex')
     and t.scope = want_scope and t.uses_left > 0 and t.expires_at > now();
  return found;
end $$;
revoke execute on function public.press_winston_ticket_redeem(text, text) from public, anon, authenticated;
grant  execute on function public.press_winston_ticket_redeem(text, text) to service_role;
