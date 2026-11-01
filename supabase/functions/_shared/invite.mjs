// supabase/functions/_shared/invite.mjs — the pure half of the `access-invite` Edge Function (ESM; Deno + Node 20+).
// No env, no globals: index.ts injects `cfg` + `fetchImpl`; the Node tests inject a stub fetch.
//
// WHY (family-wing-invites, 2026-11-01): the wing's code request sends create_user:false, so an address with a
// press_access_people row but NO auth.users row gets GoTrue 422 "Signups not allowed for otp" and can never receive a
// code. This function is the ONLY server path that creates a family sign-in account, and only for an active admin.
//
// Order is the lock: (1) caller's JWT verified by GoTrue → (2) press_access_is_admin() AS THAT USER → only then (3+)
// any service-role call. A non-admin NEVER reaches the admin-users call (tests prove it).
export const RATE_MIN = 10;
export const SIGN_IN_URL = 'https://schnubsy.github.io/press/index.html?view=family';
export const SUBJECT = "You're invited to the Family Wing";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function cleanEmail(v) {
  const e = String(v == null ? '' : v).trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
export function cleanName(v) {
  const n = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80);
  return n || null;
}
export function inviteText({ inviter, name, link = SIGN_IN_URL }) {
  const hi = name ? `Hi ${name},` : 'Hi,';
  const by = inviter ? `${inviter} has` : 'You have been';
  return [
    hi, '',
    inviter ? `${by} invited you to the Family Wing.` : `${by} invited to the Family Wing.`, '',
    'To sign in, open this link:', link, '',
    "Then type this email address and we'll send you a 6-digit code. There is no password to remember.", '',
    'If you were not expecting this, you can ignore this message.',
  ].join('\n');
}
// A short, secret-free reason for a failed mailer call.
function mailerReason(e) { return String((e && e.message) || e || 'err').replace(/https?:\/\/\S+/g, '[url]').slice(0, 80); }

// invite({token, body}, {cfg, fetchImpl, now}) → { status, body }
//   cfg: { sbUrl, service, anon, mailerUrl, mailerKey }
export async function invite({ token, body }, { cfg, fetchImpl, now = () => Date.now() }) {
  const f = fetchImpl;
  const tok = String(token || '').replace(/^Bearer\s+/i, '').trim();
  if (!tok || tok === cfg.anon) return { status: 401, body: { error: 'Sign in as the admin first.' } };

  // 1 — who is this? (GoTrue verifies signature + expiry)
  const u = await f(`${cfg.sbUrl}/auth/v1/user`, { headers: { apikey: cfg.anon, Authorization: `Bearer ${tok}` } });
  if (!u.ok) return { status: 401, body: { error: 'Your sign-in has expired — sign in again.' } };
  let caller = {}; try { caller = await u.json(); } catch { /* none */ }

  // 2 — an active admin? (evaluated by Postgres AS the caller)
  const a = await f(`${cfg.sbUrl}/rest/v1/rpc/press_access_is_admin`, {
    method: 'POST', headers: { apikey: cfg.anon, Authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: '{}' });
  let isAdmin = false; try { isAdmin = a.ok && (await a.json()) === true; } catch { /* no */ }
  if (!isAdmin) return { status: 403, body: { error: 'Only the marquee admin can invite people.' } };

  // 3 — the body
  const email = cleanEmail(body && body.email);
  if (!email) return { status: 400, body: { error: 'Enter a valid email address.' } };
  const name = cleanName(body && body.name);

  const svc = (path, init = {}) => f(`${cfg.sbUrl}${path}`, { ...init,
    headers: { apikey: cfg.service, Authorization: `Bearer ${cfg.service}`, 'content-type': 'application/json', ...(init.headers || {}) } });

  // 4 — rate limit: no second invite EMAIL to the same address inside RATE_MIN minutes
  const er = await svc(`/rest/v1/press_access_people?email=eq.${encodeURIComponent(email)}&select=invited_at,name`);
  const existing = er.ok ? ((await er.json().catch(() => [])) || [])[0] : null;
  if (existing && existing.invited_at && now() - new Date(existing.invited_at).getTime() < RATE_MIN * 60000) {
    return { status: 429, body: { error: `Already invited in the last ${RATE_MIN} minutes — give it a moment.` } };
  }

  // 5 — the allow-list row FIRST (the Before-User-Created hook requires it). active=true; name only if given;
  //     is_admin is NEVER sent (a merge-upsert leaves it alone); no grant rows (opt-out default = every tool ON).
  const row = { email, active: true }; if (name) row.name = name;
  const up = await svc('/rest/v1/press_access_people?on_conflict=email', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  if (!up.ok) return { status: 502, body: { error: 'Could not save that person — try again.' } };

  // 6 — the sign-in account (the thing that was missing). "Already exists" is fine.
  const mk = await svc('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, email_confirm: true }) });
  let created = mk.ok;
  if (!mk.ok) {
    let j = {}; try { j = await mk.json(); } catch { /* none */ }
    const exists = mk.status === 422 && (j.error_code === 'email_exists' || /already (been )?registered|already exists/i.test(String(j.msg || j.message || '')));
    if (!exists) return { status: 502, body: { error: 'Could not create their sign-in account — try again.' } };
    created = false;
  }

  // 7 — the email, from Winston (`to` = the invitee ⇒ Mark is CC'd and Reply-To is Mark, enforced by the mailer)
  const inviter = (caller && caller.user_metadata && caller.user_metadata.name) || '';
  let emailed = false;
  try {
    if (cfg.mailerUrl && cfg.mailerKey) {
      const r = await f(cfg.mailerUrl, { method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: cfg.mailerKey, to: email, subject: SUBJECT, text: inviteText({ inviter, name: name || (existing && existing.name) || '' }) }) });
      let j = null; try { j = await r.json(); } catch { j = null; }
      emailed = !!(r.ok && j && j.ok);
    }
  } catch (e) { emailed = false; void mailerReason(e); }

  // 8 — stamp invited_at only when an email actually went (a failed mail must not lock out the retry)
  if (emailed) await svc(`/rest/v1/press_access_people?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ invited_at: new Date(now()).toISOString() }) });

  return { status: 200, body: { ok: true, created, emailed } };
}
