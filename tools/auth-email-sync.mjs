// tools/auth-email-sync.mjs — push the Family Wing sign-in email (owned by press) to Supabase Auth.
//
// RULE (Mark, 2026-10-12): the sign-in email is WING-level ("Your Family Wing sign-in code"), owned by
// press in docs/auth/, and synced AUTOMATICALLY — never hand-edited in the dashboard, never per app.
// Every family-wing app (remit, perth, optimo, …) shares the ONE press Supabase project, and
// signInWithOtp / POST /auth/v1/otp email codes are rendered from the MAGIC LINK template — so these two
// Management API fields are the whole email:
//   mailer_subjects_magic_link            ← docs/auth/family-wing-otp.json .subject
//   mailer_templates_magic_link_content   ← docs/auth/<.file>   (must carry {{ .Token }})
//
//   SUPABASE_ACCESS_TOKEN=… node tools/auth-email-sync.mjs        # PATCH, then GET back + assert equal
//   node tools/auth-email-sync.mjs --dry-run                       # build + validate the payload only
//
// Run by .github/workflows/auth-email-sync.yml on push to main touching docs/auth/**. The read-back
// equality check is the ship proof: exit 0 only when Supabase serves exactly what the repo holds.
// The token is a Supabase PERSONAL ACCESS TOKEN (Actions secret SUPABASE_ACCESS_TOKEN) — never logged.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

export const PROJECT_REF = 'eepjhpyziczrxvirczio';
export const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Family-wing app names that must NEVER appear in the wing-level email (it serves every app).
export const APP_NAMES = /\b(remit|perth|runway|optimo)\b/i;

export function buildPayload(root = ROOT) {
  const meta = JSON.parse(readFileSync(join(root, 'docs', 'auth', 'family-wing-otp.json'), 'utf8'));
  const html = readFileSync(join(root, 'docs', 'auth', meta.file), 'utf8');
  const problems = [];
  if (!meta.subject || typeof meta.subject !== 'string') problems.push('subject missing');
  if (!html.includes('{{ .Token }}')) problems.push('template has no {{ .Token }} — the code would not be sent');
  if (APP_NAMES.test(meta.subject) || APP_NAMES.test(html)) problems.push('names a family-wing app — the email is wing-level');
  if (problems.length) throw new Error('auth-email-sync: ' + problems.join('; '));
  return { mailer_subjects_magic_link: meta.subject, mailer_templates_magic_link_content: html };
}

async function main() {
  const payload = buildPayload();
  if (process.argv.includes('--dry-run')) {
    console.log(`auth-email-sync: dry run OK — subject "${payload.mailer_subjects_magic_link}", template ${payload.mailer_templates_magic_link_content.length} bytes`);
    return 0;
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('::error::Add SUPABASE_ACCESS_TOKEN — a Supabase personal access token (supabase.com/dashboard/account/tokens) as a GitHub Actions repository secret in schnubsy/press (Settings → Secrets and variables → Actions). Until then the Family Wing sign-in email cannot be synced.');
    return 1;
  }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const p = await fetch(API, { method: 'PATCH', headers, body: JSON.stringify(payload) });
  if (!p.ok) { console.error(`::error::PATCH ${API} → HTTP ${p.status}: ${(await p.text()).slice(0, 300)}`); return 1; }
  const g = await fetch(API, { headers });
  if (!g.ok) { console.error(`::error::GET ${API} → HTTP ${g.status}`); return 1; }
  const live = await g.json();
  const bad = Object.keys(payload).filter(k => live[k] !== payload[k]);
  if (bad.length) { console.error(`::error::read-back mismatch after PATCH: ${bad.join(', ')}`); return 1; }
  console.log(`auth-email-sync: SHIP PROOF — Supabase Auth serves the repo's Family Wing email (subject "${live.mailer_subjects_magic_link}", template ${live.mailer_templates_magic_link_content.length} bytes)`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(code => process.exit(code), e => { console.error('::error::' + (e && e.message || e)); process.exit(1); });
}
