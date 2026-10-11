import { defineConfig, devices } from '@playwright/test';

// Cloud mode (migrate-home, 2026-10-11; optimo arc 7 precedent): a cloud session has an older Chromium under
// /opt/pw-browsers than this Playwright pins, no WebKit, and cannot download browsers. When PW_CHROMIUM is set
// (scripts/gauntlet.sh sets it automatically when it finds /opt/pw-browsers/chromium), every project launches
// that binary. The WebKit iPhone spec then runs as Chromium iPhone-15 emulation; real-Safari checks stay on the
// Mac gauntlet / Mark's phone. Unset (the Mac) = unchanged behaviour.
const CLOUD_CHROMIUM = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { headless: true, trace: 'off', ...(CLOUD_CHROMIUM ? { launchOptions: { executablePath: CLOUD_CHROMIUM } } : {}) },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
