# family-wing-invites — independent review (one reviewer, run on head 934b3f1)

**VERDICT: NO-RED** (reviewer ran `node --test test/access-invite.test.mjs`; lock order JWT → admin-as-caller → service role confirmed; no secrets/real addresses; PostgREST filters `encodeURIComponent`'d; `name` escaped in access.html).

| # | Finding | Disposition |
|---|---------|-------------|
| 🟡1 | Invite upsert could rewrite/reactivate an existing **admin** row | FIXED — an existing admin row is never upserted (+ test) |
| 🟡2 | Rate-limit lookup failed open | FIXED — lookup failure ⇒ 502, nothing created/sent (+ test). Concurrent double-tap race remains (cost: one duplicate mail) — accepted |
| 🟡3 | Email regex allowed `, ; < > " \` in the local part | FIXED — tightened in invite.mjs and access.html (+ tests) |
| 🟡4 | Network throw uncaught in `invite()` | FIXED — wrapped, clean 502 (+ test) |
| 🟢5 | Resend selector built by string concat | FIXED — attribute compared in a filter loop |
| 🟢6 | `verify_jwt=false` only documented | NOTED — staged deploy request states `--no-verify-jwt`/`verify_jwt:false` read-back at verify |
| 🟢7–8 | `existing.name` greeting fallback; column/trigger behaviour | no change |
