// test/winston-direct.test.mjs — the chat calls winston-read DIRECTLY with a short-lived ticket (council arc
// winston-direct, 2026-11-02). A stub fetch plays both the database (press_winston_ticket_redeem — an in-memory model
// of the SQL: one use spent per call, expiry, exact scope) and the Apps Script. The SQL itself is exercised on a real
// PostgreSQL in the slice evidence; here the wiring is locked: absent / wrong / malformed / expired / reused / wrong-scope
// ticket → 401 and nothing reaches the mailbox; JSON paths unchanged; read.attachment = the exact file bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readMail } from '../supabase/functions/_shared/winston-read.mjs';
import { contentDisposition, safeContentType, TICKET_RE } from '../supabase/functions/_shared/winston-ticket.mjs';

const CFG = { sbUrl: 'https://x.test', service: 'svc-role-fixture', mailerUrl: 'https://mailer.test/exec', readKey: 'read-key-fixture' };
const FIXTURE = readFileSync(new URL('./fixtures/winston-attachment.bin', import.meta.url));
const FIXTURE_SHA = '08433d10506d3c3095da39ab484251b03acc45ebc134b6ef63c0a3da47d84b82';
const T = (c) => c.repeat(64);
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function world(o = {}) {
  const now = { t: 1000 };
  const tickets = new Map(Object.entries(o.tickets ?? { [T('a')]: { scope: 'read', uses: 1, exp: 2000 } }));
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined; calls.push({ url, body });
    if (url.endsWith('/rpc/press_winston_ticket_redeem')) {
      const k = tickets.get(body.candidate);
      if (!k || k.scope !== body.want_scope || k.uses < 1 || k.exp <= now.t) return res(200, false);
      k.uses -= 1; return res(200, true);
    }
    if (url.endsWith('/rpc/press_winston_read_secret_ok')) return res(200, body.candidate === 'sql-secret');
    if (url === CFG.mailerUrl) {
      if (body.action === 'read.attachment') return res(200, o.attachment ?? { ok: true, name: 'Reply — MSA “R061”.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: FIXTURE.length, base64: FIXTURE.toString('base64') });
      return res(200, o.reply ?? { ok: true, threads: [{ threadId: 't0' }] });
    }
    return res(404, {});
  };
  const run = (ticket, body, extra = {}) => readMail({ ticket, body, ...extra }, { cfg: CFG, fetchImpl });
  return { calls, now, tickets, run, mailer: () => calls.filter((c) => c.url === CFG.mailerUrl) };
}
const SEARCH = { action: 'read.search', params: { q: 'label:porchia', max: 5 } };

test('absent, malformed or unknown ticket → 401; a malformed one never reaches the database; the mailbox is never called', async () => {
  const w = world();
  for (const t of ['nope', T('A'), T('a') + 'x', 'z'.repeat(64)]) {
    const r = await w.run(t, SEARCH); assert.equal(r.status, 401, t); assert.deepEqual(r.body, { ok: false, error: 'unauthorized' });
  }
  assert.equal(w.calls.length, 0, 'malformed tickets are refused before any fetch');
  const u = await w.run(T('b'), SEARCH); assert.equal(u.status, 401);
  assert.equal(w.mailer().length, 0);
  // no ticket at all and no secret → the SQL path's 401
  assert.equal((await w.run('', SEARCH)).status, 401);
});

test('a ticket is spent: reuse refused after its uses; expiry refused; the wrong scope refused', async () => {
  const w = world({ tickets: { [T('a')]: { scope: 'read', uses: 2, exp: 2000 }, [T('c')]: { scope: 'draft', uses: 5, exp: 2000 }, [T('d')]: { scope: 'read', uses: 5, exp: 2000 } } });
  assert.equal((await w.run(T('a'), SEARCH)).status, 200);
  assert.equal((await w.run(T('a'), SEARCH)).status, 200);
  assert.equal((await w.run(T('a'), SEARCH)).status, 401, 'third use of a 2-use ticket');
  assert.equal((await w.run(T('c'), SEARCH)).status, 401, 'a draft ticket never reads');
  w.now.t = 2000; assert.equal((await w.run(T('d'), SEARCH)).status, 401, 'expired');
  assert.equal(w.mailer().length, 2);
  const redeem = w.calls.filter((c) => c.url.endsWith('/rpc/press_winston_ticket_redeem'));
  assert.ok(redeem.every((c) => c.body.want_scope === 'read'), 'winston-read only ever asks for the read scope');
});

test('an unknown action is refused without spending a use', async () => {
  const w = world();
  assert.equal((await w.run(T('a'), { action: 'draft.send', params: { draftId: 'r1' } })).status, 400);
  assert.equal(w.tickets.get(T('a')).uses, 1);
  assert.equal((await w.run(T('a'), SEARCH)).status, 200);
});

test('JSON paths unchanged: search/thread return the script JSON; the SQL secret path still works alongside', async () => {
  const w = world({ tickets: { [T('a')]: { scope: 'read', uses: 3, exp: 2000 } } });
  let r = await w.run(T('a'), SEARCH);
  assert.deepEqual(r, { status: 200, body: { ok: true, threads: [{ threadId: 't0' }] } });
  r = await w.run(T('a'), { action: 'read.thread', params: { threadId: 't0' } });
  assert.equal(r.status, 200); assert.equal(r.file, undefined);
  assert.deepEqual(w.mailer().map((c) => c.body), [
    { key: 'read-key-fixture', action: 'read.search', q: 'label:porchia', max: 5 },
    { key: 'read-key-fixture', action: 'read.thread', threadId: 't0' },
  ]);
  // the SQL path keeps the JSON (base64) attachment shape
  r = await w.run('', { action: 'read.attachment', params: { messageId: 'm1', name: 'a' } }, { secret: 'sql-secret' });
  assert.equal(r.status, 200); assert.equal(r.body.base64, FIXTURE.toString('base64')); assert.equal(r.file, undefined);
});

test('read.attachment over a ticket = the raw bytes, byte-identical to the fixture (sha256), with safe headers', async () => {
  const w = world();
  const r = await w.run(T('a'), { action: 'read.attachment', params: { messageId: 'm1', name: 'Reply — MSA “R061”.docx' } });
  assert.equal(r.status, 200); assert.ok(r.file);
  const got = Buffer.from(r.file.bytes);
  assert.equal(createHash('sha256').update(got).digest('hex'), FIXTURE_SHA);
  assert.ok(got.equals(FIXTURE));
  const h = r.file.headers;
  assert.equal(h['x-winston-sha256'], FIXTURE_SHA);
  assert.equal(h['content-length'], String(FIXTURE.length));
  assert.equal(h['content-type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(h['content-disposition'], `attachment; filename="Reply _ MSA _R061_.docx"; filename*=UTF-8''Reply%20%E2%80%94%20MSA%20%E2%80%9CR061%E2%80%9D.docx`);
  assert.equal(h['cache-control'], 'no-store'); assert.equal(h['x-content-type-options'], 'nosniff');
  assert.ok(!/svc-role-fixture|read-key-fixture|mailer\.test/.test(JSON.stringify(h)));
});

test('attachment errors stay JSON (never a half file): script refusal, size mismatch, bad encoding', async () => {
  let r = await world({ attachment: { ok: false, error: 'attachment_too_large: over 10 MB — open it in Gmail instead' } })
    .run(T('a'), { action: 'read.attachment', params: { messageId: 'm1', name: 'x' } });
  assert.equal(r.status, 502); assert.match(r.body.error, /attachment_too_large/); assert.equal(r.file, undefined);
  r = await world({ attachment: { ok: true, name: 'x', contentType: 'text/plain', size: 99, base64: 'aGk=' } })
    .run(T('a'), { action: 'read.attachment', params: { messageId: 'm1', name: 'x' } });
  assert.deepEqual(r, { status: 502, body: { ok: false, error: 'attachment_size_mismatch' } });
  r = await world({ attachment: { ok: true, name: 'x', contentType: 'text/plain', size: 2, base64: '%%%' } })
    .run(T('a'), { action: 'read.attachment', params: { messageId: 'm1', name: 'x' } });
  assert.deepEqual(r, { status: 502, body: { ok: false, error: 'bad_attachment_encoding' } });
});

test('header helpers: no CRLF / quote injection; odd content types fall back to octet-stream', () => {
  const d = contentDisposition('evil"\r\nSet-Cookie: a=b.pdf');
  assert.doesNotMatch(d, /[\r\n]/); assert.equal((d.match(/"/g) || []).length, 2);
  assert.equal(safeContentType('text/html; charset=utf-8'), 'application/octet-stream');
  assert.equal(safeContentType('APPLICATION/PDF'), 'application/pdf');
  assert.equal(safeContentType(undefined), 'application/octet-stream');
  assert.ok(TICKET_RE.test(T('0')) && !TICKET_RE.test(T('g')));
});

test('index.ts wires the ticket header and returns the file body; migration: hash-only, scoped, service_role only', () => {
  const idx = readFileSync(new URL('../supabase/functions/winston-read/index.ts', import.meta.url), 'utf8');
  assert.match(idx, /ticket: req\.headers\.get\('x-winston-ticket'\)/);
  assert.match(idx, /new Response\(\(r as any\)\.file\.bytes/);
  const sql = readFileSync(new URL('../db/20261102_press_winston_ticket.sql', import.meta.url), 'utf8');
  for (const f of ['press_winston_ticket(text, int, int)', 'press_winston_ticket_redeem(text, text)']) {
    assert.ok(sql.includes(`revoke execute on function public.${f} from public, anon, authenticated;`), f);
    assert.ok(sql.includes(`grant  execute on function public.${f} to service_role;`), f);
  }
  assert.match(sql, /grant select, insert, update, delete on public\.press_winston_tickets to service_role;/);
  assert.doesNotMatch(sql, /to (anon|authenticated)\b/);
  assert.match(sql, /encode\(extensions\.digest\(v, 'sha256'\), 'hex'\)/, 'only the hash is stored');
  assert.match(sql, /a send ticket has exactly one use/);
});
