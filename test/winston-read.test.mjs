// test/winston-read.test.mjs — the winston-read Edge Function's pure core (council arc winston-read, 2026-11-02).
// A stub fetch records every call. Locks: no header secret → nothing reaches the mailer; only whitelisted actions and
// params travel; the READ key (never a caller-supplied one) is sent; no URL or key value ever comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readMail, buildPayload, READ_ACTIONS } from '../supabase/functions/_shared/winston-read.mjs';

const CFG = { sbUrl: 'https://x.test', service: 'svc-role-fixture', mailerUrl: 'https://mailer.test/exec', readKey: 'read-key-fixture' };
const res = (status, body, bad) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (bad) throw new Error('not json'); return body; } });

function world(o = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.endsWith('/rpc/press_winston_read_secret_ok')) return res(200, o.secretOk ?? true);
    if (url === CFG.mailerUrl) {
      if (o.mail === 'throw') throw new Error('boom https://mailer.test/exec?key=read-key-fixture');
      if (o.mail === 'html') return res(200, null, true);
      return res(200, o.reply ?? { ok: true, threads: [] });
    }
    return res(404, {});
  };
  return { calls, run: (secret, body, cfg = CFG) => readMail({ secret, body }, { cfg, fetchImpl }) };
}
const mailerCalls = (calls) => calls.filter((c) => c.url === CFG.mailerUrl);
const secretFree = (r) => assert.ok(!/svc-role-fixture|read-key-fixture|mailer\.test/.test(JSON.stringify(r.body)), JSON.stringify(r.body));

test('no or wrong header secret → 401, the mailer is never called', async () => {
  for (const [s, ok] of [['', true], ['wrong', false]]) {
    const w = world({ secretOk: ok }); const r = await w.run(s, { action: 'read.search', params: { q: 'x' } });
    assert.equal(r.status, 401); assert.equal(mailerCalls(w.calls).length, 0); secretFree(r);
  }
  const w = world(); await w.run('', { action: 'read.search' });
  assert.equal(w.calls.length, 0, 'an empty secret never even asks the database');
});

test('unknown action (incl. a send body) → 400, nothing forwarded', async () => {
  for (const body of [{ action: 'read.trash' }, { action: 'send' }, { subject: 's', text: 't', to: ['a@b.co'] }, null, 'x']) {
    const w = world(); const r = await w.run('ok', body);
    assert.equal(r.status, 400); assert.equal(r.body.error, 'unknown_action'); assert.equal(mailerCalls(w.calls).length, 0);
  }
});

test('each action forwards ONLY its params, with the read key, following the redirect', async () => {
  const w = world();
  await w.run('ok', { action: 'read.search', params: { q: 'label:porchia', max: '5', key: 'evil', to: ['x@y.co'], subject: 's' } });
  await w.run('ok', { action: 'read.thread', params: { threadId: 't0', q: 'drop' } });
  await w.run('ok', { action: 'read.attachment', params: { messageId: 'm1', name: 'reply.pdf', threadId: 'no' } });
  const m = mailerCalls(w.calls);
  assert.deepEqual(m.map((c) => c.body), [
    { key: 'read-key-fixture', action: 'read.search', q: 'label:porchia', max: 5 },
    { key: 'read-key-fixture', action: 'read.thread', threadId: 't0' },
    { key: 'read-key-fixture', action: 'read.attachment', messageId: 'm1', name: 'reply.pdf' },
  ]);
  for (const c of m) { assert.equal(c.init.method, 'POST'); assert.equal(c.init.redirect, 'follow'); }
  assert.deepEqual(READ_ACTIONS, ['read.search', 'read.thread', 'read.attachment']);
  assert.equal(buildPayload('send', {}, 'k'), null);
  assert.deepEqual(buildPayload('read.search', [1, 2], 'k'), { key: 'k', action: 'read.search' });
});

test('the script reply is returned as-is: ok → 200, not ok → 502', async () => {
  let w = world({ reply: { ok: true, threads: [{ threadId: 't0' }] } });
  let r = await w.run('ok', { action: 'read.search', params: { q: 'x' } });
  assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true, threads: [{ threadId: 't0' }] });
  w = world({ reply: { ok: false, error: 'attachment_too_large: over 10 MB — open it in Gmail instead' } });
  r = await w.run('ok', { action: 'read.attachment', params: { messageId: 'm1', name: 'a' } });
  assert.equal(r.status, 502); assert.match(r.body.error, /attachment_too_large/);
});

test('unreachable / non-JSON mailer / missing config → plain errors, no URL or key leaks', async () => {
  let r = await world({ mail: 'throw' }).run('ok', { action: 'read.search', params: { q: 'x' } });
  assert.deepEqual(r, { status: 502, body: { ok: false, error: 'mailer_unreachable' } }); secretFree(r);
  r = await world({ mail: 'html' }).run('ok', { action: 'read.search', params: { q: 'x' } });
  assert.deepEqual(r, { status: 502, body: { ok: false, error: 'non_json_reply' } });
  for (const cfg of [{ ...CFG, readKey: '' }, { ...CFG, mailerUrl: '' }]) {
    const w = world(); r = await w.run('ok', { action: 'read.search', params: { q: 'x' } }, cfg);
    assert.deepEqual(r, { status: 500, body: { ok: false, error: 'reader_not_configured' } }); assert.equal(mailerCalls(w.calls).length, 0);
  }
});

test('the send function and its secrets are untouched; the reader never names the send key', () => {
  const idx = readFileSync(new URL('../supabase/functions/winston-read/index.ts', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../supabase/functions/_shared/winston-read.mjs', import.meta.url), 'utf8');
  assert.match(idx, /COUNCIL_MAILBOX_READ_KEY/); assert.match(idx, /x-winston-read-secret/);
  for (const s of [idx, core]) assert.doesNotMatch(s, /MAILER_KEY'|COUNCIL_MAILER_KEY|winston_mail_secret/);
});

test('migration: grants in the same file, service_role only, result deletes the response row', () => {
  const sql = readFileSync(new URL('../db/20261102_press_winston_read.sql', import.meta.url), 'utf8');
  for (const f of ['press_winston_read(text, jsonb)', 'press_winston_read_result(bigint)', 'press_winston_read_secret_ok(text)']) {
    assert.ok(sql.includes(`revoke execute on function public.${f} from public, anon, authenticated;`), f);
    assert.ok(sql.includes(`grant  execute on function public.${f} to service_role;`), f);
  }
  assert.match(sql, /grant select, insert, update, delete on public\.press_winston_read_requests to service_role;/);
  assert.doesNotMatch(sql, /to (anon|authenticated)\b/);
  assert.match(sql, /delete from net\._http_response h where h\.id = press_winston_read_result\.request_id/);
});
