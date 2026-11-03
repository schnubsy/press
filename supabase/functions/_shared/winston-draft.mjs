// supabase/functions/_shared/winston-draft.mjs — the pure core of the `winston-draft` Edge Function (council arc
// winston-direct, 2026-11-02). Email to others goes out as Winston, formatted, DRAFT FIRST: the chat creates a Gmail
// draft in Winston's mailbox (Mark opens the link signed in as Winston) and sends that exact draft only after Mark says
// "send it". Called DIRECTLY by the chat's shell with header x-winston-ticket — a 'draft' ticket for draft.create, a
// one-use 'send' ticket for draft.send (public.press_winston_ticket; ../_shared/winston-ticket.mjs).
// Forwards ONE whitelisted action with the SEND key (MAILER_KEY — never the read key) to MAILER_ENDPOINT; the Apps
// Script enforces Mark CC'd, Reply-To Mark and the recipient caps. Never returns a URL or key value.
import { TICKET_RE, ticketOk } from './winston-ticket.mjs';

export const DRAFT_ACTIONS = Object.freeze(['draft.create', 'draft.send']);
export const SCOPE_OF = Object.freeze({ 'draft.create': 'draft', 'draft.send': 'send' });
const PARAMS = {
  'draft.create': ['to', 'cc', 'subject', 'text', 'html', 'replyToMessageId', 'replyAll'],
  'draft.send': ['draftId'],
};
const list = (v) => [].concat(v ?? []).map(String);

// Only the named params of the named action travel — never a caller's `key` or `action`, never a send body on draft.send.
export function buildPayload(action, params, sendKey) {
  if (!DRAFT_ACTIONS.includes(action)) return null;
  const p = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const out = { key: sendKey, action };
  for (const k of PARAMS[action]) {
    if (p[k] === undefined || p[k] === null) continue;
    out[k] = k === 'to' || k === 'cc' ? list(p[k]) : k === 'replyAll' ? p[k] === true : String(p[k]);
  }
  return out;
}

const deny = (status, error) => ({ status, body: { ok: false, error } });

// req = { ticket, body: { action, params } } · deps = { cfg: { sbUrl, service, mailerUrl, sendKey }, fetchImpl } → { status, body }
export async function draftMail(req, { cfg, fetchImpl }) {
  if (!TICKET_RE.test(String(req.ticket || ''))) return deny(401, 'unauthorized');
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (!DRAFT_ACTIONS.includes(b.action)) return deny(400, 'unknown_action');
  if (!cfg.mailerUrl || !cfg.sendKey) return deny(500, 'mailer_not_configured');
  if (!(await ticketOk(cfg, fetchImpl, String(req.ticket), SCOPE_OF[b.action]))) return deny(401, 'unauthorized');
  let r;
  try {
    r = await fetchImpl(cfg.mailerUrl, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(b.action, b.params, cfg.sendKey)) });
  } catch { return deny(502, 'mailer_unreachable'); }
  let reply;
  try { reply = await r.json(); } catch { return deny(502, 'non_json_reply'); }
  if (!reply || typeof reply !== 'object') return deny(502, 'non_json_reply');
  return { status: reply.ok ? 200 : 502, body: reply };
}
