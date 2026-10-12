// instruments/agent/functions/_shared/notify.mjs
// council-agent shared core — the NOTIFY tail. Pushover (push) + Gmail (Apps Script mailer) sender,
// gated by the console Alerts settings. GENERALISED from card-scout (the first consumer): the page
// key, the row→message formatter, and the status/column names are all injected via `cfg`, so any
// cadence/inlet agent can reach its human without re-implementing the transport or the gating.
// (ESM; Deno + Node 20+.) PURE of Deno/secrets: the push/email transports AND all config are
// injected, so gating (toggles, quiet hours, daily digest, no-double-alert) is fully unit-testable.
//
// Alerting rules:
//   * HITS alert instantly on the enabled channels — UNLESS quiet hours hold them; a held hit stays
//     status='judged' and alerts on the next non-quiet tick (never lost).
//   * NEAR misses are batched into ONE daily digest at digest_time.
//   * Never alert the same item twice: hits are pulled by status='judged' then set 'alerted';
//     nears are marked extras.digested_at once included.
//
// The push channel is Pushover (NOT ntfy): ntfy's free tier rate-limits per egress IP and a scheduled
// Edge Function sends from SHARED cloud egress, so other tenants exhaust the daily quota and every push
// comes back 429. Pushover meters per application/account, so the limit no longer depends on who else
// shares the egress IP — see docs/lessons.md + INSTRUMENT.md §B.1.

// ── agent config (defaults) ──────────────────────────────────────────────────
// Every consumer passes an `agent` cfg; these are the press-schema defaults. Column/status names are
// configurable so an agent with a different table shape can reuse the exact same gating + transport.
export const DEFAULT_AGENT = Object.freeze({
  page: 'agent',                 // the press page key (was card-scout's PAGE constant)
  dealsTable: 'press_deals',     // the table hits/nears live in
  stateTable: 'press_state',     // the toggle/settings table (item_id + checked)
  healthTable: 'press_tasks',    // where writePushHealth upserts the push-health row
  statusColumn: 'status',        // the workflow-status column (judged → alerted)
  verdictColumn: 'verdict',      // the classifier column (hit | near | …)
  hitValue: 'hit',
  nearValue: 'near',
  judgedValue: 'judged',
  alertedValue: 'alerted',
  format: null,                  // row → { title, body, url, priority } ; default = formatPush
  formatDigest: null,            // rows → { subject, text } ; default = formatDigest
  groupKey: null,                // optional row → group key (one alert per group); default = per-row
  formatGroup: null,             // optional group[] → { title, body, url, priority }
});
function agentCfg(a) { return Object.assign({}, DEFAULT_AGENT, a || {}); }

// ── settings + toggles ───────────────────────────────────────────────────────
export function toggleMap(stateRows) {
  const m = {};
  for (const r of stateRows || []) m[r.item_id] = r.checked === true;
  return {
    iphone: m['alert-iphone'] === true,
    gmail: m['alert-gmail'] === true,
    digest: m['digest-daily'] === true,
    quiet: m['quiet-hours'] === true,
  };
}
function toMin(hhmm, dflt) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return dflt;
  return (Number(m[1]) % 24) * 60 + Number(m[2]);
}
function nowMin(now) { return (Number(now?.hour) || 0) * 60 + (Number(now?.minute) || 0); }

// Quiet window can wrap midnight (default 22:00 → 07:00).
export function inQuietHours(now, settings) {
  const s = toMin(settings?.quiet_start, 22 * 60);
  const e = toMin(settings?.quiet_end, 7 * 60);
  const n = nowMin(now);
  return s < e ? (n >= s && n < e) : (n >= s || n < e);
}
// True on exactly the one 30-min tick that starts the digest window (default 07:30).
export function isDigestTime(now, settings) {
  const d = toMin(settings?.digest_time, 7 * 60 + 30);
  const n = nowMin(now);
  return n >= d && n < d + 30;
}

// ── default formatting (deal-shaped; agents pass their own via cfg.format) ────
// The reference formatter. An agent with a different row shape passes `agent.format(row)` /
// `agent.formatDigest(rows)`; these built-ins are the default so a simple agent needs no formatter.
function pctOf(row) {
  const p = row.pct_off ?? row.extras?.effective_pct;
  return p == null ? null : Math.round(Number(p));
}
export function formatPush(row) {
  const pct = pctOf(row);
  const brand = row.brand || row.title || 'Alert';
  const parts = [];
  if (row.price != null && row.face_value != null) parts.push(`$${row.price} for $${row.face_value}`);
  else if (row.price != null) parts.push(`$${row.price}`);
  if (row.source) parts.push(String(row.source).replace(/^src-/, ''));
  if (row.expiry) parts.push(`exp ${row.expiry}`);
  return {
    title: pct != null ? `${brand} ${pct}% off` : `${brand}`,
    body: parts.join(' · ') || (row.body || 'New alert'),
    url: row.url || '',
    // Hit pushes go out at Pushover priority 1 (high) — surfaces with sound/vibration ahead of a
    // normal (0) message. The near-miss digest goes out quiet (-1).
    priority: 1,
  };
}
export function formatDigest(nears) {
  const lines = nears.map((r) => {
    const pct = pctOf(r);
    const tail = r.extras && r.extras.unpriced ? ' — worth a look' : (pct != null ? ` ${pct}%` : '');
    return `• ${r.brand || r.title || 'Item'}${tail}${r.source ? ` (${String(r.source).replace(/^src-/, '')})` : ''}`;
  });
  return {
    subject: `${nears.length} near-miss${nears.length === 1 ? '' : 'es'} today`,
    text: `Near misses (below your threshold but close):\n\n${lines.join('\n')}\n\nTune thresholds on the console.`,
  };
}

// ── transports (default; injectable for tests) ───────────────────────────────
// Pushover message priority is an INTEGER: -2 (silent) … -1 (quiet) … 0 (normal) … 1 (high) … 2
// (emergency). Convention: 1 for hits + the test push, -1 for the near-miss digest.
const PUSHOVER_URL = 'https://api.pushover.net/1/messages.json';
// Pushover field caps (chars): title ≤250, message ≤1024, url ≤512.
const PUSHOVER_TITLE_MAX = 250;
const PUSHOVER_MSG_MAX = 1024;
const PUSHOVER_URL_MAX = 512;

// The fixed "Send test push" message. Same priority (1) a real hit uses, so the test exercises the
// exact surfacing path. Carries NO deal/user text and NEVER a credential.
export const TEST_PUSH = Object.freeze({
  title: 'council-agent test push ✓',
  body: 'If you can read this, push is working.',
  priority: 1,
});

// Build the form-encoded Pushover request body. The credentials (token, user) AND all user/feed text
// ride the POST body — never a header or the URL — so a curly quote/em-dash/emoji is safe (a
// non-Latin-1 HTTP header would throw a ByteString error). Fields are truncated to Pushover's caps;
// an empty message falls back to a generic line (Pushover requires one).
function pushoverBody(creds, msg) {
  const p = new URLSearchParams();
  p.set('token', String((creds && creds.appToken) || ''));
  p.set('user', String((creds && creds.userKey) || ''));
  p.set('title', String(msg.title || '').slice(0, PUSHOVER_TITLE_MAX));
  p.set('message', String(msg.body || '').slice(0, PUSHOVER_MSG_MAX) || 'New alert');
  const url = msg.url ? String(msg.url).slice(0, PUSHOVER_URL_MAX) : '';
  if (url) { p.set('url', url); p.set('url_title', msg.url_title || 'Open'); }
  p.set('priority', String(Number.isFinite(msg.priority) ? msg.priority : 0));
  return p;
}
// Low-level publish: POST the form-encoded request to the Pushover messages API, AWAIT the response,
// and report it. Returns { status, request_id, ok, errors } where `status` is the HTTP status, `ok` is
// true ONLY on HTTP 200 AND body.status===1, and `errors` is at most 120 chars of Pushover's OWN
// errors[] text — it can NEVER contain the token or user key (we send those, we never receive them).
// Throws ONLY on a network/transport error; callers decide what a non-success response means.
export async function pushoverPublish(fetchImpl, creds, msg) {
  const res = await fetchImpl(PUSHOVER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: pushoverBody(creds, msg).toString(),
  });
  const status = Number(res && res.status) || 0;
  let text = '';
  try { text = await res.text(); } catch { /* body already consumed / unreadable */ }
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON (e.g. an HTML error page) */ }
  const apiOk = json && Number(json.status) === 1;
  const requestId = (json && json.request) || null;
  const errs = json && Array.isArray(json.errors) ? json.errors.join('; ') : '';
  return { status, request_id: requestId, ok: status === 200 && apiOk, errors: String(errs || '').slice(0, 120) };
}
// Default Gmail transport (Apps Script mailer), factored out so it is unit-testable with an injected
// fetch. Apps Script answers a successful POST with a 302 redirect while the mail actually sends; with
// redirect:'follow' fetch chases it to a 200. A response that is still a 3xx (redirect not followed) is
// ALSO a success — the mail was accepted. Only a real 4xx/5xx (or a thrown transport error) is a
// failure. No `r.ok` shortcut: fetch's `ok` is false for a surviving 3xx, which we must accept.
export function makeEmailImpl(fetchImpl = fetch) {
  return async (endpoint, key, mail) => {
    const r = await fetchImpl(endpoint, {
      method: 'POST', redirect: 'follow', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, subject: mail.subject, text: mail.text }),
    });
    const status = Number(r && r.status);
    if (Number.isFinite(status) && status >= 400) throw new Error('mailer HTTP ' + status);
    return r;
  };
}
// Default push transport: publish + CHECK the outcome. The original bug was that pushImpl never
// awaited/checked the response, so a 4xx/429 silently counted as sent and the phone went quiet with no
// error logged; the deeper cause of the silence was the old channel's per-IP daily quota on shared
// cloud egress, so the channel is now Pushover. Anything other than HTTP 200 + body.status===1 THROWS
// 'pushover HTTP <status>: <≤120 chars of Pushover's errors[]>' — never a credential — so the caller
// records the failure. On success returns { status, request_id }.
export function makePushImpl(fetchImpl = fetch) {
  return async (creds, msg) => {
    const r = await pushoverPublish(fetchImpl, creds, msg);
    if (!r.ok) throw new Error('pushover HTTP ' + r.status + (r.errors ? ': ' + r.errors : ''));
    return { status: r.status, request_id: r.request_id };
  };
}
function defaultDeps() {
  return {
    pushImpl: makePushImpl(),
    emailImpl: makeEmailImpl(),
  };
}

// A short, secret-free reason string for a logged channel failure.
function shortErr(e) { return String((e && e.message) || e || 'err').slice(0, 160); }

async function readRows(db, path) {
  const r = await db(path);
  if (!r || !r.ok) return [];
  try { return await r.json(); } catch { return []; }
}
// Mark a hit alerted AND stamp the per-channel outcome onto the row: extras.alert =
// { push:'ok'|'failed'|'off', email:'ok'|'failed'|'off', at }. A hit whose push FAILED but email
// succeeded is still 'alerted' (never double-emailed); the failure is preserved on the row. `prev` is
// the row's existing extras so this never clobbers other extras keys.
async function markAlerted(db, cfg, item_id, alert, prev) {
  const extras = { ...(prev || {}), alert };
  await db(`${cfg.dealsTable}?page=eq.${cfg.page}&item_id=eq.` + encodeURIComponent(item_id), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ [cfg.statusColumn]: cfg.alertedValue, extras, updated_at: new Date().toISOString() }),
  });
}
// Push-health row: healthTable category='health', item_id='push-health'. Read-merge-write so a
// real-hit push outcome and the test-push stamp coexist in one extras blob. CARRIES THE sync_id
// COLUMN — never a header-only write, never NULL. Best-effort: a failure is swallowed so a health
// write can never sink a tick or a test call.
export const PUSH_HEALTH_ID = 'push-health';
export async function writePushHealth(db, syncId, patch, agent) {
  if (!syncId) return; // no capability to satisfy the sync_id CHECK — skip (never write NULL)
  const cfg = agentCfg(agent);
  let existing = {};
  try {
    const rows = await readRows(db, `${cfg.healthTable}?page=eq.${cfg.page}&item_id=eq.${PUSH_HEALTH_ID}&select=extras`);
    existing = (rows[0] && rows[0].extras) || {};
  } catch { /* first write — no row yet */ }
  const extras = { ...existing, ...patch };
  const row = {
    page: cfg.page, item_id: PUSH_HEALTH_ID, title: 'Push health', status: 'on',
    category: 'health', position: 999, extras, sync_id: syncId, updated_at: new Date().toISOString(),
  };
  try {
    await db(`${cfg.healthTable}?on_conflict=page,item_id`, {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (e) { console.error('council-agent: push-health write failed', shortErr(e)); }
}

// "Send test push" (console button). Auth: the page's x-plan-id sync_id, verified server-side (service
// role) against an existing row carrying that sync_id — NO shared secret on the page, NO public
// endpoint. Sends ONLY the fixed TEST_PUSH at the real-hit priority, rate-limited 1/60s via
// push-health.last_test_at, and returns { ok, status, request_id } — NEVER a credential. `ok` is the
// REAL outcome: a Pushover-level failure (HTTP 200 but status:0, e.g. a bad token) is ok:false so the
// button can never report "sent" on a push that did not go out. `push` is { appToken, userKey } from
// function secrets. Returns { http, body } for the Deno wrapper.
export async function handleTestPush({ db, syncId, push, deps = null, nowMs = null, agent = null }) {
  const cfg = agentCfg(agent);
  const now = nowMs == null ? Date.now() : Number(nowMs);
  if (!syncId) return { http: 401, body: { error: 'unauthorized' } };
  const authed = await readRows(db,
    `${cfg.stateTable}?page=eq.${cfg.page}&sync_id=eq.${encodeURIComponent(syncId)}&select=item_id&limit=1`);
  if (!authed.length) return { http: 401, body: { error: 'unauthorized' } };

  const health = (await readRows(db, `${cfg.healthTable}?page=eq.${cfg.page}&item_id=eq.${PUSH_HEALTH_ID}&select=extras`))[0];
  const lastTest = Date.parse((health && health.extras && health.extras.last_test_at) || '');
  if (Number.isFinite(lastTest) && now - lastTest < 60000) {
    return { http: 429, body: { error: 'rate_limited', retry_after_s: Math.ceil((60000 - (now - lastTest)) / 1000) } };
  }
  // Push is "configured" only when BOTH Pushover secrets are present.
  if (!push || !push.appToken || !push.userKey) return { http: 500, body: { error: 'server_not_configured' } };

  const d = deps || defaultDeps();
  const atIso = new Date(now).toISOString();
  let ok = false, status = 0, requestId = null, err = null;
  try {
    const r = await d.pushImpl(push, TEST_PUSH);
    ok = true; status = (r && r.status) || 200; requestId = (r && r.request_id) || null;
  } catch (e) {
    const m = shortErr(e); const mm = /pushover HTTP (\d+)/.exec(m); status = mm ? Number(mm[1]) : 0; err = m;
  }
  await writePushHealth(db, syncId, err
    ? { last_test_at: atIso, last_status: status, last_error: err }
    : { last_test_at: atIso, last_status: status, last_ok_at: atIso, last_error: null }, cfg);
  return { http: 200, body: { ok, status, request_id: requestId } };
}

async function markDigested(db, cfg, row) {
  const extras = { ...(row.extras || {}), digested_at: new Date().toISOString() };
  await db(`${cfg.dealsTable}?page=eq.${cfg.page}&item_id=eq.` + encodeURIComponent(row.item_id), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ extras, updated_at: new Date().toISOString() }),
  });
}

// Group hit rows for a single alert. If the agent supplies `cfg.groupKey(row)`, rows sharing a key
// become one alert (preserving first-seen order both of groups and of rows within a group); otherwise
// each row is its own group.
function groupHits(rows, cfg) {
  if (typeof cfg.groupKey !== 'function') return (rows || []).map((r) => [r]);
  const groups = new Map();
  for (const r of rows || []) {
    const key = cfg.groupKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()];
}
function formatOneHit(group, cfg) {
  const fmt = typeof cfg.format === 'function' ? cfg.format : formatPush;
  if (group.length > 1 && typeof cfg.formatGroup === 'function') return cfg.formatGroup(group);
  return fmt(group[0]);
}

// Main entry: alert un-alerted hits (unless held by quiet hours) + send the daily near digest.
// Queries the DB for un-alerted rows (so quiet-held hits from earlier ticks are picked up later),
// not just the rows judged this tick. Returns the number of items alerted/digested.
//   cfg  = { pushToken, pushUser, mailerEndpoint, mailerKey, syncId } from function secrets, PLUS the
//          agent shape { page, format, formatDigest, groupKey, formatGroup, …column names } (defaults
//          to the press schema + deal-shaped formatter when omitted).
//   deps = { pushImpl, emailImpl } (default: real fetch); injected for tests.
export async function notifyHits({ db, settings = {}, now, cfg = {}, deps, nowMs }) {
  const a = agentCfg(cfg);
  const digestFmt = typeof a.formatDigest === 'function' ? a.formatDigest : formatDigest;
  const d = deps || defaultDeps();
  const toggles = toggleMap(await readRows(db, `${a.stateTable}?page=eq.${a.page}&select=item_id,checked`));
  const quiet = toggles.quiet && inQuietHours(now, settings);
  let alerted = 0;

  // HITS — instant, unless quiet-held. Reads verdict=hit/status=judged straight from the DB (not only
  // THIS tick's rows), scoped to the last 24h, so a hit judged on an earlier tick — including one whose
  // notify failed — is retried and alerted exactly once (marked 'alerted' only AFTER a channel
  // succeeds). One alert per group when the agent supplies a groupKey.
  if (!quiet && (toggles.iphone || toggles.gmail)) {
    const nowRef = nowMs == null ? Date.now() : Number(nowMs);
    const since = new Date(nowRef - 24 * 3600 * 1000).toISOString();
    const hits = await readRows(db,
      `${a.dealsTable}?page=eq.${a.page}&${a.verdictColumn}=eq.${a.hitValue}&${a.statusColumn}=eq.${a.judgedValue}&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=25&select=item_id,brand,title,source,price,face_value,pct_off,expiry,url,body,extras`);
    let pushAttempted = false, lastPushStatus = null, lastPushError = null;
    for (const group of groupHits(hits, a)) {
      const push = formatOneHit(group, a);
      let pushOutcome = 'off', emailOutcome = 'off';
      // Per-channel isolation: one channel throwing must NOT block the other, and a total notify
      // failure must not sink the tick. A row is only marked alerted when a channel actually accepted.
      if (toggles.iphone && cfg.pushToken && cfg.pushUser) {
        pushAttempted = true;
        try { const r = await d.pushImpl({ appToken: cfg.pushToken, userKey: cfg.pushUser }, push); pushOutcome = 'ok'; lastPushStatus = (r && r.status) || 200; lastPushError = null; }
        catch (e) { pushOutcome = 'failed'; const m = shortErr(e); const mm = /pushover HTTP (\d+)/.exec(m); lastPushStatus = mm ? Number(mm[1]) : 0; lastPushError = m; console.error('council-agent: pushover push failed', m); }
      }
      if (toggles.gmail && cfg.mailerEndpoint) {
        try {
          await d.emailImpl(cfg.mailerEndpoint, cfg.mailerKey,
            { subject: push.title, text: `${push.body}\n\n${push.url || ''}`.trim() });
          emailOutcome = 'ok';
        } catch (e) { emailOutcome = 'failed'; console.error('council-agent: gmail send failed', shortErr(e)); }
      }
      const sent = pushOutcome === 'ok' || emailOutcome === 'ok';
      if (sent) {
        const alert = { push: pushOutcome, email: emailOutcome, at: new Date(nowRef).toISOString() };
        for (const row of group) { await markAlerted(db, a, row.item_id, alert, row.extras); alerted++; }
      }
    }
    // Record the push health once (best-effort; carries the sync_id column).
    if (pushAttempted && cfg.syncId) {
      const atIso = new Date(nowRef).toISOString();
      await writePushHealth(db, cfg.syncId, lastPushError
        ? { last_status: lastPushStatus, last_error: lastPushError }
        : { last_status: lastPushStatus, last_ok_at: atIso, last_error: null }, a);
    }
  }

  // NEAR digest — once daily at digest_time. Same per-channel isolation.
  if (toggles.digest && isDigestTime(now, settings)) {
    const rows = await readRows(db,
      `${a.dealsTable}?page=eq.${a.page}&${a.verdictColumn}=eq.${a.nearValue}&${a.statusColumn}=eq.${a.judgedValue}&limit=100&select=item_id,brand,title,source,pct_off,extras`);
    const nears = rows.filter((r) => !(r.extras && r.extras.digested_at));
    if (nears.length) {
      const digest = digestFmt(nears);
      let sent = false;
      if (toggles.gmail && cfg.mailerEndpoint) {
        try { await d.emailImpl(cfg.mailerEndpoint, cfg.mailerKey, digest); sent = true; }
        catch (e) { console.error('council-agent: gmail digest failed', shortErr(e)); }
      } else if (toggles.iphone && cfg.pushToken && cfg.pushUser) {
        try { await d.pushImpl({ appToken: cfg.pushToken, userKey: cfg.pushUser }, { title: digest.subject, body: digest.text, priority: -1 }); sent = true; }
        catch (e) { console.error('council-agent: pushover digest failed', shortErr(e)); }
      }
      if (sent) { for (const r of nears) await markDigested(db, a, r); alerted += nears.length; }
    }
  }

  return alerted;
}
