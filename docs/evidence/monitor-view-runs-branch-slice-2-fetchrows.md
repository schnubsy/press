# monitor-view-runs-branch — slice 2 — fetchRows hardening (done-proof)

File: `.github/scripts/agent-health-check.mjs` (workflow file unchanged). Tests: `test/monitor-view-timeout.test.mjs` (+7).

## What changed
- **(a) per-attempt timeout:** every attempt passes `signal: AbortSignal.timeout(TIMEOUT_MS)` (20 000 ms) to fetch. A
  `TimeoutError` / `AbortError` — on the request or while reading the body — is transient: retried like a network error
  (`::warning::Attempt <n> of 3: the press status service did not answer within 20 s — retrying in 10 s.`), and after
  3 attempts the job dies with `The press status service did not answer within 20 s. Not reporting healthy on a failed check.`
- **(b) bad body:** a 200 whose body is not JSON (`SyntaxError` from `r.json()`) fails at once through `fail()` with
  `The press status service answered HTTP 200 with a body that is not JSON (<first 120 chars of the parser message>). Not
  reporting healthy on a failed check.` — exit 1, no stack trace (was an unhandled throw).
- Unchanged: 5xx / network retried ×3, 10 s apart; 4xx fails at once; empty rows fail; `assess()` and `main()`.
- New injectables (tests only): `timeoutMs`, `timeoutSignal`. Production defaults: 20 000 ms, `AbortSignal.timeout`.

## Tests (new)
hang then 200 ⇒ rows, one warning (injected signal) · hang ×3 ⇒ the message, 3 calls · hang ×3 through the real `die()`
with a real `AbortSignal.timeout(30)` ⇒ exit 1 + `::error::` · 200 + bad JSON ⇒ the message, 1 call, no retry · the same
through the real `die()` ⇒ exit 1, no `SyntaxError` stack · a body read that times out ⇒ retried · every attempt carries
an `AbortSignal` of 20 000 ms.
Found while writing them: `AbortSignal.timeout`'s timer is unref'd, so a child process whose only pending work is a fake
hung fetch exits 13 (unsettled await) before the timer fires; a real hung request holds a socket open. The child test
holds the loop open with an interval — production is unaffected.

## Scoped run
`node --test test/monitor-view-timeout.test.mjs test/monitor-view-runs-branch.test.mjs test/agent-monitor.test.mjs`
→ tests 48 · pass 48 · fail 0. `node --check .github/scripts/agent-health-check.mjs` → ok.
