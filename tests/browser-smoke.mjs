import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Test-only dependency: the shipped game remains dependency-free.
const requestedModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
const playwrightModule = requestedModule.startsWith('/')
  ? pathToFileURL(requestedModule).href : requestedModule;
const { chromium } = await import(playwrightModule);
const baseURL = process.env.GAME_URL || 'http://127.0.0.1:8765/';
const artifacts = resolve(process.env.QA_ARTIFACTS || '/tmp/last-maintainer-qa-artifacts');
await mkdir(artifacts, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
page.on('console', message => {
  if (message.type() === 'error') errors.push({ type: 'console', message: message.text() });
});
page.on('requestfailed', request => errors.push({
  type: 'requestfailed', url: request.url(), message: request.failure()?.errorText,
}));

async function check(name, action) {
  const started = Date.now();
  await action();
  const result = { name, status: 'passed', milliseconds: Date.now() - started };
  checks.push(result);
  console.log(`PASS ${name}`);
}

async function screenshot(name) {
  await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: true });
}

const state = () => page.evaluate(() => window.__maintainer.getState());
const player = () => page.evaluate(() => window.__maintainer.getPlayer());
const isOpen = id => page.locator(`#${id}`).evaluate(element => element.open);

async function clickMap(point) {
  await page.keyboard.press('m');
  await page.locator('#map-dialog').waitFor({ state: 'visible' });
  const bounds = await page.locator('#large-map').boundingBox();
  await page.mouse.click(bounds.x + point.x / 1728 * bounds.width,
    bounds.y + point.y / 1152 * bounds.height);
}

async function waitForArrival(point, range = 95) {
  await page.waitForFunction(({ point, range }) => {
    const position = window.__maintainer.getPlayer();
    return Math.hypot(position.x - point.x, position.y - point.y) <= range;
  }, { point, range }, { timeout: 20000 });
}

async function investigate(site) {
  await clickMap(site.terminal);
  await waitForArrival(site.terminal);
  // The terminal click may already have opened it; a nearby E is the alternate UI path.
  await page.waitForTimeout(250);
  if (!await isOpen('investigation-dialog')) await page.keyboard.press('e');
  await page.locator('#investigation-dialog').waitFor({ state: 'visible' });
}

async function decide(id, choice) {
  assert.equal(await page.locator('#btn-fix').isDisabled(), true);
  assert.equal(await page.locator('#btn-exploit').isDisabled(), true);
  await page.locator('#tab-logs').click();
  assert.equal(await page.locator('#btn-fix').isDisabled(), true);
  assert.ok((await page.locator('#investigation-content').innerText()).length > 80);
  await page.locator('#tab-config').click();
  assert.ok((await page.locator('#investigation-content').innerText()).length > 80);
  assert.equal(await page.locator(`#btn-${choice}`).isEnabled(), true);
  await page.locator(`#btn-${choice}`).click();
  assert.equal((await state()).choices[id], choice);
  assert.equal((await state()).discovered[id], true);
  assert.deepEqual((await state()).inspected[id], { logs: true, config: true });
  await page.locator('#btn-result-continue').click();
}

try {
  await check('normal URL keeps debug API disabled', async () => {
    await page.goto(baseURL);
    await page.locator('#btn-start').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => typeof window.__maintainer), 'undefined');
    await screenshot('title');
  });

  const debugURL = new URL(baseURL);
  debugURL.searchParams.set('debug', '1');
  await page.goto(debugURL.href);
  await page.locator('#btn-start').click();
  await page.waitForFunction(() => Boolean(window.__maintainer));
  const sites = await page.evaluate(async () => (await import('./js/world.js')).SITES);
  assert.equal(sites.length, 6);
  await screenshot('town-initial');

  await check('keyboard walking and sprint change actual world position', async () => {
    const start = await player();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(450);
    await page.keyboard.up('ArrowRight');
    const walk = await player();
    assert.ok(walk.x - start.x > 20, 'keyboard should physically move the player');
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(450);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('Shift');
    const sprint = await player();
    assert.ok(walk.x - sprint.x > (walk.x - start.x) * 1.25, 'sprint should be faster');
  });

  await check('map pauses the clock and locked regions reject routes', async () => {
    await page.keyboard.press('m');
    await page.locator('#map-dialog').waitFor({ state: 'visible' });
    const time = (await state()).time;
    await page.waitForTimeout(400);
    assert.equal((await state()).time, time);
    await page.keyboard.press('Escape');
    await clickMap(sites[2].terminal);
    await page.waitForTimeout(400);
    if (await isOpen('map-dialog')) await page.keyboard.press('Escape');
    assert.ok((await player()).x < 558, 'locked bridge must not be crossed');
    assert.equal(Boolean((await state()).discovered[3]), false);
  });

  await check('solid building stops actual keyboard movement', async () => {
    const approach = { x: 290, y: 390 };
    await clickMap(approach);
    await waitForArrival(approach, 12);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(1100);
    await page.keyboard.up('ArrowUp');
    const position = await player();
    assert.ok(position.y >= 356 && position.y <= 365, `building boundary: y=${position.y}`);
    assert.ok(Math.abs(position.x - approach.x) < 12);
  });

  await check('clicking a scene terminal walks there before opening investigation', async () => {
    const point = sites[0].terminal;
    const camera = await page.evaluate(() => window.__maintainer.getCamera());
    const bounds = await page.locator('#world').boundingBox();
    const canvasSize = await page.locator('#world').evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
    const before = await player();
    await page.mouse.click(bounds.x + (point.x - camera.x) / canvasSize.width * bounds.width,
      bounds.y + (point.y - camera.y) / canvasSize.height * bounds.height);
    await page.locator('#investigation-dialog').waitFor({ state: 'visible' });
    const after = await player();
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 20);
    assert.ok(Math.hypot(after.x - point.x, after.y - point.y) <= 95);
    await screenshot('investigation');
    await decide(1, 'fix');
    await screenshot('town-after-first');
  });

  await check('save reload and continue preserve decision and position', async () => {
    const before = await state();
    await page.reload();
    await page.locator('#btn-continue').click();
    const restored = await state();
    assert.deepEqual(restored.choices, before.choices);
    assert.deepEqual(restored.inspected, before.inspected);
    assert.ok(Math.hypot(restored.player.x - before.player.x, restored.player.y - before.player.y) < 10);
  });

  await check('midnight market requires time and its wait action advances naturally', async () => {
    await investigate(sites[1]);
    assert.ok((await state()).time < 1440);
    assert.equal(await page.locator('#btn-fix').isDisabled(), true);
    await page.locator('#btn-wait-market').click();
    await page.waitForFunction(() => window.__maintainer.getState().time >= 1450);
    if (!await isOpen('investigation-dialog')) await investigate(sites[1]);
    await decide(2, 'exploit');
  });

  for (const site of sites.slice(2)) {
    await check(`walk to site ${site.id}, read both evidence sources, and decide`, async () => {
      const before = await player();
      await investigate(site);
      const after = await player();
      assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 200);
      await decide(site.id, site.id % 2 ? 'fix' : 'exploit');
    });
  }

  let mixedTitle;
  await check('six walked investigations produce the mixed ending', async () => {
    await page.locator('#ending-dialog').waitFor({ state: 'visible' });
    mixedTitle = await page.locator('#ending-title').innerText();
    const result = await state();
    assert.equal(Object.keys(result.choices).length, 6);
    assert.equal(Object.values(result.choices).filter(choice => choice === 'fix').length, 3);
    assert.ok((await page.locator('#ending-body').innerText()).length > 40);
    await screenshot('mixed-ending');
    await page.locator('#btn-ending-walk').click();
    await page.keyboard.press('j');
    await page.locator('#journal-dialog').waitFor({ state: 'visible' });
    const journal = await page.locator('#journal-list').innerText();
    assert.ok(journal.includes('负金币') && journal.includes('连体'));
    await page.keyboard.press('Escape');
    await screenshot('town-completed');
  });

  const titles = [mixedTitle];
  for (const choice of ['fix', 'exploit']) {
    await check(`all-${choice} ending through all six UI decisions`, async () => {
      await page.evaluate(() => { window.__maintainer.reset(); window.__maintainer.setTime(1450); });
      for (const site of sites) {
        await page.evaluate(id => window.__maintainer.teleport(id), site.id);
        await page.keyboard.press('e');
        await page.locator('#investigation-dialog').waitFor({ state: 'visible' });
        await decide(site.id, choice);
      }
      await page.locator('#ending-dialog').waitFor({ state: 'visible' });
      titles.push(await page.locator('#ending-title').innerText());
      assert.ok(Object.values((await state()).choices).every(value => value === choice));
      await screenshot(`${choice}-ending`);
      await page.locator('#btn-ending-walk').click();
      for (const site of sites) {
        await page.evaluate(id => window.__maintainer.teleport(id), site.id);
        await page.waitForTimeout(100);
        const canvasImage = await page.locator('#world').evaluate(canvas => canvas.toDataURL('image/png'));
        await writeFile(resolve(artifacts, `site-${site.id}-${choice}.png`), Buffer.from(canvasImage.split(',')[1], 'base64'));
      }
      await page.keyboard.press('j');
      await page.locator('#btn-review-ending').click();
    });
  }
  assert.equal(new Set(titles).size, 3, 'ending titles must distinguish all three outcomes');

  await check('resting at the actual bench advances to the next midnight', async () => {
    await page.locator('#btn-ending-walk').click();
    await page.evaluate(() => window.__maintainer.teleport(1));
    const approach = { x: 260, y: 610 };
    await clickMap(approach);
    await waitForArrival(approach, 12);
    await page.locator('#btn-rest').waitFor({ state: 'visible' });
    const before = (await state()).time;
    await page.locator('#btn-rest').click();
    await page.locator('#small-dialog').getByRole('button', { name: '等到 00:10', exact: true }).click();
    assert.ok((await state()).time >= (Math.floor(before / 1440) + 1) * 1440 + 10);
    await page.keyboard.press('j');
    await page.locator('#btn-review-ending').click();
  });

  await check('completed save reload keeps ending and responsive layout remains usable', async () => {
    await page.locator('#btn-title').click();
    await page.reload();
    await page.locator('#btn-continue').click();
    assert.equal(Object.keys((await state()).choices).length, 6);
    if (await isOpen('ending-dialog')) await page.locator('#btn-ending-walk').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.locator('#btn-map').click();
    assert.equal(await isOpen('map-dialog'), true);
    await screenshot('mobile-map');
    await page.keyboard.press('Escape');
    await screenshot('mobile-town');
  });

  await check('new-game confirmation can keep the old save or replace it', async () => {
    await page.keyboard.press('j');
    await page.locator('#btn-review-ending').click();
    await page.locator('#btn-title').click();
    await page.locator('#btn-new').click();
    await page.locator('#small-dialog').getByRole('button', { name: '保留旧记录', exact: true }).click();
    assert.equal(Object.keys((await state()).choices).length, 6);
    await page.locator('#btn-new').click();
    await page.locator('#small-dialog').getByRole('button', { name: '开始新的一局', exact: true }).click();
    assert.deepEqual((await state()).choices, {});
    assert.ok((await state()).time < 1100);
  });

  await check('browser reports no script, console, or failed request errors', async () => {
    assert.deepEqual(errors, []);
  });
} catch (error) {
  checks.push({ name: 'active test', status: 'failed', message: error.message, stack: error.stack });
  const snapshot = await page.evaluate(() => window.__maintainer ? {
    state: window.__maintainer.getState(), player: window.__maintainer.getPlayer(),
    camera: window.__maintainer.getCamera(),
  } : null).catch(() => null);
  await writeFile(resolve(artifacts, 'failure-state.json'), JSON.stringify(snapshot, null, 2));
  await screenshot('failure').catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(artifacts, 'report.json'), JSON.stringify({
    url: baseURL, browser: browser.version(), checks, errors,
  }, null, 2));
  await browser.close();
}
