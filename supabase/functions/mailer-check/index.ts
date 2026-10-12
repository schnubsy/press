// supabase/functions/mailer-check — diagnostic for the Winston mailer (2026-10-12). Gated by the same Vault-held
// header as access-notify (x-access-notify-secret, checked via press_access_notify_secret_ok). POSTs ONE test mail to
// Mark through MAILER_ENDPOINT/MAILER_KEY and through COUNCIL_MAILER_URL/COUNCIL_MAILER_KEY, and returns each
// mailer's own JSON reply ({ok} or {error}) plus HTTP status / content-type — never a URL or key value.
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });

async function secretOk(c: string) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/press_access_notify_secret_ok`, {
    method: 'POST', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ candidate: c }) });
  return r.ok && (await r.json()) === true;
}
async function probe(urlName: string, keyName: string, subject: string) {
  const url = Deno.env.get(urlName) || '', key = Deno.env.get(keyName) || '';
  if (!url || !key) return { set: { url: !!url, key: !!key } };
  try {
    const r = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, subject, text: 'Test from the press mailer check. No action needed.' }) });
    const ct = r.headers.get('content-type') || '';
    const t = await r.text();
    let reply: unknown = null; try { reply = JSON.parse(t); } catch { reply = ct.includes('html') ? 'html page (likely a Google sign-in / permission page)' : t.slice(0, 80); }
    return { status: r.status, contentType: ct.split(';')[0], reply, urlLooksLikeExec: /\/exec$/.test(url), keyLen: key.length };
  } catch (e) { return { error: String((e as Error).message).slice(0, 120) }; }
}
Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!(await secretOk(req.headers.get('x-access-notify-secret') || ''))) return json(401, { error: 'unauthorized' });
  return json(200, {
    mailer: await probe('MAILER_ENDPOINT', 'MAILER_KEY', 'TEST 1/2 — alerts mailer (Winston)'),
    council: await probe('COUNCIL_MAILER_URL', 'COUNCIL_MAILER_KEY', 'TEST 2/2 — council mailer (Winston)'),
  });
});
