// cardsharp Arc 10 slice 11 — drag-and-drop reorder on the public marquee AND in the private +
// family wings, through ONE code path (wireDrag(root, {scope, archive})). Hermetic (see
// wing-drag-harness.mjs). Proves, for each of the three scopes:
//   • long-press (~400ms) lifts a card; dropping reorders; the order persists across reload —
//     read back from the shared press_portal store with the localStorage mirror wiped;
//   • each scope writes ONLY its own key (order / orderPersonal / orderFamily);
//   • Alt+↑/↓ moves a focused card, announces it politely, and persists;
//   • moving >10px before the hold completes is a scroll/click intent — no reorder;
//   • the wings have NO archive drop target; a legacy {order,archived} row still paints as before.
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { startServer, harness, order, reloadFromCloud, ROOT, PUBLIC_FILES, PERSONAL_FILES, FAMILY_FILES } from './wing-drag-harness.mjs';

let server, base;
test.beforeAll(async () => { ({ server, base } = await startServer()); });
test.afterAll(async () => { await new Promise(r => server.close(r)); });

// long-press card #from, then drag it onto the top half of card #to and drop
async function mouseDrag(page, from, to) {
  const cards = page.locator('.tw-card');
  const a = await cards.nth(from).boundingBox(), b = await cards.nth(to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(550);                       // past HOLD_MS (400)
  await expect(page.locator('.tw-drag-ghost')).toHaveCount(1);
  await expect(page.locator('.tw-card.dragging')).toHaveCount(1);   // dashed placeholder
  await page.mouse.move(b.x + b.width / 2, b.y + 4, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.tw-drag-ghost')).toHaveCount(0);
}

const SCOPES = [
  { name: 'public', url: '/', key: 'order', files: PUBLIC_FILES, opts: {} },
  { name: 'private', url: '/?view=personal', key: 'orderPersonal', files: PERSONAL_FILES, opts: { vault: true } },
  { name: 'family', url: '/?view=family', key: 'orderFamily', files: FAMILY_FILES, opts: { family: true } },
];
const OTHER_KEYS = ['order', 'orderPersonal', 'orderFamily'];

for (const s of SCOPES) {
  test(`${s.name}: long-press drag reorders and persists across reload (shared store)`, async ({ page, context }) => {
    const st = await harness(context, s.opts);
    await page.goto(base + s.url);
    await expect(page.locator('.tw-card')).toHaveCount(s.files.length);
    const before = await order(page);
    expect([...before].sort()).toEqual([...s.files].sort());
    const last = before.length - 1;
    await mouseDrag(page, last, 0);
    const want = [before[last], ...before.slice(0, last)];
    await expect.poll(() => order(page)).toEqual(want);
    // the drop did not navigate (the long-press suppresses the click)
    expect(new URL(page.url()).pathname).toBe('/');
    await expect.poll(() => st.portal && st.portal[s.key]).toEqual(want);
    for (const k of OTHER_KEYS.filter(k => k !== s.key)) expect(st.portal[k] || []).toEqual([]);   // only its own key
    expect(st.portal.archived).toEqual([]);
    await reloadFromCloud(page);
    await expect(page.locator('.tw-card')).toHaveCount(s.files.length);
    expect(await order(page)).toEqual(want);
    if (s.name !== 'public') await expect(page.locator('#archTarget')).toHaveCount(0);   // wings: no archive
    if (s.name === 'private') await page.screenshot({ path: join(ROOT, 'docs', 'evidence', 'wing-drag-private-reordered.png'), fullPage: true });
  });

  test(`${s.name}: Alt+↓ / Alt+↑ keyboard reorder announces and persists`, async ({ page, context }) => {
    const st = await harness(context, s.opts);
    await page.goto(base + s.url);
    await expect(page.locator('.tw-card')).toHaveCount(s.files.length);
    const before = await order(page);
    await page.locator('.tw-card').first().focus();
    await page.keyboard.press('Alt+ArrowDown');
    const want = [before[1], before[0], ...before.slice(2)];
    expect(await order(page)).toEqual(want);
    await expect(page.locator('#twLive')).toHaveText(/moved to position 2 of \d/);
    // focus stays on the moved card, so a second press keeps moving it
    expect(await page.evaluate(() => document.activeElement && document.activeElement.dataset.file)).toBe(before[0]);
    await page.keyboard.press('Alt+ArrowUp');
    expect(await order(page)).toEqual(before);
    await page.keyboard.press('Alt+ArrowUp');                               // already first
    await expect(page.locator('#twLive')).toHaveText(/already first/);
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => st.portal && st.portal[s.key]).toEqual(want);
    await reloadFromCloud(page);
    await expect(page.locator('.tw-card')).toHaveCount(s.files.length);
    expect(await order(page)).toEqual(want);
  });
}

test('private: moving >10px before the hold is a scroll intent — no lift, no reorder, no write', async ({ page, context }) => {
  const st = await harness(context, { vault: true });
  await page.goto(base + '/?view=personal');
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);
  const before = await order(page);
  const a = await page.locator('.tw-card').nth(2).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y - 80, { steps: 4 });     // moved early
  await page.waitForTimeout(550);
  await expect(page.locator('.tw-drag-ghost')).toHaveCount(0);
  await page.mouse.move(a.x + a.width / 2, a.y - 200, { steps: 4 });
  await page.evaluate(() => document.addEventListener('click', e => e.preventDefault(), { capture: true, once: true }));
  await page.mouse.up();
  expect(await order(page)).toEqual(before);
  expect(st.posts.length).toBe(0);
});

test('legacy {order, archived} row: public paint unchanged; a wing write keeps both keys intact', async ({ page, context }) => {
  const legacy = { order: ['kayley.html', 'council-guide.html'], archived: ['halvsies.html'] };
  const st = await harness(context, { portal: legacy, vault: true });
  await page.goto(base + '/');
  await expect(page.locator('.tw-card')).toHaveCount(2);
  expect(await order(page)).toEqual(['kayley.html', 'council-guide.html']);    // archived stays hidden
  await expect(page.locator('#archTarget .ct')).toHaveText('→ 1');
  await page.goto(base + '/?view=personal');
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);
  await page.locator('.tw-card').first().focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => st.posts.length).toBe(1);
  expect(st.portal.order).toEqual(legacy.order);
  expect(st.portal.archived).toEqual(legacy.archived);
  expect(st.portal.orderPersonal.length).toBe(PERSONAL_FILES.length);
});

test('a wing order never adds or drops a page — stale/foreign entries are ignored', async ({ page, context }) => {
  // the stored list names a public page and a removed page; the wing still shows exactly spaces.json's set
  const portal = { order: [], archived: [], orderPersonal: ['retirement.html', 'kayley.html', 'gone.html'] };
  await harness(context, { portal, vault: true });
  await page.goto(base + '/?view=personal');
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);
  expect(await order(page)).toEqual(['retirement.html', ...PERSONAL_FILES.filter(f => f !== 'retirement.html')]);
});
