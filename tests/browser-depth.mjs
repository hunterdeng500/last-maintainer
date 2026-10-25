import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
const artifacts = resolve(process.env.QA_ARTIFACTS || '/tmp/last-maintainer-25d-depth');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765/');
  await page.locator('#btn-start').click();
  await page.locator('#btn-story-skip').click();
  const results = await page.evaluate(async () => {
    const { WorldRenderer, SITES } = await import('./js/world.js');
    const { Player } = await import('./js/player.js');
    const { createState } = await import('./js/state.js');
    const surface = document.createElement('canvas');
    surface.style.cssText = 'position:fixed;left:17px;top:19px;width:840px;height:600px;pointer-events:none;opacity:0';
    document.body.append(surface);
    const renderer = new WorldRenderer(surface);
    renderer.resize(840, 600);
    const state = createState(); state.time = 780;
    state.choices = Object.fromEntries(SITES.map(site => [site.id, 'fix']));
    const actor = new Player({ x: 290, y: 265 });
    const order = [], draw = renderer.ctx.drawImage.bind(renderer.ctx), drawPlayer = renderer.drawPlayer.bind(renderer);
    renderer.ctx.drawImage = (...args) => { if (args[0] === renderer.buildings[0].canvas) order.push('building'); return draw(...args); };
    renderer.drawPlayer = (...args) => { order.push('player'); return drawPlayer(...args); };
    const shadow = renderer.groundShadow.bind(renderer);
    renderer.groundShadow = (...args) => { order.push('shadow'); return shadow(...args); };
    renderer.render(state, actor, 0);
    const behind = order.indexOf('player') < order.indexOf('building');
    const groundPass = order.lastIndexOf('shadow') < order.indexOf('player');
    order.length = 0; actor.y = 363; renderer.render(state, actor, 16);
    const front = order.indexOf('building') < order.indexOf('player');
    actor.x = 850; actor.y = 590; renderer.render(state, actor, 32);
    const initial = renderer.getCamera(); actor.x += 40; actor.velocityX = 105;
    renderer.render(state, actor, 48);
    const first = renderer.getCamera();
    for (let frame = 0; frame < 60; frame++) renderer.render(state, actor, 64 + frame * 16.6667);
    const settled = renderer.getCamera();
    const bounds = surface.getBoundingClientRect();
    const point = renderer.screenToWorld(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    const mapped = Math.abs(point.x - settled.x - 420) < .001 && Math.abs(point.y - settled.y - 300) < .001;
    renderer.ctx.drawImage = draw; renderer.drawPlayer = drawPlayer; renderer.groundShadow = shadow;
    renderer.reducedMotion = true; actor.velocityX = 0; actor.x = 970; actor.y = 451;
    for (let frame = 0; frame < 90; frame++) renderer.render(state, actor, 2000 + frame * 16.6667);
    renderer.render(state, actor, 4000);
    const motionA = surface.toDataURL(); renderer.render(state, actor, 6000);
    const reducedMotion = motionA === surface.toDataURL();
    // Camera is allowed to settle before capturing each day's finished diorama.
    const pictures = [];
    for (const site of SITES) {
      actor.x = site.terminal.x; actor.y = site.terminal.y + 35;
      for (let frame = 0; frame < 90; frame++) renderer.render(state, actor, 6100 + site.id * 2000 + frame * 16.6667);
      pictures.push({ name: `day-site-${site.id}`, data: surface.toDataURL() });
    }
    state.time = 1440; renderer.render(state, actor, 20000);
    pictures.push({ name: 'night-east-bank', data: surface.toDataURL() });
    const samples = [];
    renderer.reducedMotion = false;
    for (let frame = 0; frame < 180; frame++) {
      const start = performance.now(); renderer.render(state, actor, 21000 + frame * 16.6667);
      if (frame > 20) samples.push(performance.now() - start);
    }
    samples.sort((a,b) => a-b);
    surface.remove();
    return { behind, front, groundPass, mapped, reducedMotion,
      camera: { initial: initial.x, first: first.x, settled: settled.x },
      rendering: { medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)] }, pictures };
  });
  assert.equal(results.behind, true, 'north-side actor must render behind the roof');
  assert.equal(results.front, true, 'south-side actor must render in front of the facade');
  assert.equal(results.groundPass, true, 'shadows must stay below actors');
  assert.equal(results.mapped, true, 'click mapping must match the painted camera');
  assert.ok(results.camera.first > results.camera.initial && results.camera.first < results.camera.settled,
    'following should advance smoothly rather than snap to the new focus');
  assert.equal(results.reducedMotion, true, 'reduced motion keeps a stationary scene still');
  for (const picture of results.pictures) await writeFile(resolve(artifacts, `${picture.name}.png`), Buffer.from(picture.data.split(',')[1], 'base64'));
  delete results.pictures;
  results.animationFrames = await page.evaluate(() => new Promise(resolve => {
    const samples = []; let previous = null;
    const measure = now => {
      if (previous !== null) samples.push(now - previous);
      previous = now;
      if (samples.length < 120) requestAnimationFrame(measure);
      else {
        samples.sort((a,b) => a-b);
        resolve({ medianMs: samples[60], p95Ms: samples[114], estimatedFps: 1000 / samples[60] });
      }
    };
    requestAnimationFrame(measure);
  }));
  await page.screenshot({ path: resolve(artifacts, 'desktop-town.png') });
  const layouts = [];
  for (const [width, height] of [[390,844],[320,568],[568,320]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
    const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      logicalHeight: document.querySelector('#world').height }));
    assert.ok(layout.width <= width && layout.height <= height, 'viewport must not overflow');
    if (height < 400) assert.ok(layout.logicalHeight <= 360, 'landscape phone should keep actors readable');
    layouts.push({ width, height, ...layout });
    await page.screenshot({ path: resolve(artifacts, `town-${width}x${height}.png`) });
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(artifacts, 'report.json'), JSON.stringify({ ...results, layouts, errors }, null, 2));
  console.log('PASS facade occlusion, shadow order, smooth camera, click coordinates, reduced motion, six dioramas, narrow layouts');
  console.log(JSON.stringify(results.rendering));
  console.log(JSON.stringify(results.animationFrames));
} finally { await browser.close(); }
