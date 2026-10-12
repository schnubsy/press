// supabase/functions/steward-reports/core.mjs — the pure half of the `steward-reports` Edge Function (ESM; Deno +
// Node 20+). No network, no env: index.ts injects a service-role `db` fetcher; the Node tests inject a fake.
//
// THE READ PATH (press arc/steward-report, 2026-10-12). `press_steward_reports` is SERVICE-ROLE-ONLY (RLS on, no
// policies, no anon/authenticated grant). steward.html never touches it with a browser key: it POSTs to this
// function with the private wing's capability in `x-plan-id`, and this function reads with the service role ONLY
// after that capability checks out. The capability is the private wing's Card Scout sync id — a 128-bit secret
// minted in-DB (press_deals.sync_id, db/20260918_press_deals_gate.sql), never committed, held only in Mark's
// passkey-sealed vault keyring. Re-using it means no new secret, no new Connect step and no Mark step; the cost is
// that steward access follows Card Scout's key (rotate one, both move). Only the `card-scout` page's id counts.

export const HISTORY_DAYS = 84;          // 12 weeks
export const HISTORY_LIMIT = 60;         // weekly + monthly over 12 weeks is ~15; generous ceiling
export const PLAN_ID_RE = /^[0-9a-f]{32}$/;

// A well-formed capability, or null. Shape-checking BEFORE any lookup keeps junk out of the PostgREST filter.
export function cleanPlanId(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  return PLAN_ID_RE.test(s) ? s : null;
}

// authorize(rawPlanId, db) → { ok, status }. db(path) is a service-role PostgREST fetch returning a Response.
// FAIL CLOSED: a missing/malformed id, a lookup error, an unparseable body or zero rows are all 401/503 — never ok.
export async function authorize(rawPlanId, db) {
  const id = cleanPlanId(rawPlanId);
  if (!id) return { ok: false, status: 401 };
  let r;
  try { r = await db('press_deals?page=eq.card-scout&sync_id=eq.' + id + '&select=item_id&limit=1'); }
  catch (_) { return { ok: false, status: 503 }; }
  if (!r || !r.ok) return { ok: false, status: 503 };
  let rows;
  try { rows = await r.json(); } catch (_) { return { ok: false, status: 503 }; }
  return (Array.isArray(rows) && rows.length > 0) ? { ok: true, status: 200 } : { ok: false, status: 401 };
}

// The PostgREST path for the reads (newest first, last 12 weeks).
export function reportsPath(now) {
  const since = new Date((now == null ? Date.now() : now) - HISTORY_DAYS * 86400000).toISOString();
  return 'press_steward_reports?select=id,run_at,cadence,headline,summary,sections,model,cost_usd' +
    '&run_at=gte.' + encodeURIComponent(since) + '&order=run_at.desc&limit=' + HISTORY_LIMIT;
}

// shape(rows) → the response body: the newest report in full + a light history (no sections) for the strip.
export function shape(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const latest = list[0] || null;
  const history = list.map((r) => ({ id: r.id, run_at: r.run_at, cadence: r.cadence, headline: r.headline }));
  return { latest, history };
}
