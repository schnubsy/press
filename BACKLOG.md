# press — BACKLOG

Non-P0 items parked for later. Populated by the Eye LITE design review of the marquee UI batch
(arc/marquee Phases 3–5), 2026-09-22. P0 findings from that review were actioned in slice 4; everything
below is polish/verify, not shipping-blockers.

## From the Eye LITE review (2026-09-22) — marquee UI batch

- **P1 — Kicker taxonomy is inconsistent across surfaces.** The family landing card kicker *names the
  wing* ("THE FAMILY WING") while the private card kicker *names a category* ("PERSONAL"). Pick one
  convention (e.g. kicker = category everywhere: FAMILY / PERSONAL; hero = the evocative line). Note:
  the family kicker text "The Family Wing" was Mark's explicit slice-2 instruction, so changing it needs
  his sign-off.
- **P1 — Mobile wing squares are cramped.** On phone width the multi-line hero + meta line sit tight.
  Add vertical breathing room between hero and meta, or step the mobile hero down one notch.
- **P2 — FSA "medical cross" reads as a generic plus at 26px.** Recognizable but says "add", not
  "medical/FSA". Only worth tightening if we want stricter semantics.
- **P2 — Card Scout connect block is asymmetric** (single sync-id field + Verify, no passphrase, no
  Download) vs the other three tools. This is *intentional* (card-scout is sync-id-only, kind:'deals'),
  but confirm it reads as deliberate rather than broken.
- **P2 — Collapsed "Connect your tools" leaves a large empty void** below the MANAGE row. Consider
  trimming the gap / pulling the footer up so the collapsed state feels settled.
- **P3 (verify, not a defect) — "· N tools ·" is only on the landing card lockline, not in the wing-view
  session dek.** By design: the card lockline reads "Unlocked · 4 tools · until 7:41 pm" (the literal
  tokens marquee.spec.mjs pins); the in-wing dek is a sentence ("Unlocked · until 7:41 pm. Open any
  tool …"). Left as-is; flagged only so nobody re-adds the count to the dek by accident.

## Device-check decisions (raised by slice 4, need Mark)

- **perth's Australia glyph (Eye P0 #2, partially addressed).** Hand-drawn Australia (Feather has none).
  Improved to a smooth landmass + enlarged Tasmania dot, but at row size (~26px) it reads as *a* landmass
  more than unmistakably Australia — a stroked country silhouette is at the edge of what survives 26px.
  **Decision for Mark:** accept the current glyph, OR have it swapped to a Feather `map-pin` at row size
  (resolves legibility, drops the literal Australia — which contradicts the original "small Australia" ask,
  so it's Mark's call).
