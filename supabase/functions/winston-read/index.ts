// supabase/functions/winston-read — Claude READS Winston's mailbox (council arc winston-read, 2026-11-02). The send
// path (`winston-mail`) is untouched: a separate function, header secret and Apps Script key keep a read bug or a leaked
// read key away from sending. Called only by public.press_winston_read (pg_net) with x-winston-read-secret; no CORS (no
// browser caller). The logic lives in ../_shared/winston-read.mjs (unit-tested with a stub fetch). verify_jwt is OFF:
// the header secret is the gate. Secrets: COUNCIL_MAILBOX_READ_KEY (function secret) + MAILER_ENDPOINT (existing).
import { readMail } from '../_shared/winston-read.mjs';

const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  let body: unknown = {};
  try { body = await req.json(); } catch { /* bad body → 400 from the core */ }
  const cfg = {
    sbUrl: Deno.env.get('SUPABASE_URL') || '',
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    mailerUrl: Deno.env.get('MAILER_ENDPOINT') || '',
    readKey: Deno.env.get('COUNCIL_MAILBOX_READ_KEY') || '',
  };
  const r = await readMail({ secret: req.headers.get('x-winston-read-secret') || '', body: body as any }, { cfg, fetchImpl: fetch });
  return json(r.status, r.body);
});
