// supabase/functions/access-notify — Family Wing "Request access" alert (arc/marquee-wings-monitor slice 2).
//
// Called ONLY by the AFTER INSERT/UPDATE trigger on public.press_access_requests (pg_net), with the header
// x-access-notify-secret read from Vault `access_notify_secret`. Deployed with verify_jwt=false; the header
// is the auth, checked against Vault via the service_role-only RPC press_access_notify_secret_ok() — so the
// secret has ONE home (Vault) and no function-secret copy can drift.
//
// The payload is NOT trusted for content: the function re-reads the request row (must be pending), the
// person's name and the app's label with the service role, then sends Mark a Pushover push + a Gmail
// (Apps Script mailer) email — the notify standard (council instruments/agent/functions/_shared/notify.mjs,
// vendored verbatim at ../_shared/notify.mjs).
//   push:  title "Family Wing access request", body "<name or email> wants <app label>", url → access.html
//   email: same subject/body.
// A body of {"test": true} sends ONE message titled "TEST — Family Wing request flow" (the slice's single
// live end-to-end check). Response: { ok, push, email } per-channel outcomes — never a credential.
//
// Secrets (function env): PUSHOVER_APP_TOKEN, PUSHOVER_USER_KEY, MAILER_ENDPOINT, MAILER_KEY (shared with
// card-scout), SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (platform-provided).
import { makePushImpl, makeEmailImpl } from '../_shared/notify.mjs';

const ACCESS_URL = 'https://schnubsy.github.io/press/access.html';
const PAGES_URL = 'https://schnubsy.github.io/press/pages.json';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function env(name: string): string { return Deno.env.get(name) || ''; }

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return await fetch(env('SUPABASE_URL') + '/rest/v1/' + path, {
    ...init,
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

async function secretOk(candidate: string): Promise<boolean> {
  if (!candidate) return false;
  const r = await rest('rpc/press_access_notify_secret_ok', { method: 'POST', body: JSON.stringify({ candidate }) });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

async function rows(path: string): Promise<any[]> {
  const r = await rest(path);
  if (!r.ok) return [];
  try { return await r.json(); } catch { return []; }
}

// The marquee's own title for a page (pages.json), else the access app label, else the filename stem.
async function appLabel(page: string): Promise<string> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(PAGES_URL, { signal: ctl.signal }); clearTimeout(t);
    if (r.ok) { const p = await r.json(); if (p && p[page] && p[page].title) return String(p[page].title); }
  } catch { /* fall through */ }
  const a = (await rows('press_access_apps?select=label&page=eq.' + encodeURIComponent(page)))[0];
  return (a && a.label) || page.replace(/\.html$/, '');
}

export function buildMessage(name: string | null, email: string, label: string) {
  const who = (name && name.trim()) || email;
  return { title: 'Family Wing access request', body: `${who} wants ${label}`, url: ACCESS_URL, url_title: 'Open the Access Manager', priority: 0 };
}

async function send(msg: { title: string; body: string; url: string; url_title?: string; priority: number }) {
  const out = { push: 'off', email: 'off' } as Record<string, string>;
  const appToken = env('PUSHOVER_APP_TOKEN'), userKey = env('PUSHOVER_USER_KEY');
  if (appToken && userKey) {
    try { await makePushImpl()({ appToken, userKey }, msg); out.push = 'ok'; }
    catch (e) { out.push = 'failed'; console.error('access-notify: push failed', String((e as Error)?.message || e).slice(0, 160)); }
  }
  const endpoint = env('MAILER_ENDPOINT');
  if (endpoint) {
    try { await makeEmailImpl()(endpoint, env('MAILER_KEY'), { subject: msg.title, text: `${msg.body}\n\n${msg.url}` }); out.email = 'ok'; }
    catch (e) { out.email = 'failed'; console.error('access-notify: email failed', String((e as Error)?.message || e).slice(0, 160)); }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!(await secretOk(req.headers.get('x-access-notify-secret') || ''))) return json(401, { error: 'unauthorized' });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  if (body && body.test === true) {
    const out = await send({ title: 'TEST — Family Wing request flow', body: 'If you can read this, access-request alerts are working.', url: ACCESS_URL, url_title: 'Open the Access Manager', priority: 0 });
    return json(200, { ok: out.push === 'ok' || out.email === 'ok', test: true, ...out });
  }

  const email = String(body?.email || ''), page = String(body?.page || '');
  if (!email || !page) return json(400, { error: 'bad_request' });

  // re-read the row: only a PENDING request alerts (a replayed/stale call is a no-op)
  const req0 = (await rows(`press_access_requests?select=email,page,handled_at&email=eq.${encodeURIComponent(email)}&page=eq.${encodeURIComponent(page)}`))[0];
  if (!req0 || req0.handled_at) return json(200, { ok: true, skipped: 'not_pending' });

  const person = (await rows('press_access_people?select=name&email=eq.' + encodeURIComponent(email)))[0];
  const msg = buildMessage(person?.name || null, email, await appLabel(page));
  const out = await send(msg);
  return json(200, { ok: out.push === 'ok' || out.email === 'ok', ...out });
});
