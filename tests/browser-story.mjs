import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
const artifacts = resolve(process.env.QA_ARTIFACTS || '/tmp/last-maintainer-story');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => errors.push(request.url()));
const state = () => page.evaluate(() => window.__maintainer.getState());
const open = id => page.locator(`#${id}`).evaluate(element => element.open);
const snapshot = name => page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: true });
const url = new URL(process.env.GAME_URL || 'http://127.0.0.1:8765/');
url.searchParams.set('debug', '1');

async function milestone(id, read = false) {
  await page.locator('#story-dialog').waitFor({ state: 'visible' });
  assert.equal((await state()).storyFlags[id], true);
  const before = (await state()).time;
  await page.waitForTimeout(160);
  assert.equal((await state()).time, before, 'story must pause the clock');
  assert.ok((await page.locator('#story-body').innerText()).length > 100);
  await snapshot(id);
  await page.locator(read ? '#btn-story-continue' : '#btn-story-skip').click();
  assert.equal((await state()).readComms[`story:${id}`], read ? true : undefined);
  checks.push(`milestone ${id}: pause, persist, ${read ? 'read' : 'skip'}`);
}

async function decide(id, choice) {
  await page.evaluate(id => window.__maintainer.teleport(id), id);
  await page.keyboard.press('e');
  await page.locator('#investigation-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#btn-fix').isDisabled(), true);
  await page.keyboard.press('l');
  await page.keyboard.press('c');
  assert.equal(await page.locator('#btn-fix').isEnabled(), true);
  assert.ok(await page.locator('#btn-site-archive').isVisible());
  await page.keyboard.press(choice === 'fix' ? 'f' : 'x');
  assert.equal((await state()).choices[id], choice);
  assert.ok((await page.locator('#result-box').innerText()).length > 120);
  // Escape must not lose the milestones or skip the ending.
  await page.keyboard.press('Escape');
}

try {
  await page.goto(url.href);
  await page.locator('#btn-start').click();
  await milestone('intro');
  await page.reload();
  await page.locator('#btn-continue').click();
  assert.equal(await open('story-dialog'), false, 'received intro should not repeat');
  await page.keyboard.press('j');
  await page.locator('#journal-tab-comms').click();
  const intro = page.locator('[data-comm="story:intro"]');
  assert.ok((await intro.innerText()).includes('未读'));
  await intro.locator('summary').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__maintainer.getState().readComms['story:intro']);
  await page.keyboard.press('Escape');
  checks.push('intro skip/reload/re-read and keyboard details work');

  await page.evaluate(() => window.__maintainer.setTime(1450));
  await decide(1, 'fix');
  await decide(2, 'exploit');
  await milestone('contact', true);
  await page.reload();
  await page.locator('#btn-continue').click();
  assert.equal(await open('story-dialog'), false);
  assert.equal((await state()).readComms['story:contact'], true);
  await decide(3, 'fix');
  await decide(4, 'exploit');
  await milestone('stopping');
  await decide(5, 'fix');
  await decide(6, 'exploit');
  await milestone('reckoning', true);
  await page.locator('#ending-dialog').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#ending-title').innerText()).includes('未完成'));
  assert.ok((await page.locator('#ending-body').innerText()).length > 350);
  await page.locator('#btn-ending-walk').click();
  await page.keyboard.press('j');
  await page.locator('#journal-tab-comms').click();
  assert.equal(await page.locator('[data-comm]').count(), 16, '4 transmissions + 12 archives');
  const fourth = page.locator('[data-comm="archive:4:0"]');
  await fourth.locator('summary').click();
  await page.waitForFunction(() => window.__maintainer.getState().readComms['archive:4:0']);
  const before = (await state()).time;
  await page.waitForTimeout(200);
  assert.equal((await state()).time, before);
  for (const [width, height] of [[390, 844], [320, 568], [568, 320]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const box = await page.locator('#journal-dialog').boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
    await snapshot(`comms-${width}x${height}`);
  }
  checks.push('all six shortcut decisions; ending order; 16 collected entries; narrow reader layouts');
  await page.keyboard.press('Escape');
  for (const choice of ['fix', 'exploit']) {
    await page.evaluate(choice => window.__maintainer.finish(choice), choice);
    await page.locator('#ending-dialog').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#ending-body').innerText()).length > 350);
    assert.ok(Object.values((await state()).choices).every(value => value === choice));
    await snapshot(`ending-${choice}`);
    await page.locator('#btn-ending-walk').click();
  }

  // Import an actual v1-shaped full save. New story is available without losing decisions.
  const legacyFixture = await page.evaluate(async () => {
    const { STORAGE_KEY } = await import('./js/state.js');
    const legacy = window.__maintainer.getState();
    legacy.version = 1;
    delete legacy.storyFlags; delete legacy.readComms; delete legacy.npcVisits;
    return { key: STORAGE_KEY, value: JSON.stringify(legacy) };
  });
  // Install after the original page loses focus: blur/pagehide intentionally save gameplay.
  const legacyPage = await page.context().newPage();
  await legacyPage.addInitScript(({ key, value }) => localStorage.setItem(key, value), legacyFixture);
  await legacyPage.goto(url.href);
  await legacyPage.locator('#btn-continue').click();
  for (const id of ['intro', 'contact', 'stopping', 'reckoning']) {
    await legacyPage.locator('#story-dialog').waitFor({ state: 'visible' });
    assert.equal(await legacyPage.evaluate(id => window.__maintainer.getState().storyFlags[id], id), true);
    await legacyPage.locator('#btn-story-skip').click();
  }
  assert.equal(await legacyPage.evaluate(() => window.__maintainer.getState().version), 2);
  assert.equal(await legacyPage.evaluate(() => Object.keys(window.__maintainer.getState().choices).length), 6);
  await legacyPage.close();
  checks.push('debug endings and v1 full-save migration');
  assert.deepEqual(errors, []);
  console.log(`PASS ${checks.join('\nPASS ')}`);
} catch (error) {
  await snapshot('failure').catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(artifacts, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
