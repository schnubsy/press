# press — arc history

Dated milestones, newest first.

---

## 2026-09-19 — arc/two-space-marquee CLOSED (+ two passkey hotfixes + press_deals cleanup)

The two-space marquee arc is complete. The private wing (public space + a personal wing gated by a
WebAuthn-PRF passkey, `press_vault`, with `spaces.json` driving the split and a fail-closed publish
gate in each app's `tools/release.js`) shipped earlier this arc; it then took two hotfixes to make
1Password enrolment actually work. **Hotfix 1** — 1Password's shim returns the PRF output as a
base64url STRING, not an ArrayBuffer, so `asBytes` threw `expected bytes`; fixed by decoding base64url
(PR #4, merge `b359581`). **Hotfix 2** (regression) — at credential-create 1Password returns an
unusable/enabled-only PRF, and `prfResult` called `asBytes` unguarded, so the throw escaped and skipped
enrol's `prfViaGet` assertion fallback; fixed by making `prfResult` total (returns null for any
unreadable shape) so enrol falls through to the `get()` (PR #6, merge `9f3f792`). Both live-verified
(served `index.html` blob == GitHub main blob == local blob; markers present; HTTP 200). Mark then
enrolled successfully — the wing unlocks and Card Scout renders deals through the vault. With the
precondition met, the deferred **`press_deals` cleanup** ran (migration
`20260918_press_deals_gate_cleanup`, Supabase version `20260919043403`): dropped the open
`_anon_all`/`_auth_all` policies, revoked anon+authenticated DELETE, `sync_id SET NOT NULL` (DEFAULT
kept). Negative probes captured (`docs/evidence/two-space-slice-4-deals-rls.txt`): no/wrong header ⇒ 0
rows + insert rejected; matching header ⇒ own rows only (15/15, 1 distinct sync_id); anon DELETE ⇒ 401;
not enumerable. `get_advisors(security)` shows no new lint. The 🔴 open-policy finding is CLOSED.
Standing rule set this arc: an outward-facing publish at the end of a green arc/hotfix needs no
separate merge approval. Lesson promoted: a probe must return null, not throw.

---

## 2026-09-14 — control-file contract v2 seeded

Branch `arc/control-files-v2`. Added CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md,
docs/history.md, docs/lessons.md, docs/evidence/.gitkeep. No migration needed (no
ORCHESTRATION.md / STATUS.html / CLAUDE-archive.md existed at root).

---

## 2026-09-14 — agent-health.html v4.0.0 shipped

agent-health.html grouped-by-app view live. Reads Supabase all-apps views at runtime
(client-side JS). Evidence: docs/evidence/agent-health-desktop.png,
docs/evidence/agent-health-mobile.png, docs/evidence/v4-slice-4-agent-health.txt.

---

## 2026-09-12 — council-guide.html published

council-guide.html added to marquee.

---

## 2026-07-17 — press marquee established

Initial set of pages published: kayley.html, eagle-path.html. README seeded.
