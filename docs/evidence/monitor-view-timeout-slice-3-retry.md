# monitor-view-timeout — slice 3 — the watcher-of-the-watcher retries once (done-proof)

File: `.github/scripts/agent-health-check.mjs` — `fetchRows` retries a network error or HTTP 5xx up to 3 attempts,
10 s apart, printing `::warning::Attempt <n> of 3: …` per retry; then dies with the unchanged
"Not reporting healthy on a failed check" message (exit 1). A 4xx dies at once (not transient). `assess()`, exit codes and
`.github/workflows/agent-health-notifier.yml` unchanged (worst case adds 20 s to a 5-minute job budget).
Injectable `{ attempts, retryMs, sleep, fail, log }` for tests only; production defaults = 3 / 10 000 ms / setTimeout / die / console.log.

Scoped run: `node --check .github/scripts/agent-health-check.mjs` ✓ ·
`node --test test/monitor-view-timeout.test.mjs test/agent-monitor.test.mjs` → tests 32 · pass 32 · fail 0 (205 ms).
- 500 then 200 ⇒ rows, one warning "Attempt 1 of 3 … HTTP 500 — retrying in 10 s.", one 10 000 ms wait
- network error then 200 ⇒ rows
- 500 ×3 ⇒ "The press status service answered HTTP 500. Not reporting healthy on a failed check." after 3 calls, 2 waits
- 401 ⇒ fails at once, 1 call, no warning
- 500 ×3 through the real `die()` in a child process ⇒ exit status 1, `::error::` message, warnings for attempts 1 and 2
(First run of the 4xx test failed — `fail()` thrown inside the `try` was caught as a network error; fixed by moving the
status handling out of the `try`, re-run green above.)
