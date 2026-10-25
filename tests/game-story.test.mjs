import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTask } from 'node:timers/promises';
import { createState, STORAGE_KEY } from '../js/state.js';
import { STORY } from '../js/story.js';
import { ENDINGS } from '../js/levels.js';

// This deliberately small DOM exercises the real controller, state, player and
// world modules when browsers cannot launch. It is not a visual/browser test.
// Selectors traverse real index.html markup; unknown required selectors fail.
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g,
  entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity]);
const voidTags = new Set(['meta', 'link', 'br', 'input', 'img', 'hr']);
let loadNumber = 0;

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback); this.listeners.set(type, list);
  }
  emit(type, fields = {}) {
    const event = { type, target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }
}

class Element extends Events {
  constructor(tag, owner) {
    super(); this.tagName = tag; this.owner = owner; this.children = [];
    this.attributes = {}; this.dataset = {}; this.style = {}; this.disabled = false;
    this._open = false; this._text = ''; this.width = 960; this.height = 600;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force = !classes.has(name)) { force ? classes.add(name) : classes.delete(name); return force; },
      toString: () => [...classes].join(' '),
      clear: () => classes.clear(),
    };
  }
  set className(value) { this.classList.clear(); this.classList.add(...value.split(/\s+/).filter(Boolean)); }
  get className() { return this.classList.toString(); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this._text = ''; this.children = []; parse(String(value), this); }
  get innerHTML() { return this.textContent; }
  set open(value) {
    const changed = this._open !== !!value; this._open = !!value;
    if (changed && this.tagName === 'details') setImmediate(() => this.emit('toggle'));
  }
  get open() { return this._open; }
  get firstElementChild() { return this.children[0]; }
  append(child) { child.parentElement = this; this.children.push(child); }
  replaceChildren(...children) { this.children = []; this._text = ''; children.forEach(child => this.append(child)); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = value;
    if (name === 'class') this.className = value;
    if (name === 'disabled') this.disabled = true;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  querySelectorAll(selector) { return query(this, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  click() { if (!this.disabled) this.emit('click'); }
  focus() { this.owner.activeElement = this; }
  scrollIntoView() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 600 }; }
  showModal() { assert.equal(this.tagName, 'dialog'); this.open = true; }
  close() {
    if (!this.open) return;
    this.open = false;
    // Native dialog close is queued, not emitted synchronously by close().
    setImmediate(() => this.emit('close'));
  }
  getContext() {
    return new Proxy({ createRadialGradient: () => ({ addColorStop() {} }) }, {
      get(target, key) { return key in target ? target[key] : () => {}; },
    });
  }
}

function parse(html, root) {
  const stack = [root];
  for (const token of html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    if (token.startsWith('<')) {
      const match = token.match(/^<([\w-]+)/);
      if (!match) continue;
      const element = new Element(match[1], root.owner);
      const attrs = token.slice(match[0].length, -1);
      for (const attr of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        element.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
      }
      stack.at(-1).append(element);
      if (!voidTags.has(element.tagName) && !token.endsWith('/>')) stack.push(element);
    } else stack.at(-1)._text += decode(token);
  }
}

function matches(element, selector) {
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  if (selector.startsWith('[')) return element.getAttribute(selector.slice(1, -1)) !== null;
  return element.tagName === selector;
}

function query(root, selector) {
  assert.match(selector, /^(?:[.#]?[\w-]+|\[[\w-]+\])(?: (?:[.#]?[\w-]+|\[[\w-]+\]))*$/, `unsupported selector: ${selector}`);
  let roots = [root];
  for (const part of selector.split(' ')) {
    const found = [];
    const walk = element => { for (const child of element.children) { if (matches(child, part)) found.push(child); walk(child); } };
    roots.forEach(walk); roots = found;
  }
  return roots;
}

async function boot(t, store = new Map(), debugMode = true) {
  const doc = new Events();
  const root = new Element('document', doc);
  parse(await readFile(new URL('../index.html', import.meta.url), 'utf8'), root);
  doc.hidden = false;
  doc.querySelectorAll = selector => query(root, selector);
  const optional = new Set(['#btn-wait-market', '#btn-site-archive', '#btn-review-ending', '#tab-scene span']);
  doc.querySelector = selector => {
    const result = query(root, selector)[0];
    assert.ok(result || optional.has(selector), `missing DOM selector: ${selector}`);
    return result ?? null;
  };
  doc.createElement = tag => new Element(tag, doc);
  const win = new Events();
  const original = new Map();
  let frame;
  for (const [key, value] of Object.entries({
    document: doc, window: win, location: { search: debugMode ? '?debug=1' : '' },
    localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) },
    matchMedia: () => ({ matches: false }), ResizeObserver: class { observe() {} },
    requestAnimationFrame: callback => { frame = callback; },
    setTimeout: () => 0,
  })) { original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  let disposed = false;
  async function dispose() {
    if (disposed) return;
    await settle(); disposed = true;
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
  t.after(dispose);
  await import(`../js/game.js?dom-test=${++loadNumber}`);
  const $ = selector => doc.querySelector(selector);
  let now = performance.now();
  const app = {
    $, doc, store, dispose, debug: win.__maintainer,
    async click(selector) { $(selector).click(); await settle(); },
    async key(code, type = 'keydown') {
      const event = doc.emit(type, { code, repeat: false });
      if (code === 'Escape' && type === 'keydown' && !event.defaultPrevented) {
        doc.querySelectorAll('dialog').filter(dialog => dialog.open).at(-1)?.close();
      }
      await settle(); return event;
    },
    tick(count = 1) { for (let i = 0; i < count; i += 1) { now += 50; frame(now); } },
    openDialogs() { return doc.querySelectorAll('dialog').filter(dialog => dialog.open).map(dialog => dialog.id); },
  };
  return app;
}

async function settle() { await nextTask(); await nextTask(); await nextTask(); }

async function complete(app, id, choice = 'fix') {
  assert.equal(app.debug.teleport(id), true);
  if (id === 2) app.debug.setTime(1450);
  await settle();
  await app.key(id % 2 ? 'KeyE' : 'Space');
  assert.equal(app.$('#investigation-dialog').open, true);
  await app.key('KeyL'); await app.key('KeyC');
  await app.key(choice === 'fix' ? 'KeyF' : 'KeyX');
  assert.equal(app.debug.getState().choices[id], choice);
  await app.click('#btn-result-continue');
}

test('real controller delivers all four scenes, optional archives and ending in order', async t => {
  const app = await boot(t);
  await app.click('#btn-start');
  assert.deepEqual(app.openDialogs(), ['story-dialog']);
  assert.equal(app.$('#story-title').textContent, STORY[0].title);
  assert.equal((await app.key('ArrowDown')).defaultPrevented, false, 'reading keeps native keyboard scrolling');
  assert.equal((await app.key('Space')).defaultPrevented, false, 'dialog controls keep native space activation');
  const time = app.debug.getState().time;
  app.tick(2);
  assert.equal(app.debug.getState().time, time, 'reading pauses the clock');
  await app.key('Escape');
  assert.equal(app.debug.getState().storyFlags.intro, true);
  assert.equal(app.debug.getState().readComms['story:intro'], undefined);
  await app.key('KeyJ');
  await app.click('#journal-tab-comms');
  assert.equal(app.$('#journal-comms').classList.contains('hidden'), false);
  assert.deepEqual(app.debug.getState().readComms, {}, 'opening the list does not read its entries');
  const intro = app.doc.querySelectorAll('[data-comm]').find(entry => entry.dataset.comm === 'story:intro');
  intro.open = true; await settle();
  assert.equal(app.debug.getState().readComms['story:intro'], true);
  await app.key('Escape');
  for (let id = 1; id <= 6; id += 1) {
    await complete(app, id, id % 2 ? 'fix' : 'exploit');
    if (id % 2 === 0) {
      const event = STORY.find(event => event.at === id);
      assert.deepEqual(app.openDialogs(), ['story-dialog']);
      assert.equal(app.$('#story-title').textContent, event.title);
      assert.equal(app.$('#story-body').textContent, event.body);
      assert.equal(app.$('#ending-dialog').open, false, 'the final reckoning precedes the ending');
      await app.click('#btn-story-continue');
      assert.equal(app.debug.getState().readComms[`story:${event.id}`], true);
    }
  }
  assert.deepEqual(app.openDialogs(), ['ending-dialog']);
  assert.equal(app.$('#ending-title').textContent, ENDINGS.mixed.title);
  assert.equal(app.$('#ending-body').textContent, ENDINGS.mixed.body);
  assert.equal(app.debug.getState().endingSeen, true);
  await app.click('#btn-ending-walk');
  await app.key('KeyJ');
  assert.ok(app.doc.querySelectorAll('[data-comm]').some(entry => entry.dataset.comm === 'archive:6:0'));
  assert.equal(app.debug.getState().readComms['archive:6:0'], undefined);
  await app.key('Escape');
  const saved = app.store;
  await app.dispose();
  const restored = await boot(t, saved);
  await restored.click('#btn-continue');
  assert.deepEqual(restored.openDialogs(), [], 'acknowledged scenes and ending do not repeat after reload');
  assert.equal(restored.debug.getState().choices[6], 'exploit');
  await restored.key('KeyJ'); await restored.click('#btn-review-ending');
  assert.equal(restored.$('#ending-body').textContent, ENDINGS.mixed.body);
});

test('debug reset/finish survives delayed close events and all three ending texts are selectable', async t => {
  const app = await boot(t);
  for (const key of ['allFix', 'allExploit', 'mixed']) {
    app.debug.finish(key); await settle();
    assert.deepEqual(app.openDialogs(), ['ending-dialog']);
    assert.equal(app.$('#ending-title').textContent, ENDINGS[key].title);
    assert.equal(app.$('#ending-body').textContent, ENDINGS[key].body);
    if (key === 'allFix') {
      await app.click('#btn-ending-walk');
      await app.key('KeyT');
      assert.match(app.$('#toasts').children.at(-1).textContent, /夜市已按完整日期结束/,
        'resting after a repair must not claim the discount is still active');
    }
  }
  app.debug.reset(); await settle();
  assert.deepEqual(app.openDialogs(), ['story-dialog']);
  assert.equal(app.$('#story-title').textContent, STORY[0].title);
  assert.deepEqual(app.debug.getState().choices, {});
  await app.key('Escape');
  await app.key('KeyD'); app.tick(3); await app.key('KeyD', 'keyup');
  assert.ok(app.debug.getPlayer().x > 360, 'WASD still reaches the real player');
  await app.key('KeyM'); assert.equal(app.$('#map-dialog').open, true);
  await app.key('Escape');
  await app.key('KeyJ'); assert.equal(app.$('#journal-dialog').open, true);
  await app.key('Escape');
  const before = app.debug.getPlayer().x;
  await app.key('ShiftLeft'); await app.key('KeyD'); app.tick(3);
  await app.key('KeyD', 'keyup'); await app.key('ShiftLeft', 'keyup');
  assert.ok(app.debug.getPlayer().x - before > 12, 'Shift still enables a sprint');
  app.$('#world').emit('pointerdown', { clientX: 450, clientY: 300 });
  assert.ok(app.debug.getPlayer().target, 'click-to-walk still creates a real route');
  await app.key('Escape');
  assert.equal(app.debug.getPlayer().target, null);
  const left = app.doc.querySelectorAll('[data-move]').find(button => button.dataset.move === 'ArrowLeft');
  const mobileStart = app.debug.getPlayer().x;
  left.emit('pointerdown', { pointerId: 1 }); app.tick(3); left.emit('pointerup');
  assert.ok(app.debug.getPlayer().x < mobileStart, 'mobile direction buttons still drive movement');
  app.debug.finish('allFix'); await settle();
  await app.click('#btn-title'); await app.click('#btn-new');
  app.$('#small-actions').children.at(-1).click(); await settle();
  assert.deepEqual(app.openDialogs(), ['story-dialog'], 'a delayed confirmation close cannot dismiss the new intro');
  assert.deepEqual(app.debug.getState().choices, {});
});

test('midnight waiting and the optional site archive preserve the unresolved investigation', async t => {
  const app = await boot(t);
  await app.click('#btn-start'); await app.key('Escape');
  await complete(app, 1);
  app.debug.teleport(2); await settle();
  await app.key('KeyE');
  assert.equal(app.$('#tab-logs').disabled, true);
  await app.key('KeyF');
  assert.equal(app.debug.getState().choices[2], undefined);
  await app.click('#btn-wait-market');
  assert.ok(app.debug.getState().time >= 1440);
  await app.key('KeyL'); await app.key('KeyC');
  await app.click('#btn-site-archive');
  assert.deepEqual(app.openDialogs(), ['journal-dialog'], 'the queued investigation close does not replace the reader');
  assert.equal(app.$('#journal-comms').classList.contains('hidden'), false);
  assert.equal(app.debug.getState().readComms['archive:2:0'], true);
  assert.equal(app.debug.getState().choices[2], undefined, 'reading a long archive makes no maintenance choice');
  await app.key('Escape'); await app.key('KeyE'); await app.key('KeyX');
  assert.equal(app.debug.getState().choices[2], 'exploit');
  await app.click('#btn-result-continue');
  assert.equal(app.$('#story-title').textContent, STORY.find(event => event.id === 'contact').title);
});

test('a completed version 1 save retains its ending and can replay every new story', async t => {
  const old = { ...createState(), version: 1, time: 1450, choices: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 'fix'])), endingSeen: true };
  delete old.storyFlags; delete old.readComms; delete old.npcVisits;
  const app = await boot(t, new Map([[STORAGE_KEY, JSON.stringify(old)]]));
  await app.click('#btn-continue');
  for (const event of STORY) {
    assert.deepEqual(app.openDialogs(), ['story-dialog']);
    assert.equal(app.$('#story-title').textContent, event.title);
    await app.key('Escape');
  }
  assert.deepEqual(app.openDialogs(), []);
  assert.equal(app.debug.getState().version, 2);
  assert.equal(app.debug.getState().endingSeen, true);
  await app.key('KeyJ'); await app.click('#btn-review-ending');
  assert.equal(app.$('#ending-body').textContent, ENDINGS.allFix.body);
});

test('ordinary static entry starts without exposing debug helpers', async t => {
  const app = await boot(t, new Map(), false);
  assert.equal(app.debug, undefined);
  await app.key('Enter');
  assert.deepEqual(app.openDialogs(), ['story-dialog']);
  await app.key('Escape');
  await app.key('KeyJ');
  assert.deepEqual(app.openDialogs(), ['journal-dialog']);
});
