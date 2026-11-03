// supabase/functions/winston-read — Claude READS Winston's mailbox (council arc winston-read, 2026-11-02). The send
// path (`winston-mail`) is untouched: a separate function, header secret and Apps Script key keep a read bug or a leaked
// read key away from sending. Two callers, no CORS (no browser caller), verify_jwt OFF:
//   • public.press_winston_read (pg_net) with x-winston-read-secret — the SQL fallback;
//   • the chat's shell DIRECTLY with x-winston-ticket (arc winston-direct) — one call = one answer; read.attachment
//     returns the raw file bytes for `curl -o`.
// The logic lives in ../_shared/winston-read.mjs (unit-tested with a stub fetch).
// Secrets: COUNCIL_MAILBOX_READ_KEY (function secret) + MAILER_ENDPOINT (existing).
import { readMail } from '../_shared/winston-read.mjs';

const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

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
  const r = await readMail({
    secret: req.headers.get('x-winston-read-secret') || '',
    ticket: req.headers.get('x-winston-ticket') || '',
    body: body as any,
  }, { cfg, fetchImpl: fetch });
  if ((r as any).file) return new Response((r as any).file.bytes, { status: 200, headers: (r as any).file.headers });
  return json(r.status, (r as any).body);
});
