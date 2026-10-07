// cardsharp Arc 10 slice 11 — iPhone touch long-press drag, on WebKit (iPhone 15 profile).
// Touch is driven by dispatching pointer events (pointerType 'touch') — the same stream iOS
// Safari delivers to wireDrag. Proves the long-press lifts, the drop reorders in BOTH wings and
// the public marquee, and a touch that moves before the hold is treated as a scroll.
import { test, expect, devices } from '@playwright/test';
import { join } from 'node:path';
import { startServer, harness, order, reloadFromCloud, ROOT, PUBLIC_FILES, PERSONAL_FILES, FAMILY_FILES } from './wing-drag-harness.mjs';

test.use({ ...devices['iPhone 15'], browserName: 'webkit' });

let server, base;
test.beforeAll(async () => { ({ server, base } = await startServer()); });
test.afterAll(async () => { await new Promise(r => server.close(r)); });

// touch long-press on card #from, hold `holdMs`, slide onto the top of card #to, lift
async function touchDrag(page, from, to, holdMs = 550, earlyMove = false) {
  await page.evaluate(async ({ from, to, holdMs, earlyMove }) => {
    const cards = Array.from(document.querySelectorAll('.tw-card'));
    const card = cards[from], a = card.getBoundingClientRect(), b = cards[to].getBoundingClientRect();
    const fire = (type, x, y) => card.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      button: type === 'pointermove' ? -1 : 0, clientX: x, clientY: y }));
    const x = a.left + a.width / 2;
    let y = a.top + a.height / 2;
    fire('pointerdown', x, y);
    if (earlyMove) fire('pointermove', x, y - 40);
    await new Promise(r => setTimeout(r, holdMs));
    const ty = b.top + 4, steps = 10;
    for (let i = 1; i <= steps; i++) fire('pointermove', x, y + (ty - y) * i / steps);
    fire('pointerup', x, ty);
  }, { from, to, holdMs, earlyMove });
}

const SCOPES = [
  { name: 'public', url: '/', key: 'order', files: PUBLIC_FILES, opts: {} },
  { name: 'private', url: '/?view=personal', key: 'orderPersonal', files: PERSONAL_FILES, opts: { vault: true } },
  { name: 'family', url: '/?view=family', key: 'orderFamily', files: FAMILY_FILES, opts: { family: true } },
];

for (const s of SCOPES) {
  test(`iPhone 15 (WebKit) ${s.name}: touch long-press drag reorders and persists`, async ({ page, context, browserName }) => {
    expect(browserName).toBe('webkit');
    expect(await page.evaluate(() => navigator.vendor), 'real WebKit engine').toBe('Apple Computer, Inc.');
    const st = await harness(context, s.opts);
    await page.goto(base + s.url);
    await expect(page.locator('.tw-card')).toHaveCount(s.files.length);
    const before = await order(page);
    const last = before.length - 1;
    await touchDrag(page, last, 0);
    const want = [before[last], ...before.slice(0, last)];
    await expect.poll(() => order(page)).toEqual(want);
    await expect.poll(() => st.portal && st.portal[s.key]).toEqual(want);
    await reloadFromCloud(page);
    await expect(page.locator('.tw-card')).toHaveCount(s.files.length);
    expect(await order(page)).toEqual(want);
    if (s.name === 'family') await page.screenshot({ path: join(ROOT, 'docs', 'evidence', 'wing-drag-family-iphone15.png'), fullPage: true });
  });
}

test('iPhone 15 (WebKit) private: a touch that moves before the hold scrolls — no reorder', async ({ page, context }) => {
  const st = await harness(context, { vault: true });
  await page.goto(base + '/?view=personal');
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);
  const before = await order(page);
  await touchDrag(page, 2, 0, 550, true);
  expect(await order(page)).toEqual(before);
  expect(st.posts.length).toBe(0);
});
