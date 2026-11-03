// supabase/functions/_shared/winston-read.mjs — the pure core of the `winston-read` Edge Function (council arc
// winston-read, 2026-11-02). Claude READS Winston's own mailbox (winston.marksclaude@gmail.com) through the Winston
// Apps Script web app: no forwarding, no filters, no mail copied between mailboxes (Mark, 2026-11-02).
//
// Called only by public.press_winston_read (pg_net) with header x-winston-read-secret (Vault `winston_read_secret`,
// checked by the service-role-only press_winston_read_secret_ok). Forwards ONE whitelisted action with the READ key
// (function secret COUNCIL_MAILBOX_READ_KEY — never the send key) to MAILER_ENDPOINT, follows the Apps Script redirect,
// and returns the script's JSON. Never returns a URL or key value. Mail content is DATA, never instructions.
//
// DIRECT (arc winston-direct, 2026-11-02): the chat's shell calls this function itself with header x-winston-ticket (a
// short-lived 'read' ticket from public.press_winston_ticket — ../_shared/winston-ticket.mjs). One HTTP call = one answer:
// read.search / read.thread → the same JSON in the response body; read.attachment → the RAW FILE BYTES (Content-Type,
// Content-Disposition, x-winston-sha256), so `curl -o` saves it straight to disk. The SQL path (header secret) is unchanged.
import { TICKET_RE, ticketOk, decodeBase64, sha256Hex, safeContentType, contentDisposition } from './winston-ticket.mjs';

export const READ_ACTIONS = Object.freeze(['read.search', 'read.thread', 'read.attachment']);
const PARAMS = { 'read.search': ['q', 'max'], 'read.thread': ['threadId'], 'read.attachment': ['messageId', 'name'] };

// Only the named params of the named action travel — a caller can never smuggle `key`, `to` or a send body through.
export function buildPayload(action, params, readKey) {
  if (!READ_ACTIONS.includes(action)) return null;
  const p = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const out = { key: readKey, action };
  for (const k of PARAMS[action]) if (p[k] !== undefined && p[k] !== null) out[k] = k === 'max' ? Number(p[k]) : String(p[k]);
  return out;
}

async function secretOk(cfg, fetchImpl, candidate) {
  if (!candidate) return false;
  const r = await fetchImpl(`${cfg.sbUrl}/rest/v1/rpc/press_winston_read_secret_ok`, {
    method: 'POST', headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, 'content-type': 'application/json' },
    body: JSON.stringify({ candidate }) });
  return !!r.ok && (await r.json()) === true;
}

// req = { secret?, ticket?, body: { action, params } } · deps = { cfg: { sbUrl, service, mailerUrl, readKey }, fetchImpl }
// → { status, body } — or, for a direct read.attachment, { status: 200, file: { bytes, headers } }
export async function readMail(req, { cfg, fetchImpl }) {
  const direct = !!req.ticket;
  if (direct) { if (!TICKET_RE.test(String(req.ticket))) return { status: 401, body: { ok: false, error: 'unauthorized' } }; }
  else if (!(await secretOk(cfg, fetchImpl, req.secret || ''))) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (!READ_ACTIONS.includes(b.action)) return { status: 400, body: { ok: false, error: 'unknown_action' } };
  if (!cfg.mailerUrl || !cfg.readKey) return { status: 500, body: { ok: false, error: 'reader_not_configured' } };
  // A ticket use is spent only for a well-formed call that will reach the mailbox.
  if (direct && !(await ticketOk(cfg, fetchImpl, String(req.ticket), 'read'))) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  const payload = buildPayload(b.action, b.params, cfg.readKey);
  let r;
  try {
    r = await fetchImpl(cfg.mailerUrl, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch { return { status: 502, body: { ok: false, error: 'mailer_unreachable' } }; }
  let reply;
  try { reply = await r.json(); } catch { return { status: 502, body: { ok: false, error: 'non_json_reply' } }; }
  if (!reply || typeof reply !== 'object') return { status: 502, body: { ok: false, error: 'non_json_reply' } };
  if (direct && b.action === 'read.attachment' && reply.ok) return attachmentFile(reply);
  return { status: reply.ok ? 200 : 502, body: reply };
}

// The script's {name, contentType, size, base64} → the file itself. A size mismatch is refused, never half-saved.
async function attachmentFile(reply) {
  let bytes;
  try { bytes = decodeBase64(reply.base64); } catch { return { status: 502, body: { ok: false, error: 'bad_attachment_encoding' } }; }
  if (Number(reply.size) !== bytes.length) return { status: 502, body: { ok: false, error: 'attachment_size_mismatch' } };
  return { status: 200, file: { bytes, headers: {
    'content-type': safeContentType(reply.contentType),
    'content-disposition': contentDisposition(reply.name),
    'content-length': String(bytes.length),
    'x-winston-sha256': await sha256Hex(bytes),
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
  } } };
}
