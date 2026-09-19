-- 20260918_press_vault.sql — one encrypted keyring row per enrolled passkey.
-- Idempotent. Mirrors the press_fsa / press_retirement header-gated RLS pattern byte-for-byte in
-- shape, with ONE deliberate difference: DELETE is granted to anon and gated the same way, so a
-- device can be revoked from the browser (a caller can only delete the row whose credential id it
-- can present).
--
-- The AES-256-GCM key is derived IN THE BROWSER from the WebAuthn PRF output (HKDF-SHA-256) and
-- never reaches the server. This table holds CIPHERTEXT ONLY — there is no readable data here. The
-- anon-write exception is justified by that and is NOT a precedent for other tables.

create table if not exists public.press_vault (
  id         text primary key,          -- SHA-256 (hex) of the passkey's raw credential id; never the raw id
  ciphertext text not null,             -- AES-256-GCM ciphertext of the keyring (base64)
  iv         text not null,             -- 12-byte GCM IV, fresh per write (base64)
  salt       text not null,             -- per-row HKDF salt (base64)
  kdf        text not null default 'hkdf-sha256',
  version    int  not null default 1,
  label      text,                      -- human label for the enrolled device
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.press_vault is
  'One AES-256-GCM-encrypted keyring per enrolled passkey. id is the SHA-256 (hex) of the passkey''s '
  'raw credential id — never the raw id. ciphertext/iv/salt hold CIPHERTEXT ONLY; the key is derived '
  'in the browser from the WebAuthn PRF output (HKDF-SHA-256) and never reaches the server, so no '
  'readable data exists here. RLS gates every row on the x-vault-id header = id. DELETE is granted '
  'to anon (gated the same way) so a device can be revoked from the browser — justified by the '
  'ciphertext-only design and NOT a precedent for other tables.';

-- updated_at maintained server-authoritatively (same as press_retirement).
create or replace function public.press_vault_touch_updated_at()
returns trigger language plpgsql
set search_path = ''            -- pinned: silences function_search_path_mutable; now() is in pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists press_vault_touch on public.press_vault;
create trigger press_vault_touch before update on public.press_vault
  for each row execute function public.press_vault_touch_updated_at();

alter table public.press_vault enable row level security;
revoke all on table public.press_vault from anon, authenticated;
grant all on table public.press_vault to service_role;
grant select, insert, update, delete on table public.press_vault to anon, authenticated;

drop policy if exists press_vault_sel on public.press_vault;
create policy press_vault_sel on public.press_vault for select to anon, authenticated
  using (id = nullif(current_setting('request.headers', true)::json ->> 'x-vault-id', ''));

drop policy if exists press_vault_ins on public.press_vault;
create policy press_vault_ins on public.press_vault for insert to anon, authenticated
  with check (id = nullif(current_setting('request.headers', true)::json ->> 'x-vault-id', ''));

drop policy if exists press_vault_upd on public.press_vault;
create policy press_vault_upd on public.press_vault for update to anon, authenticated
  using (id = nullif(current_setting('request.headers', true)::json ->> 'x-vault-id', ''))
  with check (id = nullif(current_setting('request.headers', true)::json ->> 'x-vault-id', ''));

-- The deliberate difference from press_fsa: DELETE is allowed, but only for the row whose
-- credential id the caller can present in the x-vault-id header.
drop policy if exists press_vault_del on public.press_vault;
create policy press_vault_del on public.press_vault for delete to anon, authenticated
  using (id = nullif(current_setting('request.headers', true)::json ->> 'x-vault-id', ''));
