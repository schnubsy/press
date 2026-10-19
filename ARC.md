## 2026-10-19 — Agent Monitor: register Amazon memos + night-window times

SLICES: 1 · SINGLE-SLICE JUSTIFICATION: dependency — the change is one staged migration already written and gauntlet-checked by council PR #56; nothing else to split
EFFORT: S

Work order — Agent Monitor: register Amazon memos + night-window times

HOME: github:schnubsy/press
DEPLOYS: none
BRANCH: arc/amazon-memos-monitor
PUBLISH TARGETS: none

Mark asked for this (2026-10-19, "schedule the press change"). Source: council main (PR #56, 6aa445d)
docs/evidence/night-window-amazon-memos-staged-press.patch — validated there against press's full gauntlet (base vs patched identical).

=== SLICE 1 — apply the staged Agent Monitor migration ===
Scope: add db/20261019_amazon_memos_expect.sql exactly as in the council patch (fetch it: gh api -H 'Accept: application/vnd.github.raw' repos/schnubsy/council/contents/docs/evidence/night-window-amazon-memos-staged-press.patch, then git apply), run press's gauntlet, PR, D1 review, merge; then apply the SQL to Supabase project eepjhpyziczrxvirczio through the Supabase connector (non-destructive: one insert ON CONFLICT DO NOTHING + plain updates).
Files in play: db/20261019_amazon_memos_expect.sql only.
Done-criteria: press_agent_expect has row id='amazon-memos' (source 'checkin', sched weekly Mon 01:43); the five updated rows show their new sched; agent-health.html data (press_agent_health_public) lists amazon-memos under "The Money"; evidence in docs/evidence/amazon-memos-monitor-*.
