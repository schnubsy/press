import { defineConfig, devices } from '@playwright/test';

// Cloud mode (migrate-home, 2026-10-11; optimo arc 7 precedent): a cloud session has an older Chromium under
// /opt/pw-browsers than this Playwright pins. When PW_CHROMIUM is set (scripts/gauntlet.sh sets it automatically when
// it finds /opt/pw-browsers/chromium), the CHROMIUM project launches that binary. Unset (the Mac) = unchanged.
//
// arc/safari-ui (2026-10-12): Safari (WebKit) is the iPhone engine of record. scripts/gauntlet.sh runs
// `npx playwright install webkit` (needs cdn.playwright.dev + playwright.download.prss.microsoft.com — secrets-map
// "Egress"), so the `iphone-webkit` project runs REAL WebKit with the iPhone 15 profile in the cloud too. Only when
// that install fails does the gauntlet set PW_NO_WEBKIT=1, run `--project chromium` alone and report
// GAUNTLET PARTIAL (egress) — never a Chromium run called Safari-green.
const CLOUD_CHROMIUM = process.env.PW_CHROMIUM;
// The iPhone smoke on WebKit: the touch-drag spec (iPhone-only) + the pages whose phone layout is press-owned.
const IPHONE_SPECS = ['**/wing-drag-iphone.spec.mjs', '**/steward.spec.mjs', '**/family-gate.spec.mjs', '**/card-labels.spec.mjs', '**/thrift-shop-rename.spec.mjs'];

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { headless: true, trace: 'off' },
  projects: [
    { name: 'chromium', testIgnore: '**/wing-drag-iphone.spec.mjs',
      use: { ...devices['Desktop Chrome'], ...(CLOUD_CHROMIUM ? { launchOptions: { executablePath: CLOUD_CHROMIUM } } : {}) } },
    // desktop-titled tests stay chromium-only (they also write the *-desktop evidence PNGs)
    { name: 'iphone-webkit', testMatch: IPHONE_SPECS, grepInvert: /desktop/i, use: { ...devices['iPhone 15'] } },
  ],
});
