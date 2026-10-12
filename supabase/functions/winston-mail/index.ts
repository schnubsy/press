// supabase/functions/winston-mail — the ONE server-side path for "Claude sends an email" (2026-10-12; Mark's RULE:
// every email Claude sends comes from Winston). Called only by the SQL function public.press_winston_mail (pg_net), with
// header x-winston-mail-secret (value held only in Vault `winston_mail_secret`, checked via the service-role-only
// press_winston_mail_secret_ok). Forwards { subject, text, to?, cc? } to the Winston mailer (MAILER_ENDPOINT/MAILER_KEY):
// no `to` → Mark only; with `to` → those recipients, Mark always CC'd, Reply-To Mark (enforced by the mailer itself).
// Returns the mailer's own {ok}/{error} — never a URL or key value.
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function secretOk(c: string) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/press_winston_mail_secret_ok`, {
    method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ candidate: c }) });
  return r.ok && (await r.json()) === true;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await secretOk(req.headers.get('x-winston-mail-secret') || ''))) return json(401, { error: 'unauthorized' });
  let b: any = {};
  try { b = await req.json(); } catch { return json(400, { error: 'bad_request' }); }
  const url = Deno.env.get('MAILER_ENDPOINT') || '', key = Deno.env.get('MAILER_KEY') || '';
  if (!url || !key) return json(500, { error: 'mailer_not_configured' });
  const payload: Record<string, unknown> = { key, subject: String(b.subject || '').slice(0, 200), text: String(b.text || '').slice(0, 20000) };
  if (b.to) payload.to = b.to;
  if (b.cc) payload.cc = b.cc;
  try {
    const r = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    let reply: any = null; try { reply = await r.json(); } catch { reply = { ok: false, error: 'non_json_reply' }; }
    return json(reply && reply.ok ? 200 : 502, reply);
  } catch (e) { return json(502, { ok: false, error: 'mailer_unreachable' }); }
});
