# Slice 5 — adversarial review + Eye LITE + fixes (2026-10-12)

Adversarial review (fresh-context reviewer, diff 6c97f87..cdb8734): 0 🔴, 4 🟡 — all fixed:
1. 🟡 press_agent_expect / press_agent_watch_state kept Supabase default anon/authenticated grants (RLS was the only lock)
   → FIXED: db/20261012_agent_monitor_review_fixes.sql revokes them (applied `agent_monitor_review_fixes`).
2. 🟡 Fix on optimo "Nightly tidy-up" would fail (cron command unqualified, fn search_path='')
   → FIXED: press_agent_fix_run sets search_path=public,extensions locally before EXECUTE.
3. 🟡 GitHub watcher false alarm on silent failed→late flips (notified_at < since)
   → FIXED: db/20261012_agent_watch_silent_stamp.sql — BEFORE trigger stamps notified_at on every non-alerting change
   (mirrors watch-core isAlertingChange) + backfill (applied `agent_watch_silent_stamp`).
4. 🟡 check-in notes are public on agent-health.html → RULE added (docs/spec.md) + Mac _report.md step 4 wording:
   counts only, never amounts/names/providers/personal data.
🟢 notes accepted: ghRunToRow maps an on-purpose failure to ok (by design); remit CLAUDE.md access-contract text is
   now stale (opt-out) — next remit arc; detectAdmin refresh race — low risk, noted.

Eye LITE (screenshots): 1 🔴 P0 — "Receipt capture inlet" red "Failed — Has never run" beside "0 failed"
   → FIXED in the view: an enabled interval agent that never ran is now amber "late" · "Has never run — check it is
   connected". Live check: fsa-capture = late / "Has never run — check it is connected".
🟡 taken: blocked-screen headline now "You don't have access to this yet." (family-gate re-vendored into remit
   01306e1 + optimo 245f114; remit gauntlet 🟢; optimo gate specs 22 passed + publish-checks ✓).
🟡 deferred (Issues): private-wing pill wrap at 390px; wing-card title wrap <400px.
Gauntlet: see marquee-wings-slice-5-review-gauntlet.txt (GREEN).
