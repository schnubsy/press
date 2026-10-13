# safari-ui slice 3 — /code-review slice + sentry (2026-10-13)

Reviewer: a fresh general-purpose sub-agent bug-hunting `git diff origin/main...arc/safari-ui` (vendored ui-audit pair,
evidence and lockfile excluded). Gauntlet after the fixes: `safari-ui-slice-3-review-gauntlet.txt` — GREEN (unit 137 ·
inline in sync · tenants-check 0 fail · Playwright 130, 0 skips · ui-audit GREEN on WebKit, 20 states × 5 widths × 2 = 200 surfaces).

| finding | verdict | action |
|---|---|---|
| 🔴 `gauntlet.sh` `"${PWARGS[@]}"` empty array under `set -u` dies on bash < 4.4 (macOS /bin/bash 3.2 — the Mac run) | confirmed (documented bash behaviour) | `${PWARGS[@]+"${PWARGS[@]}"}` |
| 🟡 `iphone-webkit` also ran desktop-titled tests, rewriting the chromium `*-desktop` evidence PNGs | confirmed | project `grepInvert: /desktop/i` (Playwright 132 → 130: the 2 desktop tests now run once, on chromium) |
| 🟡 stale `$UISTEM.txt` could feed a crashed run's RED summary | confirmed | `rm -f` before stage 5 |
| 🟡 states never audited: steward denied · Family Wing blocked/requested · access switch busy/err | partly | **steward-denied added** — it found a real defect (the in-message "private wing" link, 265×42, was not in running text) → the state text is now a `<p>`, so its inline link is WCAG 2.5.8-exempt. The family-gate blocked state only renders on gated TENANT pages (out of press-native scope; their own ui-audit roll-outs). Switch busy/err are transient opacity/outline changes on the same 44px box. |
| 🟡 first-load writes survive into a state's own navigation | rejected | each state is a new page; the wipe precedes every state's seed; 0 undriven across 200 surfaces |
| 🟢 span→button handlers, print CSS, `::before` pills with `isolation:isolate`, `.sw2` geometry/states, override specificity, exit-code precedence, WebKit revision dedupe | fine | — |

Sentry (the required step): secrets scan of the arc's added lines (`sb_secret_`, service-role, JWTs, GitHub/Anthropic/AWS
tokens, PEM, DSNs, key literals) — **0 hits**. Fixtures are throwaway (`c1a2…d6` capability, a `not-a-secret:` sentinel,
`*.test` emails). New egress: the two WebKit hosts only (secrets-map "Egress").
