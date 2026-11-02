import { defineConfig, devices } from '@playwright/test';

// Test shape: council testing.md → "Web" (projects, engines, retries). press specifics only below.
// Cloud mode: when PW_CHROMIUM is set (scripts/gauntlet.sh sets it when /opt/pw-browsers/chromium exists), the desktop
// project launches that binary — a cloud image's Chromium is older than the one this Playwright pins.
const CLOUD_CHROMIUM = process.env.PW_CHROMIUM;
// Phone-only spec (touch drag) — never on desktop.
const PHONE_ONLY = '**/wing-drag-iphone.spec.mjs';
// The phone suite: the touch-drag spec + the pages whose phone layout press owns.
const PHONE_SPECS = [PHONE_ONLY, '**/steward.spec.mjs', '**/family-gate.spec.mjs', '**/card-labels.spec.mjs', '**/thrift-shop-rename.spec.mjs'];

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  failOnFlakyTests: true,
  reporter: [['line']],
  use: { headless: true, trace: 'off' },
  projects: [
    { name: 'desktop', testIgnore: PHONE_ONLY,
      use: { ...devices['Desktop Chrome'], ...(CLOUD_CHROMIUM ? { launchOptions: { executablePath: CLOUD_CHROMIUM } } : {}) } },
    // desktop-titled tests stay on desktop (they also write the *-desktop evidence PNGs)
    { name: 'iphone-webkit', testMatch: PHONE_SPECS, grepInvert: /desktop/i,
      use: { ...devices['iPhone 15'], browserName: 'webkit' } },
  ],
});
