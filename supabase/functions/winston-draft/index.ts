// supabase/functions/winston-draft — formatted Gmail DRAFTS as Winston, sent only by id (council arc winston-direct,
// 2026-11-02). Called directly by the chat's shell with x-winston-ticket ('draft' → draft.create; one-use 'send' →
// draft.send). No CORS (no browser caller); verify_jwt OFF — the ticket is the gate. Logic: ../_shared/winston-draft.mjs.
// Secrets: MAILER_ENDPOINT + MAILER_KEY (existing — the send key; never the read key).
import { draftMail } from '../_shared/winston-draft.mjs';

const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  let body: unknown = {};
  try { body = await req.json(); } catch { /* bad body → 400 from the core */ }
  const cfg = {
    sbUrl: Deno.env.get('SUPABASE_URL') || '',
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    mailerUrl: Deno.env.get('MAILER_ENDPOINT') || '',
    sendKey: Deno.env.get('MAILER_KEY') || '',
  };
  const r = await draftMail({ ticket: req.headers.get('x-winston-ticket') || '', body: body as any }, { cfg, fetchImpl: fetch });
  return json(r.status, r.body);
});
