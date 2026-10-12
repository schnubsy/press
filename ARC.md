## 2026-10-12 — Marquee wording · Family Wing access requests · Agent Monitor rebuild

SLICES: 6 · SINGLE-SLICE JUSTIFICATION: none
HOME: github:schnubsy/press · BRANCH: arc/marquee-wings-monitor (+ remit, optimo re-vendor in their own repos)

Ratified decisions (Mark, 2026-10-12 checkpoint):
- RULE: the marquee owns card naming. Kicker (small pink) + title (large white) live in ONE marquee label map in
  index.html; app releases never set card wording. New web apps coordinate with the marquee for naming (spec + tenants-check enforce).
- RULE: sign-in email is wing-level ("Your Family Wing sign-in code"), owned by press, synced AUTOMATICALLY to Supabase Auth
  (Mark creates one Supabase personal access token → Actions secret; a press workflow pushes the template).
- RULE: Family Wing = no extra passwords. Switch off → person is blocked with "Request access" → Mark notified → flips on → next visit works. Default all-on.
- RULE: alerts (agents + access requests) = Pushover push + Gmail email (existing notify standard).
- RULE: agent "Fix" actions only work for Mark (admin-authenticated server-side); the public monitor stays read-only.

=== SLICE 1 — Marquee card wording + icons ===
Kicker / Title: optimo=Day planner/Optimo · perth=Moving to Perth/The Runway · halvsies=Splitting the Bill/Halvsies ·
cardsharp=Gift Card Tracker/Cardsharp · card-scout=Sales Finder/Card Scout · access=UAM/Family Wing Access ·
retirement=Financial Planning/Retirement Projector · giving=Charitable Donations/Giving Tracker ·
fsa=Medical Expenses/FSA Claims Tracker · council-guide=Agentic Capabilities Prospectus/The Council.
Remove the filename (.fn) lines entirely. Refresh generic icons (optimo, access, FSA, card-scout; review all).
Spec + tenants-check: every served page needs a marquee label entry. Done: tests updated, screenshots desktop+mobile.
Status:

=== SLICE 2 — Family Wing: email template, request access, Access Manager ===
Wing-level OTP email template committed + sync workflow (Management API) + check. Request-access table/RPC + notify edge
function (push+email) + blocked-screen button in src/family-gate.js (index.html/perth.html inlined copies synced).
access.html → "Family Wing Access Manager", shows pending requests; flipping on resolves them. remit RLS → press_access_has (opt-out).
Status:

=== SLICE 3 — Tenants re-vendor family-gate (remit, optimo) + release ===
Status:

=== SLICE 4 — Agent Monitor rebuild ===
Health from real work (ok runs / real output), never `skipped`. Inventory every agent/AI/job/scheduled task (cloud, Mac local,
browser lane) with expected cadence → Late detection. Landing = dots grouped by app; click expands detail card; switched-off
collapsed at bottom. Projected month cost = mtd + avg(last 7 complete days) × remaining days. Server-side watcher (pg_cron →
edge fn) alerts on state change via push+email; GH Action becomes an independent watcher-of-the-watcher. Admin-only Fix/Retry
(edge fn verifies admin JWT) + per-agent "how to fix" links. Scheduled tasks check in (Supabase connector) at end of run.
Status:

=== SLICE 5 — Adversarial review (/code-review) + design review + perf ===
Status:

=== SLICE 6 — Close: publish, ship proof, handoff ===
Status:
