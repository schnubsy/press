// The Family Wing sign-in email (docs/auth/) — owned by press, wing-level, synced by
// .github/workflows/auth-email-sync.yml via tools/auth-email-sync.mjs (arc/marquee-wings-monitor slice 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildPayload, APP_NAMES, API } from '../tools/auth-email-sync.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const meta = JSON.parse(readFileSync(join(ROOT, 'docs', 'auth', 'family-wing-otp.json'), 'utf8'));
const html = readFileSync(join(ROOT, 'docs', 'auth', meta.file), 'utf8');

test('subject is the wing-level "Your Family Wing sign-in code"', () => {
  assert.equal(meta.subject, 'Your Family Wing sign-in code');
});

test('template carries the OTP {{ .Token }} and no magic link', () => {
  assert.ok(html.includes('{{ .Token }}'), 'the code must be in the email');
  assert.ok(!html.includes('ConfirmationURL'), 'code-only: the gate verifies a typed code, not a link');
});

test('template + subject name NO family-wing app (remit / perth / runway / optimo)', () => {
  for (const s of [meta.subject, html]) {
    assert.doesNotMatch(s, /remit|perth|runway|optimo/i);
  }
  assert.match(html, /Family Wing/, 'wing-level wording');
});

test('buildPayload maps to the Management API magic-link fields, project eepjhpyziczrxvirczio', () => {
  const p = buildPayload(ROOT);
  assert.deepEqual(Object.keys(p).sort(), ['mailer_subjects_magic_link', 'mailer_templates_magic_link_content']);
  assert.equal(p.mailer_subjects_magic_link, meta.subject);
  assert.equal(p.mailer_templates_magic_link_content, html);
  assert.equal(API, 'https://api.supabase.com/v1/projects/eepjhpyziczrxvirczio/config/auth');
});

test('buildPayload refuses a template without the token, or one naming an app', () => {
  const mk = (subject, body) => {
    const d = mkdtempSync(join(tmpdir(), 'authmail-'));
    mkdirSync(join(d, 'docs', 'auth'), { recursive: true });
    writeFileSync(join(d, 'docs', 'auth', 'family-wing-otp.json'), JSON.stringify({ subject, file: 't.html' }));
    writeFileSync(join(d, 'docs', 'auth', 't.html'), body);
    return d;
  };
  assert.throws(() => buildPayload(mk('Your Family Wing sign-in code', '<p>no code here</p>')), /Token/);
  assert.throws(() => buildPayload(mk('Your remit sign-in code', '<p>{{ .Token }}</p>')), /wing-level/);
  assert.ok(APP_NAMES.test('Optimo'));
});

test('the workflow runs the sync on docs/auth changes and fails clearly without the secret', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'auth-email-sync.yml'), 'utf8');
  assert.match(wf, /docs\/auth\/\*\*/);
  assert.match(wf, /workflow_dispatch/);
  assert.match(wf, /secrets\.SUPABASE_ACCESS_TOKEN/);
  assert.match(wf, /node tools\/auth-email-sync\.mjs/);
  const tool = readFileSync(join(ROOT, 'tools', 'auth-email-sync.mjs'), 'utf8');
  assert.match(tool, /Add SUPABASE_ACCESS_TOKEN/);
  assert.match(tool, /read-back mismatch/, 'GET-back equality is the ship proof');
});
