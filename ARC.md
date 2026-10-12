## 2026-10-12 — steward report page

SLICES: 3 · SINGLE-SLICE JUSTIFICATION: none
Work order — press: steward report page
HOME: github:schnubsy/press
BRANCH: arc/steward-report
/goal close-out manifest all DONE/N/A, gauntlet + sentry green, verify evidence committed, page live (ship proof)
S1 — table: copy council `instruments/agent/db/20261012_press_steward_reports.sql` to press `db/`, apply it via the
     Supabase connector (surface.md → "Supabase channel"). Service-role-only (RLS on, no policies, no anon /
     authenticated grant). Done: `select relrowsecurity from pg_class where relname='press_steward_reports'` = t;
     the grants query (council audit.md group 8) shows service_role only; one fixture row inserted + read back.
     Status: done 155c873
S2 — page `steward.html` in the PRIVATE wing (passkey gate, same tier as fsa / giving — `spaces.json` tier,
     `pages.json` title "Steward", favicon per docs/favicons.md): the latest report (headline 🟢/🟡/🔴, Needs you,
     Fixed for you, Cost moves, All clear) + a 12-week history strip (one dot per run, weekly + monthly),
     mobile-first 390px. Reads through the private wing's existing service-role read path — never an anon key.
     Done: Playwright outcome test — given the fixture row, when Mark opens the page past the gate, then he sees
     the headline and the Needs-you lines; an ungated request gets no rows.
S3 — /code-review slice; close per arc.md rule 4 incl. publish ship proof (live 200 + blob SHA == hash-object).
Chat: run verify
