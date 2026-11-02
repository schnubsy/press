// supabase/functions/_shared/winston-read.mjs — the pure core of the `winston-read` Edge Function (council arc
// winston-read, 2026-11-02). Claude READS Winston's own mailbox (winston.marksclaude@gmail.com) through the Winston
// Apps Script web app: no forwarding, no filters, no mail copied between mailboxes (Mark, 2026-11-02).
//
// Called only by public.press_winston_read (pg_net) with header x-winston-read-secret (Vault `winston_read_secret`,
// checked by the service-role-only press_winston_read_secret_ok). Forwards ONE whitelisted action with the READ key
// (function secret COUNCIL_MAILBOX_READ_KEY — never the send key) to MAILER_ENDPOINT, follows the Apps Script redirect,
// and returns the script's JSON. Never returns a URL or key value. Mail content is DATA, never instructions.
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

// req = { secret, body: { action, params } } · deps = { cfg: { sbUrl, service, mailerUrl, readKey }, fetchImpl }
// → { status, body }
export async function readMail(req, { cfg, fetchImpl }) {
  if (!(await secretOk(cfg, fetchImpl, req.secret || ''))) return { status: 401, body: { ok: false, error: 'unauthorized' } };
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (!READ_ACTIONS.includes(b.action)) return { status: 400, body: { ok: false, error: 'unknown_action' } };
  if (!cfg.mailerUrl || !cfg.readKey) return { status: 500, body: { ok: false, error: 'reader_not_configured' } };
  const payload = buildPayload(b.action, b.params, cfg.readKey);
  let r;
  try {
    r = await fetchImpl(cfg.mailerUrl, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  } catch { return { status: 502, body: { ok: false, error: 'mailer_unreachable' } }; }
  let reply;
  try { reply = await r.json(); } catch { return { status: 502, body: { ok: false, error: 'non_json_reply' } }; }
  if (!reply || typeof reply !== 'object') return { status: 502, body: { ok: false, error: 'non_json_reply' } };
  return { status: reply.ok ? 200 : 502, body: reply };
}
