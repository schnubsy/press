# steward-report — close-out ship proof (2026-10-12)

## Merge + reconcile
- PR #36 was merged by the Builder via the GitHub connector. Merge commit `780876668bc22894260c4f546832d5143fee6bc9`.
- Cloud clone reconcile: `git checkout main && git pull --ff-only`. Then `origin/main == HEAD == 7808766…`, asserted OK.
- Post-merge stage stamp `131795a`, pushed to main. `origin/main == 131795ac7c836b694def672e3c13017fa69bfc80`.
- Companion council PR #28 merged as `3b707b554e30ce4335447e329219f923ce655219`, the snag-registry row. Council is `Home: mac:`, so the Mac main checkout picks it up on its next `git pull`.

## Publish: GitHub Pages serves press main
| file | `git hash-object` (clone @ 131795a) | GitHub blob on main | match |
|---|---|---|---|
| steward.html | `0088d0c355e2302fdfc4dea7c4b3070d7b5fa321` | `0088d0c355e2302fdfc4dea7c4b3070d7b5fa321` | ✅ |
| index.html | `5cf6ced8dcd62c88b3a28a356b5a8af3777b1af4` | `5cf6ced8dcd62c88b3a28a356b5a8af3777b1af4` | ✅ |
| spaces.json | `bd8efb34c5381cf58aed0a0d9f216d0cb82ecf1c` | `bd8efb34c5381cf58aed0a0d9f216d0cb82ecf1c` | ✅ |
| pages.json | `cb776d7875a53a3922838dc492261f0503217d86` | `cb776d7875a53a3922838dc492261f0503217d86` | ✅ |
| tenants.json | `6c96c090de775b90d0de2cf15f33095ac8852889` | `6c96c090de775b90d0de2cf15f33095ac8852889` | ✅ |

- Before this arc, steward.html had no blob; after, `0088d0c`. The fingerprint changed and matches the source.
- Pages deployment: run 38284238911 (`pages build and deployment`, head `131795a`) was **in_progress** when this was written. The `7808766` run was cancelled because the stamp push superseded it, which is normal.
- **Live `GET https://schnubsy.github.io/press/steward.html` → 200: BLOCKED (egress).** The cloud proxy rejects CONNECT to schnubsy.github.io (403, organization policy). The check was not routed around; the chat's verify checks it in Chrome.

## Deploys: Supabase (connector)
- Table `press_steward_reports`: applied, with RLS on, no policies and service_role-only grants. Evidence in slice 1.
- RPC `press_steward_capability_ok`: applied. Execute is granted to service_role only.
- Edge Function `steward-reports`:
  - Before the arc: absent. v1 `c15355d3…`. v2 `6d542a81f77699fce2a4ba43994d0fb6a29a64350466776094ba2ef61dedfa49`.
  - `verify_jwt=false`, ACTIVE.
  - Source read-back (`get_edge_function`): index.ts and core.mjs are identical to `supabase/functions/steward-reports/` on main.
  - Live behaviour, via pg_net with the capability selected in-DB:
    - no key / zeros / non-default key → 401;
    - real key → 200 `{"latest":null,"history":[]}`, because the fixture sits outside the window;
    - anon REST and anon RPC → 42501;
    - anon OpenAPI → 401 "Secret API key required".

## Worktree sweep
N/A: web home (an ephemeral cloud clone). `git worktree list` shows the clone only, and no `worktree-agent-*` branches exist.
