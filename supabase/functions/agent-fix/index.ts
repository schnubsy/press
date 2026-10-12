// supabase/functions/agent-fix/index.ts — the Agent Monitor's admin-only Retry (press, arc marquee-wings-monitor slice 4).
//
// RULE (Mark, 2026-10-12): Fix only works for Mark. The public page is read-only; this function is the lock:
//   1. the caller's Supabase JWT (the family-gate admin session the page reuses) is verified by GoTrue (/auth/v1/user);
//   2. press_access_is_admin() is called AS THAT USER — only an active admin passes;
//   3. only the row's own allowlisted retry_action runs (cron:<job> → press_agent_fix_run, service_role only);
//   4. rate limit: one retry per agent per 10 minutes;
//   5. every attempt that reaches step 3 is logged as a press_agent_runs row (app marquee, agent agent-fix).
// POST {"agent":"<press_agent_expect.id>"} with Authorization: Bearer <user access token>.
const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
// Public by design (the same publishable key every press page embeds) — used only as the `apikey` for the
// caller's own GoTrue / PostgREST calls; the caller's JWT carries the identity.
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable__iv3bI7xDAsOdHUlXzbVZQ_2yyFS4uX';
const ORIGINS = [/^https:\/\/schnubsy\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const RATE_MIN = 10;

function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  const allow = ORIGINS.some((re) => re.test(o)) ? o : 'https://schnubsy.github.io';
  return {
    'access-control-allow-origin': allow, vary: 'origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  };
}
const svc = (path: string, init: RequestInit = {}) => fetch(`${SB_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json', ...(init.headers || {}) },
});

Deno.serve(async (req) => {
  const h = cors(req);
  const out = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return out(405, { error: 'POST only' });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || token === ANON) return out(401, { error: 'Sign in as the admin first.' });

  // 1 — who is this? (GoTrue verifies the signature + expiry)
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!u.ok) return out(401, { error: 'Your sign-in has expired — sign in again on the Access page.' });

  // 2 — admin? (evaluated by Postgres AS the caller)
  const a = await fetch(`${SB_URL}/rest/v1/rpc/press_access_is_admin`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}',
  });
  if (!a.ok || (await a.json()) !== true) return out(403, { error: 'Only the marquee admin can run fixes.' });

  let agent = '';
  try { agent = String((await req.json()).agent || ''); } catch { /* bad body */ }
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(agent)) return out(400, { error: 'Unknown agent.' });

  // 3 — allowlist: the row must exist, be enabled and carry a cron:<job> retry
  const er = await svc(`press_agent_expect?id=eq.${agent}&select=id,label,enabled,retry_action`);
  const exp = er.ok ? (await er.json())[0] : null;
  if (!exp || !exp.enabled || !/^cron:[a-z0-9_-]+$/.test(exp.retry_action || '')) return out(400, { error: 'No automatic fix for this one — use the links.' });

  // 4 — rate limit
  const since = new Date(Date.now() - RATE_MIN * 60000).toISOString();
  const rl = await svc(`press_agent_runs?app=eq.marquee&agent=eq.agent-fix&run_id=like.fix:${agent}:*&started_at=gte.${since}&select=run_id&limit=1`);
  if (rl.ok && (await rl.json()).length) return out(429, { error: `Already retried in the last ${RATE_MIN} minutes — give it a moment.` });

  const started = new Date().toISOString();
  const r = await svc('rpc/press_agent_fix_run', { method: 'POST', body: JSON.stringify({ p_id: agent }) });
  const ok = r.ok;
  let result = '';
  try { const j = await r.json(); result = ok ? String(j) : String(j.message || j.error || 'failed'); } catch { result = ok ? 'done' : 'failed'; }

  // 5 — log (no caller identity in the note: notes are shown on the public page)
  await svc('press_agent_runs', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      run_id: `fix:${agent}:${started}`, app: 'marquee', agent: 'agent-fix', kind: 'on-demand', model: '-',
      outcome: ok ? 'ok' : 'error', note: `Retry ${exp.label}: ${result}`.slice(0, 200),
      started_at: started, finished_at: new Date().toISOString(),
    }),
  });
  return out(ok ? 200 : 502, { ok, result });
});
