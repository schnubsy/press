# tenants-check-siblings — D1 merge review (PR #45)

Independent fresh-context reviewer subagent on `origin/main...4108971`. **Verdict: NO 🔴.**

- 🟢 Defaults: `CODE_ROOT` = `resolve(join(PRESS,'..'))`, `COUNCIL_DIR` = `resolve(join(PRESS,'..','council'))`; env overrides kept; no `homedir()/Documents` defaults (`homedir` only for `~` repoPath expansion — allowed by the order).
- 🟢 Header line present (Mac run sets `COUNCIL_DIR` / `CODE_ROOT` when siblings aren't beside it).
- 🟢 `--press`-relative defaults (S2 review fix) — tested (e3); no change for a normal run.
- 🟢 Defaults test: realpath'd base, positive T8 PASS, exact MISSING path, `--press` moves defaults. Re-run: 34/34; tenants-check 69/0/24/1.
- 🟢 Scope clean: no `*.html`, `pages.json`, `spaces.json`, `tenants.json`, `.github`; `gauntlet.sh` comment-only. No secrets in evidence.
- 🟢 ARC.md truncated to 0 bytes; Merge state "PR pending" pre-merge as expected.
- 🟡 Mac behaviour: a bare Mac run without a sibling council FAILs T8 — intended + documented; claude-environment Mac tasks may need `COUNCIL_DIR` (→ HANDOFF next step).
- 🟡 The carried patch (`unpin-the-mac-slice-2-press.patch`) predates S2 (SELF_ROOT) — historical record, never re-apply.
- 🟡 council-guide `repoPath` still SKIPs T2 in cloud clones (already in HANDOFF).
