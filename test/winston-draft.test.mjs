// test/winston-draft.test.mjs — the winston-draft Edge Function's pure core (council arc winston-direct, 2026-11-02).
// Locks: ticket scope per action ('draft' creates, a one-use 'send' sends — never crossed, never a read ticket); only
// whitelisted params travel with the SEND key; draft.send forwards ONLY the draft id; no URL or key value comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftMail, buildPayload, DRAFT_ACTIONS, SCOPE_OF } from '../supabase/functions/_shared/winston-draft.mjs';

const CFG = { sbUrl: 'https://x.test', service: 'svc-role-fixture', mailerUrl: 'https://mailer.test/exec', sendKey: 'send-key-fixture' };
const T = (c) => c.repeat(64);
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function world(o = {}) {
  const tickets = new Map(Object.entries(o.tickets ?? { [T('d')]: { scope: 'draft', uses: 3 }, [T('e')]: { scope: 'send', uses: 1 }, [T('a')]: { scope: 'read', uses: 5 } }));
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined; calls.push({ url, init, body });
    if (url.endsWith('/rpc/press_winston_ticket_redeem')) {
      const k = tickets.get(body.candidate); if (!k || k.scope !== body.want_scope || k.uses < 1) return res(200, false);
      k.uses -= 1; return res(200, true);
    }
    if (url === CFG.mailerUrl) {
      if (o.mail === 'throw') throw new Error('boom https://mailer.test/exec?key=send-key-fixture');
      return res(200, o.reply ?? (body.action === 'draft.create' ? { ok: true, draftId: 'r-1', link: 'https://mail.google.com/…' } : { ok: true, messageId: 'm9' }));
    }
    return res(404, {});
  };
  return { calls, run: (ticket, body, cfg = CFG) => draftMail({ ticket, body }, { cfg, fetchImpl }), mailer: () => calls.filter((c) => c.url === CFG.mailerUrl) };
}
const CREATE = { action: 'draft.create', params: { to: ['allan@example.test'], subject: 'R061', text: 'Hi', html: '<p>Hi</p>' } };
const SEND = { action: 'draft.send', params: { draftId: 'r-1' } };

test('scopes never cross: a read ticket drafts nothing, a draft ticket never sends, a send ticket never drafts', async () => {
  const w = world();
  assert.equal((await w.run(T('a'), CREATE)).status, 401);
  assert.equal((await w.run(T('a'), SEND)).status, 401);
  assert.equal((await w.run(T('d'), SEND)).status, 401);
  assert.equal((await w.run(T('e'), CREATE)).status, 401);
  assert.equal(w.mailer().length, 0);
  assert.deepEqual({ ...SCOPE_OF }, { 'draft.create': 'draft', 'draft.send': 'send' });
});

test('absent / malformed ticket → 401 before any fetch; unknown action → 400 without spending a use', async () => {
  const w = world();
  for (const t of ['', 'x', T('Z')]) assert.equal((await w.run(t, CREATE)).status, 401);
  assert.equal(w.calls.length, 0);
  for (const body of [{ action: 'read.search' }, { action: 'send' }, { subject: 's', text: 't', to: ['a@b.co'] }, null])
    assert.equal((await w.run(T('e'), body)).status, 400);
  assert.equal((await w.run(T('e'), SEND)).status, 200, 'the one-use send ticket was not spent by the refusals');
  assert.equal((await w.run(T('e'), SEND)).status, 401, 'and is spent now');
});

test('only whitelisted params travel, with the SEND key; draft.send forwards only the id', async () => {
  const w = world();
  await w.run(T('d'), { action: 'draft.create', params: { ...CREATE.params, cc: 'bea@example.test', replyToMessageId: 'm1', replyAll: 'yes', key: 'evil', action: 'draft.send', draftId: 'r-9' } });
  await w.run(T('e'), { action: 'draft.send', params: { draftId: 'r-1', to: ['evil@example.test'], text: 'x', html: '<p>x</p>', key: 'evil' } });
  assert.deepEqual(w.mailer().map((c) => c.body), [
    { key: 'send-key-fixture', action: 'draft.create', to: ['allan@example.test'], cc: ['bea@example.test'], subject: 'R061', text: 'Hi', html: '<p>Hi</p>', replyToMessageId: 'm1', replyAll: false },
    { key: 'send-key-fixture', action: 'draft.send', draftId: 'r-1' },
  ]);
  for (const c of w.mailer()) { assert.equal(c.init.method, 'POST'); assert.equal(c.init.redirect, 'follow'); }
  assert.equal(buildPayload('read.search', {}, 'k'), null);
  assert.deepEqual([...DRAFT_ACTIONS], ['draft.create', 'draft.send']);
});

test('replies pass through (ok → 200, refusal → 502); errors leak no URL or key; missing config → 500', async () => {
  let r = await world().run(T('d'), CREATE);
  assert.equal(r.status, 200); assert.equal(r.body.draftId, 'r-1');
  r = await world({ reply: { ok: false, error: 'too_many_recipients' } }).run(T('d'), CREATE);
  assert.deepEqual(r, { status: 502, body: { ok: false, error: 'too_many_recipients' } });
  r = await world({ mail: 'throw' }).run(T('d'), CREATE);
  assert.deepEqual(r, { status: 502, body: { ok: false, error: 'mailer_unreachable' } });
  const w = world(); r = await w.run(T('d'), CREATE, { ...CFG, sendKey: '' });
  assert.deepEqual(r, { status: 500, body: { ok: false, error: 'mailer_not_configured' } }); assert.equal(w.calls.length, 0);
});

test('the draft function uses the send key, never the read key; the read function never names the send key', () => {
  const idx = readFileSync(new URL('../supabase/functions/winston-draft/index.ts', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../supabase/functions/_shared/winston-draft.mjs', import.meta.url), 'utf8');
  assert.match(idx, /Deno\.env\.get\('MAILER_KEY'\)/); assert.match(idx, /x-winston-ticket/);
  for (const s of [idx, core]) assert.doesNotMatch(s, /COUNCIL_MAILBOX_READ_KEY|winston_read_secret|readKey/);
  const readIdx = readFileSync(new URL('../supabase/functions/winston-read/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(readIdx, /MAILER_KEY'|draft\./);
});
