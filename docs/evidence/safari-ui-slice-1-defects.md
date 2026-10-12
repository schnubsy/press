# safari-ui slice 1 — the first iPhone UI audit of press, on WebKit (2026-10-12)

Harness: `test/ui-audit/{ui-probe,run}.mjs` vendored byte-identical from council `instruments/ui-audit` @ main `c7c7c87` (stamp `council-ui-audit@1.0.0`; git hash-object ui-probe `b554a025`, run `b3e244af` both sides). Config `test/ui-audit.config.mjs`: 19 states (lobby, archive, private wing first-time/locked/unlocked/devices/recovery-kit, family wing sign-in/code/signed-in, steward locked/report, agent monitor list/detail/admin, access locked/sign-in/admin) × 320/375/390/393/430 × dark+light = 190 surfaces. Engine: **WebKit 26.6** (installed in this session from cdn.playwright.dev).

Verdict: **RED** — the defect inventory S2 fixes (grouped; full rows in `safari-ui-slice-1-harness-ui-audit.json`):

| n | check | element | widths | states | detail |
|---|---|---|---|---|---|
| 10 | font16 | `input#lk "http://127.0.0.1:46549/inde…"` | 320/375/390/393/430 | access-admin | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-pass "Cardsharp passphrase"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-pass "FSA Claims Tracker passphra…"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-pass "Giving Tracker passphrase"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-pass "Retirement Projector passph…"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-sync "Cardsharp sync id"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-sync "FSA Claims Tracker sync id"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-sync "Giving Tracker sync id"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 20 | font16 | `input.tw-cinput.tw-sync "Retirement Projector sync i…"` | 320/375/390/393/430 | private-unlocked, private-devices | font-size 13.00px — iOS zooms on focus |
| 40 | touch | `a.back "← the private wing"` | 320/375/390/393/430 | steward-report, access-locked, access-signin, access-admin | 110×20 |
| 20 | touch | `a.fg-back "← the family wing"` | 320/375/390/393/430 | family-signin, family-code | 101×16 |
| 10 | touch | `a.lnk "Apps Script ↗"` | 320/375/390/393/430 | monitor-detail | 103×31 |
| 10 | touch | `a.lnk "Function logs ↗"` | 320/375/390/393/430 | monitor-admin | 113×31 |
| 10 | touch | `a.pg-back "← the marquee"` | 320/375/390/393/430 | steward-locked | 86×20 |
| 90 | touch | `a.tw-back "← the marquee"` | 320/375/390/393/430 | archive, private-first-time, private-locked, private-unlocked, private-devices, family-signed-in, monitor, monitor-detail, monitor-admin | 122×25 |
| 10 | touch | `button#pg-unlock.pg-btn "Use your passkey"` | 320/375/390/393/430 | steward-locked | 181×41 |
| 20 | touch | `button#unlockBtn.tw-btn "Use your passkey"` | 320/375/390/393/430 | private-first-time, private-locked | 175×38 |
| 10 | touch | `button.on-btn "Turn on"` | 320/375/390/393/430 | access-admin | 79×36 |
| 30 | touch | `button.pbtn "Deactivate"` | 320/375/390/393/430 | access-admin | 94×28 |
| 10 | touch | `button.retry "Retry now"` | 320/375/390/393/430 | monitor-admin | 87×31 |
| 20 | touch | `button.tw-mini.tw-connect-toggle "Hide"` | 320/375/390/393/430 | private-unlocked, private-devices | 55×27 |
| 80 | touch | `i.sw2.on` | 320/375/390/393/430 | access-admin | 38×21 |
| 10 | touch | `i.sw2` | 320/375/390/393/430 | access-admin | 38×21 |
| 30 | touch | `span#refresh.refresh "Refresh"` | 320/375/390/393/430 | monitor, monitor-detail, monitor-admin | 101×28 |
| 20 | touch | `span#setupLink.tw-setup-link "First time on any device? S…"` | 320/375/390/393/430 | private-first-time, private-locked | 212×33 |
| 16 | wrap | `span#setupLink.tw-setup-link "First time on any device? S…"` | 320/375/390/393 | private-first-time, private-locked | "First time on any device? Set up a" wraps onto 2 lines |
| 24 | wrap | `span.line "Last real work 3 hours ago …"` | 320/375/390/393 | monitor, monitor-detail, monitor-admin | "Last real work 3 hours ago · 5 dea" wraps onto 2 lines |
| 6 | wrap | `span.line.bad "Last attempt failed · last …"` | 320 | monitor, monitor-detail, monitor-admin | "Last attempt failed · last real wo" wraps onto 2 lines |
| 30 | wrap | `span.line.warn "Missed the run due Wed Oct …"` | 320/375/390/393/430 | monitor, monitor-detail, monitor-admin | "Missed the run due Wed Oct 7, 12:0" wraps onto 3 lines |

Also found while seeding the harness (fixed in S1): the Playwright test runner hands every browser type the running project's launchOptions, so the cloud chromium executablePath made `sealed-unlock`'s real-WebKit IDB test fail to launch and silently SKIP; it now launches `webkit.executablePath()` explicitly (0 skips).
