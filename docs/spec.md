# press — spec

## Overview

press is a static GitHub Pages site at https://schnubsy.github.io/press/ that serves
as the marquee publishing target for the council system.

## Portal contract

`index.html` is the entry portal. It reads `pages.json` to render the page list with
KICKERS (short taglines) and ICONS. Every published page must have an entry in
`pages.json`.

### pages.json shape

```json
[
  {
    "filename": "example.html",
    "title": "Example Page",
    "kicker": "Short tagline shown on portal",
    "icon": "emoji-or-icon-id"
  }
]
```

## Page contract

Each published page is a **single self-contained HTML file**. Requirements:

- All assets inlined or referenced from a sibling assets directory (e.g. `council-assets/`)
- No server-side dependencies except where the page explicitly declares them
  (e.g. `agent-health.html` calls Supabase at runtime)
- Pages must render correctly at https://schnubsy.github.io/press/<filename>
- No build step — what is committed is what is served

## Publish flow

1. Page is authored or updated in the source project
2. Press instrument runs Lane A: hash-verify content → copy to press repo → update
   `pages.json` → commit → push → GitHub Pages deploys automatically
3. Lane B (emergency): hot-patch committed directly; must be documented in
   `docs/evidence/` with a brief note

## Assets directories

Sibling asset directories (e.g. `giving-assets/`, `council-assets/`) are referenced
by their paired page and committed together.
