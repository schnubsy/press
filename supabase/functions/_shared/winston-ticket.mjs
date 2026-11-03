// supabase/functions/_shared/winston-ticket.mjs — the short-lived ticket check shared by `winston-read` and
// `winston-draft` (council arc winston-direct, 2026-11-02). The chat mints a ticket with public.press_winston_ticket
// (service-role SQL) and sends it as header x-winston-ticket; this spends ONE use server-side via
// public.press_winston_ticket_redeem. The long-lived header secrets and Apps Script keys never reach the caller.
export const TICKET_RE = /^[0-9a-f]{64}$/;

// → true only when the database spent one use of an unexpired ticket of exactly `scope`.
// A malformed ticket never reaches the database.
export async function ticketOk(cfg, fetchImpl, candidate, scope) {
  if (typeof candidate !== 'string' || !TICKET_RE.test(candidate)) return false;
  const r = await fetchImpl(`${cfg.sbUrl}/rest/v1/rpc/press_winston_ticket_redeem`, {
    method: 'POST', headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, 'content-type': 'application/json' },
    body: JSON.stringify({ candidate, want_scope: scope }) });
  return !!r.ok && (await r.json()) === true;
}

// Raw-file helpers for read.attachment over the direct path.
export function decodeBase64(b64) {
  const bin = atob(String(b64 || ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export async function sha256Hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
export function safeContentType(t) {
  const s = String(t || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(s) ? s : 'application/octet-stream';
}
// RFC 6266: an ASCII fallback (no quote, backslash, control or non-ASCII) + the exact UTF-8 name. No header injection.
export function contentDisposition(name) {
  const n = String(name || 'attachment').replace(/[\r\n]/g, ' ');
  const ascii = n.replace(/[^A-Za-z0-9._ ()-]/g, '_').slice(0, 150) || 'attachment';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(n).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`;
}
