// test/access-invite.test.mjs — the access-invite Edge Function's pure core (family-wing-invites, 2026-11-01).
// A stub fetch records every call. The lock under test: a non-admin NEVER reaches the admin-users call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invite, cleanEmail, cleanName, inviteText, RATE_MIN, SIGN_IN_URL, SUBJECT } from '../supabase/functions/_shared/invite.mjs';

const CFG = { sbUrl: 'https://x.test', service: 'svc-role-fixture', anon: 'anon-fixture', mailerUrl: 'https://mailer.test/exec', mailerKey: 'mailer-key-fixture' };
const NOW = Date.parse('2026-11-01T12:00:00Z');
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// opts: user (status) · admin (bool) · existing (people row|null) · mk ({status,body}) · mail ({status,body}|'throw') · upFail
function world(o = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : undefined;
    calls.push({ url, method: init.method || 'GET', body, headers: init.headers || {} });
    if (url.endsWith('/auth/v1/user')) return res(o.user ?? 200, { email: 'mark@fam.test', user_metadata: { name: 'Mark' } });
    if (url.endsWith('/rpc/press_access_is_admin')) return res(200, o.admin ?? true);
    if (url.includes('/rest/v1/press_access_people?email=eq.') && (init.method || 'GET') === 'GET') return res(200, o.existing ? [o.existing] : []);
    if (url.includes('/rest/v1/press_access_people?on_conflict')) return res(o.upFail ? 500 : 201, []);
    if (url.endsWith('/auth/v1/admin/users')) { const m = o.mk || { status: 200, body: { id: 'u1' } }; return res(m.status, m.body); }
    if (url === CFG.mailerUrl) { if (o.mail === 'throw') throw new Error('boom https://mailer.test/exec?key=SECRET'); const m = o.mail || { status: 200, body: { ok: true } }; return res(m.status, m.body); }
    if ((init.method || '') === 'PATCH') return res(204, null);
    return res(404, {});
  };
  return { calls, run: (token, body) => invite({ token, body }, { cfg: CFG, fetchImpl, now: () => NOW }) };
}
const adminCalls = (calls) => calls.filter((c) => c.url.endsWith('/auth/v1/admin/users'));
const secretFree = (r) => assert.ok(!/svc-role-fixture|mailer-key-fixture|mailer\.test|anon-fixture/.test(JSON.stringify(r.body)), JSON.stringify(r.body));

test('cleanEmail / cleanName', () => {
  assert.equal(cleanEmail('  Barb@Example.COM '), 'barb@example.com');
  for (const bad of [null, '', 'nope', 'a@b', 'a b@c.de', 'a,evil@x.com', 'a;b@x.com', '<a>@x.com', 'a"b@x.com', 'x'.repeat(250) + '@a.bc']) assert.equal(cleanEmail(bad), null, String(bad));
  assert.equal(cleanName('  Barb\n'), 'Barb'); assert.equal(cleanName('   '), null); assert.equal(cleanName(null), null);
});

test('no token / the anon key → 401, nothing else called', async () => {
  for (const t of ['', null, 'Bearer ', 'Bearer anon-fixture']) {
    const w = world(); const r = await w.run(t, { email: 'b@x.co' });
    assert.equal(r.status, 401); assert.equal(w.calls.length, 0);
  }
});

test('expired / invalid JWT → 401, no admin check, no admin-users call', async () => {
  const w = world({ user: 401 }); const r = await w.run('Bearer a.b.c', { email: 'b@x.co' });
  assert.equal(r.status, 401);
  assert.deepEqual(w.calls.map((c) => c.url), ['https://x.test/auth/v1/user']);
});

test('signed-in NON-admin → 403 and NEVER reaches the service role or admin-users', async () => {
  const w = world({ admin: false }); const r = await w.run('Bearer a.b.c', { email: 'b@x.co', name: 'B' });
  assert.equal(r.status, 403);
  assert.equal(adminCalls(w.calls).length, 0);
  assert.ok(w.calls.every((c) => !JSON.stringify(c.headers).includes('svc-role-fixture')), 'service key never used');
  assert.ok(w.calls.every((c) => c.url !== CFG.mailerUrl), 'no mail sent');
});

test('bad address → 400 (after the admin check, before any write)', async () => {
  const w = world(); const r = await w.run('Bearer a.b.c', { email: 'not-an-email' });
  assert.equal(r.status, 400);
  assert.equal(adminCalls(w.calls).length, 0);
});

test('rate limit: invited <10 min ago → 429, no account call, no mail', async () => {
  const w = world({ existing: { invited_at: new Date(NOW - 5 * 60000).toISOString() } });
  const r = await w.run('Bearer a.b.c', { email: 'b@x.co' });
  assert.equal(r.status, 429); assert.match(r.body.error, new RegExp(String(RATE_MIN)));
  assert.equal(adminCalls(w.calls).length, 0); assert.ok(w.calls.every((c) => c.url !== CFG.mailerUrl));
});

test('happy path (new person): row first, then account, then mail, then stamp → created:true emailed:true', async () => {
  const w = world(); const r = await w.run('Bearer a.b.c', { email: 'Barb@Example.com', name: 'Barb' });
  assert.deepEqual(r, { status: 200, body: { ok: true, created: true, emailed: true } });
  const order = w.calls.map((c) => (c.url.includes('on_conflict') ? 'row' : c.url.endsWith('/admin/users') ? 'account' : c.url === CFG.mailerUrl ? 'mail' : c.method === 'PATCH' ? 'stamp' : '-')).filter((x) => x !== '-');
  assert.deepEqual(order, ['row', 'account', 'mail', 'stamp']);
  const row = w.calls.find((c) => c.url.includes('on_conflict')).body;
  assert.deepEqual(row, { email: 'barb@example.com', active: true, name: 'Barb' });
  assert.ok(!('is_admin' in row), 'is_admin is never sent');
  assert.ok(w.calls.every((c) => !/press_access_grants/.test(c.url)), 'no grant rows');
  assert.deepEqual(adminCalls(w.calls)[0].body, { email: 'barb@example.com', email_confirm: true });
  const mail = w.calls.find((c) => c.url === CFG.mailerUrl).body;
  assert.equal(mail.to, 'barb@example.com'); assert.equal(mail.subject, SUBJECT);
  assert.ok(mail.text.includes(SIGN_IN_URL) && mail.text.includes('6-digit code') && mail.text.startsWith('Hi Barb,'));
  assert.ok(!/remit|perth|optimo|app lab/i.test(mail.text), 'wing-level wording — names no single app');
  const stamp = w.calls.find((c) => c.method === 'PATCH').body;
  assert.equal(stamp.invited_at, new Date(NOW).toISOString());
});

test('name omitted → the row carries no name key (existing name kept)', async () => {
  const w = world({ existing: { invited_at: null, name: 'Barb' } }); await w.run('Bearer a.b.c', { email: 'b@x.co' });
  assert.deepEqual(w.calls.find((c) => c.url.includes('on_conflict')).body, { email: 'b@x.co', active: true });
});

test('existing account (422 email_exists) → created:false, still emailed', async () => {
  const w = world({ mk: { status: 422, body: { error_code: 'email_exists', msg: 'A user with this email address has already been registered' } } });
  const r = await w.run('Bearer a.b.c', { email: 'b@x.co' });
  assert.deepEqual(r, { status: 200, body: { ok: true, created: false, emailed: true } });
});

test('other account-creation failure → 502, no mail', async () => {
  const w = world({ mk: { status: 500, body: { msg: 'db down' } } }); const r = await w.run('Bearer a.b.c', { email: 'b@x.co' });
  assert.equal(r.status, 502); assert.ok(w.calls.every((c) => c.url !== CFG.mailerUrl)); secretFree(r);
});

test('mailer failure (not ok / throws) → ok:true emailed:false, account + row stand, NO stamp, no secret leaked', async () => {
  for (const mail of [{ status: 502, body: { ok: false, error: 'x' } }, { status: 200, body: { ok: false } }, 'throw']) {
    const w = world({ mail }); const r = await w.run('Bearer a.b.c', { email: 'b@x.co' });
    assert.deepEqual(r, { status: 200, body: { ok: true, created: true, emailed: false } });
    assert.equal(w.calls.filter((c) => c.method === 'PATCH').length, 0, 'a failed mail does not lock out the retry');
    secretFree(r);
  }
});

test('row upsert failure → 502 before any account is made', async () => {
  const w = world({ upFail: true }); const r = await w.run('Bearer a.b.c', { email: 'b@x.co' });
  assert.equal(r.status, 502); assert.equal(adminCalls(w.calls).length, 0);
});

test('an existing ADMIN row is never rewritten by an invite (no upsert), the rest still runs', async () => {
  const w = world({ existing: { is_admin: true, invited_at: null, name: 'Mark' } });
  const r = await w.run('Bearer a.b.c', { email: 'mark@fam.test', name: 'Hacked' });
  assert.equal(r.status, 200);
  assert.ok(w.calls.every((c) => !c.url.includes('on_conflict')), 'no upsert on an admin row');
});

test('rate-limit lookup failure fails CLOSED (502), nothing created or sent', async () => {
  const calls = []; const f = async (url, init = {}) => { calls.push(url);
    if (url.endsWith('/auth/v1/user')) return res(200, {}); if (url.endsWith('/rpc/press_access_is_admin')) return res(200, true);
    if (url.includes('select=invited_at')) return res(500, {}); return res(200, {}); };
  const r = await invite({ token: 'Bearer a.b.c', body: { email: 'b@x.co' } }, { cfg: CFG, fetchImpl: f, now: () => NOW });
  assert.equal(r.status, 502); assert.ok(calls.every((u) => !u.endsWith('/admin/users') && u !== CFG.mailerUrl));
});

test('a network throw anywhere → clean 502, never an uncaught error', async () => {
  const r = await invite({ token: 'Bearer a.b.c', body: { email: 'b@x.co' } }, { cfg: CFG, fetchImpl: async () => { throw new Error('net'); }, now: () => NOW });
  assert.equal(r.status, 502);
});

test('inviteText: plain, friendly, no app names, no secrets', () => {
  const t = inviteText({ inviter: 'Mark', name: '' });
  assert.ok(t.startsWith('Hi,') && t.includes('Mark has invited you') && t.includes(SIGN_IN_URL));
});
