# press — lessons & tag conventions

## Tag conventions

Tags on press commits follow: `chore(v<N>): <description>` for control-file work,
`feat: <description>` for new pages, `fix: <description>` for hot-patches.

Evidence slice files follow: `v<N>-slice-<seq>-<topic>.txt` (e.g. `v4-slice-9-press.txt`).

---

## Known lessons

### Lane A / B hash-verify rule

All publish operations through the press instrument must verify the content hash of
the page file before committing. Lane A is the normal path: hash the source file,
copy to press repo, verify hash matches, then commit. Lane B (emergency hot-patch)
bypasses the source project but must document the patch in `docs/evidence/` with
a brief description of why Lane A was bypassed.

Reason: a mismatch between the authored version and what gets published is invisible
once GitHub Pages deploys. The hash step is the only safety net.

### pages.json must stay in sync

The portal (`index.html`) renders entirely from `pages.json`. If a page is published
without updating `pages.json`, it will not appear on the portal. Always update
`pages.json` as part of the publish commit — never in a separate commit.

### Single-file page constraint

Pages must be self-contained. External CDN dependencies that break due to CORS or
CSP will silently degrade the published page. Prefer inlining or use well-known
CDNs (cdnjs.cloudflare.com, cdn.jsdelivr.net/npm).
