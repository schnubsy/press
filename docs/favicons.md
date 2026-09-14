# press — favicon register

Every page published to the Marquee carries an icon. No page ships with the browser's
default grey globe. The rule lives in the council press instrument
(`skills/hand/references/press.md` → **Favicon**); this file is the register.

## House standard

A 64x64 SVG, inlined as a `data:image/svg+xml;base64,...` in `<link rel="icon">`,
placed immediately after `<meta name="page-title">` (or after `</title>` when the page
has no page-title meta). No external asset — the single-file rule holds.

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="{ACCENT-A}"/><stop offset="1" stop-color="{ACCENT-B}"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="{GROUND}"/>
  <g transform="translate(8 8) scale(2)" fill="none" stroke="url(#g)"
     stroke-width="{2.6-3.4}" stroke-linecap="round" stroke-linejoin="round">
    {GLYPH — authored in a 24x24 Feather box}
  </g>
</svg>
```

- **Ground** = the page's own dark background colour. **Accents** = the page's own two
  brand colours, as a `userSpaceOnUse` gradient running corner to corner.
- **Glyph** = one idea, Feather/Lucide grade, legible at 16px. Three strokes or fewer
  wherever possible. Reuse the portal's ICON REGISTRY glyph (`index.html`) when one fits;
  simplify it if it turns to mush at 16px.
- **`<meta name="theme-color">`** is set alongside, to the page's *real* background —
  light pages get their light value, not the icon ground.
- **Assets lane:** a page that already ships a purpose-built PWA icon set
  (`<name>-assets/icon.svg` + `icon-192.png` + `icon-180.png` + manifest) keeps it.
  Never overwrite a bespoke set with the inline standard. Reference: `giving.html`.

## Register

| File | Page | Ground | Accents | Glyph | Lane |
|---|---|---|---|---|---|
| `index.html` | The Marquee | `#100C1E` | `#B7A8FF → #E7A6C7` | gradient **M** chevron | inline |
| `agent-health.html` | Agent Health | `#100C1E` | `#57C79A → #B7A8FF` | activity / pulse line | inline |
| `council-guide.html` | The Council | `#0B0D11` | `#E0C271 → #C6A24B` | crown | inline |
| `eagle-path.html` | Brandon's Eagle Path | `#15181C` | `#5AA9F0 → #8FC6A8` | summit / mountain | inline |
| `giving.html` | Giving Tracker | `#14110F` | `ember ramp #F0B072 → #D98A4E` | flame on a ledger line | **assets** (`giving-assets/`, PWA set) |
| `halvsies.html` | Halvsies | `#0E1114` | `#7C5CFF → #FF6B5E` | circle split in half | inline |
| `kayley.html` | Kayley · Upskilling Plan | `#100C1E` | `#8E7BE8 → #E7A6C7` | three ascending bars | inline |
| `retirement.html` | Retirement Projection | `#0F1618` | `#7BC0AC → #E0BD8F` | rising line | inline |

## Glyph paths (24x24 box)

| File | Path | Stroke |
|---|---|---|
| `index.html` | `<path d="M3.5 19.5V4.5l8.5 9.5 8.5-9.5v15"/>` | 3.4 |
| `agent-health.html` | `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>` | 2.6 |
| `council-guide.html` | `<path d="M3 19 4.6 7.2l4.7 4.6L12 4.5l2.7 7.3 4.7-4.6L21 19z"/>` | 2.6 |
| `eagle-path.html` | `<path d="M2.5 19.5 9.5 6.5l4.2 7 2.6-4 5.2 10z"/>` | 2.6 |
| `halvsies.html` | `<circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="21"/>` | 2.6 |
| `kayley.html` | `<line x1="5" y1="19" x2="5" y2="15"/><line x1="12" y1="19" x2="12" y2="11"/><line x1="19" y1="19" x2="19" y2="6"/>` | 3.0 |
| `retirement.html` | `<polyline points="3 18 9.5 11.5 13.5 15.5 21 6"/>` | 2.8 |

## Verify before publish

1. `grep -c 'rel="icon"' <file>` returns exactly `1`.
2. The data URI base64-decodes to well-formed SVG.
3. Render at **16x16** and look at it. Never judge the 64px version — detail that reads
   at 64 disappears at 16.
