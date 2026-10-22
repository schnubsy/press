## 2026-10-22 — thrift-shop-redesign card label

## Arc — thrift-shop-redesign card: own icon + test label (press gauntlet back to green)
EFFORT: S · PUBLISH TARGETS: none · Forge owns, Snag consults

**Why (Mark, 2026-10-22, "Yes"):** publish d39be4e added `thrift-shop-redesign.html` (pages.json + index.html LABELS) but
`test/card-labels.spec.mjs` fails on chromium + iphone-webkit (verified on unpatched d39be4e and on 88f0d9c):
1. `WANT` has no `'thrift-shop-redesign.html'` entry ⇒ "exactly the served set" + the landing kicker/title test fail.
2. LABELS gives it `icon:'drop-bag'` — the same glyph as `thrift-shop.html` ⇒ "two cards share an icon" would fail next.

**Slice 1:** add a distinct ICONS glyph for the redesign (e.g. a pencil/ruler or layers "design review" mark — simple
24×24 stroke SVG matching the set's style, aria-hidden), point LABELS at it, and add
`'thrift-shop-redesign.html': ['Design review', 'Thrift Shop Redesign']` to `WANT` (update the test's "eleven renamed
pairs" title only if the count wording is now wrong). Do not touch the page itself, pages.json or spaces.json beyond this.
Run `node tools/inline-vault.mjs --check` if index.html changes near the inlined vault.
**Gate:** full `bash scripts/gauntlet.sh` — card-labels green on both projects; tenants-check stays red ONLY on the
private tenant clones this session can't read (same count as base) — report that row as BLOCKED (access), not a regression.
**Success:** Playwright all green; ui-audit GREEN on WebKit.
