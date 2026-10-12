// supabase/functions/steward-reports/index.ts — read the Steward's reports for steward.html (private wing).
// browser→server, on-demand shape (council instruments/agent/functions/_template, 'on-demand'): CORS allow-list +
// x-plan-id gate, RESPONSE ONLY (writes nothing). Auth + shaping live in ./core.mjs (unit-tested in press
// test/steward-reports.test.mjs). Deployed with verify_jwt=false — the custom x-plan-id gate below IS the auth.
// ENV: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-provided). No other secret. DB: rpc press_steward_capability_ok.
import { authorize, reportsPath, shape } from './core.mjs';

const ALLOWED_ORIGINS = ['https://schnubsy.github.io'];
const isDev = (o: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: 'Origin' };
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isDev(origin))) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'content-type, x-plan-id, apikey, authorization';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(body: unknown, status: number, extra: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const c = cors(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, c);

  const SB_URL = Deno.env.get('SUPABASE_URL') || '';
  const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!SB_URL || !SB_SERVICE) return json({ error: 'server not configured' }, 503, c);
  const db = (path: string, init?: RequestInit) => fetch(SB_URL + '/rest/v1/' + path, {
    ...(init || {}),
    headers: { apikey: SB_SERVICE, Authorization: 'Bearer ' + SB_SERVICE, 'content-type': 'application/json' },
  });

  const auth = await authorize(req.headers.get('x-plan-id'), db);
  if (!auth.ok) return json({ error: auth.status === 401 ? 'unauthorized' : 'unavailable' }, auth.status, c);

  try {
    const r = await db(reportsPath(Date.now()));
    if (!r.ok) return json({ error: 'unavailable' }, 503, c);
    return json(shape(await r.json()), 200, c);
  } catch (_) {
    return json({ error: 'unavailable' }, 503, c);   // a bad body / network error still answers WITH CORS headers
  }
});
