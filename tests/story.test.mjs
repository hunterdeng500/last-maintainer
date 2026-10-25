import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../js/levels.js';
import { STORY } from '../js/story.js';
import {
  STORAGE_KEY, createState, choose, getStats, getEnding, saveState, loadState,
  getAvailableStory, getPendingStory, markStorySeen, getAvailableComms,
  markCommRead, recordNpcVisit,
} from '../js/state.js';

function storage(t) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
  };
  t.after(() => { delete globalThis.localStorage; });
}

function investigate(state, id) {
  state.discovered[id] = true;
  state.inspected[id] = { logs: true, config: true };
}

function decide(state, id, choice = 'fix') {
  state.time = Math.max(state.time, 1440);
  investigate(state, id);
  assert.equal(choose(state, id, choice).ok, true);
}

test('story contacts follow district progress without adding maintenance decisions', () => {
  const state = createState();
  assert.deepEqual(STORY.map(event => [event.id, event.at]), [
    ['intro', 0], ['contact', 2], ['stopping', 4], ['reckoning', 6],
  ]);
  assert.equal(getPendingStory(state).id, 'intro');
  assert.equal(markStorySeen(state, 'contact'), false);
  assert.equal(markStorySeen(state, '__proto__'), false);
  assert.equal(markStorySeen(state, 'intro'), true);
  assert.equal(getPendingStory(state), null);
  decide(state, 1);
  assert.equal(getPendingStory(state), null);
  decide(state, 2, 'exploit');
  assert.equal(getPendingStory(state).id, 'contact');
  markStorySeen(state, 'contact');
  decide(state, 3);
  decide(state, 4);
  assert.equal(getPendingStory(state).id, 'stopping');
  markStorySeen(state, 'stopping');
  decide(state, 5);
  decide(state, 6, 'exploit');
  assert.equal(getPendingStory(state).id, 'reckoning');
  assert.equal(getStats(state).total, 6);
  assert.equal(getEnding(state), 'mixed');
});

test('listing communications does not read them; archives require both on-site evidence tabs', () => {
  const state = createState();
  const firstArchive = 'archive:1:0';
  assert.ok(LEVELS.every(level => Array.isArray(level.archive) && level.archive.length > 0));
  assert.deepEqual(getAvailableComms(state).map(entry => entry.id), ['story:intro']);
  assert.deepEqual(state.readComms, {});
  assert.equal(markCommRead(state, firstArchive), false);
  state.discovered[1] = true;
  state.inspected[1] = { logs: true, config: false };
  assert.equal(markCommRead(state, firstArchive), false);
  state.inspected[1].config = true;
  assert.ok(getAvailableComms(state).some(entry => entry.id === firstArchive));
  assert.equal(markCommRead(state, firstArchive), true);
  assert.equal(markCommRead(state, 'archive:1:999'), false);
  assert.equal(markCommRead(state, 'story:stopping'), false);
  assert.equal(markCommRead(state, '__proto__'), false);
  assert.equal(markCommRead(state, 'story:intro'), true);
  assert.equal(getPendingStory(state).id, 'intro', 'reading an archive does not acknowledge an automatic scene');
  investigate(state, 3);
  assert.equal(markCommRead(state, 'archive:3:0'), false, 'forged investigation cannot bypass district gates');
});

test('acknowledged scenes and individually read archives survive reload', t => {
  storage(t);
  const state = createState();
  markStorySeen(state, 'intro');
  decide(state, 1);
  decide(state, 2);
  markStorySeen(state, 'contact');
  markCommRead(state, 'story:contact');
  markCommRead(state, 'archive:1:0');
  recordNpcVisit(state, 'moss');
  recordNpcVisit(state, 'moss');
  assert.equal(saveState(state), true);
  const restored = loadState();
  assert.deepEqual(restored, state);
  assert.equal(getPendingStory(restored), null);
  assert.equal(restored.readComms['archive:1:0'], true);
  assert.equal(restored.readComms['story:intro'], undefined, 'dismissing a scene need not mark its long transcript read');
  decide(restored, 3);
  decide(restored, 4);
  assert.equal(getPendingStory(restored).id, 'stopping');
});

test('version 1 migration preserves all three endings while leaving new story readable', t => {
  storage(t);
  for (const [choices, expected] of [
    [Array(6).fill('fix'), 'allFix'],
    [Array(6).fill('exploit'), 'allExploit'],
    [['fix', 'exploit', 'fix', 'exploit', 'fix', 'exploit'], 'mixed'],
  ]) {
    const old = createState();
    for (const level of LEVELS) decide(old, level.id, choices[level.id - 1]);
    old.version = 1;
    old.endingSeen = true;
    delete old.storyFlags;
    delete old.readComms;
    delete old.npcVisits;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    const restored = loadState();
    assert.equal(restored.version, 2);
    assert.equal(getEnding(restored), expected);
    assert.equal(restored.endingSeen, true);
    assert.deepEqual(restored.choices, old.choices);
    assert.deepEqual(restored.storyFlags, {});
    assert.deepEqual(restored.readComms, {});
    assert.deepEqual(restored.npcVisits, {});
    assert.equal(getAvailableStory(restored).length, 4);
    assert.equal(getPendingStory(restored).id, 'intro');
    assert.equal(saveState(restored), true);
    assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).version, 2);
  }
});

test('all 64 six-site choice combinations preserve ratio-based endings and final story access', t => {
  storage(t);
  for (let mask = 0; mask < 64; mask += 1) {
    const state = createState();
    let fix = 0;
    for (const level of LEVELS) {
      const choice = mask & (1 << (level.id - 1)) ? 'exploit' : 'fix';
      decide(state, level.id, choice);
      if (choice === 'fix') fix += 1;
    }
    const expected = fix === 6 ? 'allFix' : fix === 0 ? 'allExploit' : 'mixed';
    assert.equal(getEnding(state), expected, `choice mask ${mask}`);
    assert.equal(getAvailableStory(state).length, 4);
    assert.equal(saveState(state), true);
    const restored = loadState();
    assert.equal(getEnding(restored), expected, `reloaded choice mask ${mask}`);
    assert.deepEqual(getStats(restored), { fix, exploit: 6 - fix, total: 6 });
    assert.equal(getAvailableStory(restored).length, 4);
  }
});

test('future or unknown story flags and fabricated read markers cannot skip later scenes', t => {
  storage(t);
  const raw = { ...createState(),
    storyFlags: { intro: true, contact: true, stopping: true, reckoning: true, unknown: true },
    readComms: { 'story:intro': true, 'story:contact': true, 'archive:1:0': true, unknown: true },
    npcVisits: { moss: 1.9, copper: -10, pip: 90001, unknown: 9 },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const restored = loadState();
  assert.deepEqual(restored.storyFlags, { intro: true });
  assert.deepEqual(restored.readComms, { 'story:intro': true });
  assert.deepEqual(restored.npcVisits, { moss: 1, copper: 0, pip: 10000 });
  assert.equal(recordNpcVisit(restored, 'pip'), 10000);
  assert.equal(recordNpcVisit(restored, '__proto__'), 0);
  decide(restored, 1);
  decide(restored, 2);
  assert.equal(getPendingStory(restored).id, 'contact');
  assert.equal(restored.readComms['story:contact'], undefined);
});

test('inherited, prototype-shaped and malformed save fields do not become progress', t => {
  storage(t);
  const state = createState();
  state.choices = Object.create({ 1: 'fix', 2: 'fix' });
  state.storyFlags = Object.create({ intro: true });
  state.readComms = Object.create({ 'story:intro': true });
  state.npcVisits = { moss: NaN, copper: '3', pip: Infinity };
  assert.equal(getStats(state).total, 0);
  assert.equal(getPendingStory(state).id, 'intro');
  assert.equal(saveState(state), true);
  assert.deepEqual(loadState(), createState());
  const poison = JSON.parse('{"__proto__":{"intro":true},"constructor":true,"prototype":true}');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createState(),
    storyFlags: poison, readComms: poison, npcVisits: poison,
  }));
  assert.deepEqual(loadState(), createState());
  for (const malformed of [null, [], true, 'intro']) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createState(),
      storyFlags: malformed, readComms: malformed, npcVisits: malformed,
    }));
    assert.deepEqual(loadState(), createState());
  }
});
