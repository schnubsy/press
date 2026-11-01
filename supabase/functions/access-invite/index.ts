// supabase/functions/access-invite/index.ts — the Access Manager's one-tap Invite (press, arc family-wing-invites).
//
// RULE (Mark, 2026-11-01): Invite = ONE tap — create their sign-in account, every family tool stays ON (opt-out default,
// no grant rows), email them the wing sign-in link from Winston (Mark CC'd). No extra passwords; sign-in stays
// "type your email, get a 6-digit code". The logic lives in ../_shared/invite.mjs (unit-tested with a stub fetch);
// this file is only env + CORS (same shape as agent-fix). verify_jwt is OFF: the function verifies the caller itself.
// POST {"email":"…","name":"…"} with Authorization: Bearer <admin's user access token>.
import { invite } from '../_shared/invite.mjs';

const ORIGINS = [/^https:\/\/schnubsy\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  const allow = ORIGINS.some((re) => re.test(o)) ? o : 'https://schnubsy.github.io';
  return {
    'access-control-allow-origin': allow, vary: 'origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  };
}

Deno.serve(async (req) => {
  const h = cors(req);
  const out = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  let body: unknown = {};
  try { body = await req.json(); } catch { /* bad body → 400 from the core */ }
  const cfg = {
    sbUrl: Deno.env.get('SUPABASE_URL') || '',
    service: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    // Public by design (the publishable key every press page embeds) — only the `apikey` for the caller's own calls.
    anon: Deno.env.get('SUPABASE_ANON_KEY') || 'sb_publishable__iv3bI7xDAsOdHUlXzbVZQ_2yyFS4uX',
    mailerUrl: Deno.env.get('MAILER_ENDPOINT') || '',
    mailerKey: Deno.env.get('MAILER_KEY') || '',
  };
  const r = await invite({ token: req.headers.get('authorization') || '', body: body as any }, { cfg, fetchImpl: fetch });
  return out(r.status, r.body);
});
