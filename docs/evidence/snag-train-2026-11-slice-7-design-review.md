# snag-train-2026-11 — slice 7: design review + performance

Reviewer: the Builder (Forge), against each Issue's acceptance. **No independent Eye sub-agent ran** (this cloud session
has no Agent tool) — the chat's verify reviews the screenshots below before the merge button.

| Surface | Before → after | Verdict |
|---|---|---|
| Lobby wing cards, 390 (#28, #29) | `slice-7-before-wings-390.png` → `slice-7-after-wings-390.png` | 🟢 kickers already one convention (tagline / name in h3); private card meta line now sits 14px under the 3-line hero instead of flush |
| Lobby wing cards, 1280 | squares unchanged (spec: aspect ratio 1 ± 0.02) | 🟢 |
| FSA card glyph (#30) | `slice-3-fsa-glyph-390.png` — stethoscope | 🟢 reads as medical; no plus |
| Thrift Shop connect row (#31) | `slice-4-deals-hint-{393,1280}.png` | 🟢 one muted hint line explains the shorter row; same type scale as `.tw-cmeta` |
| Collapsed Connect your tools (#32) | `slice-7-before-wing-collapsed-390.png` → `slice-5-collapsed-{390,1280}.png` | 🟢 page ends 16px under Manage (was 40px + void); expanded / Devices open keep 40px |
| Recovery kit, Cardsharp redacted (#34) | `slice-6-kit-unlock-{before,after,320}.png` | 🟢 primary pill under the table, hidden in print; 🟡 wraps to two centred lines below ~400px (named designed exception in `test/ui-audit.config.mjs`) |

## Performance (no Lighthouse in an arc — testing.md "Test budget")
Local server, Chromium, 390×844, median of 5 cold loads, network stubbed (`snag-train-2026-11-slice-7-perf.json`; numbers above from the first run):
index.html 159,622 → 162,009 B (+2,387 B, +1.5 %); lobby to `.tw-wings` 97 → 80 ms; wing to `.tw-connect` 80 → 82 ms
(noise). No new request, script or font. 🟢
