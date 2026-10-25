import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../js/levels.js';
import {
  STORAGE_KEY, createState, choose, getStats, getEnding, saveState, loadState, clearSave,
} from '../js/state.js';

function investigated(state, id) {
  state.discovered[id] = true;
  state.inspected[id] = { logs: true, config: true };
}

function play(choices) {
  const state = createState();
  state.time = 1450;
  for (const level of LEVELS) {
    investigated(state, level.id);
    assert.equal(choose(state, level.id, choices[level.id - 1]).ok, true);
  }
  return state;
}

test('decisions require visiting, both evidence tabs, and district access', () => {
  const state = createState();
  assert.equal(choose(state, 1, 'fix').ok, false);
  state.discovered[1] = true;
  state.inspected[1] = { logs: true, config: false };
  assert.equal(choose(state, 1, 'fix').ok, false);
  state.inspected[1].config = true;
  assert.equal(choose(state, 1, 'fix').ok, true);
  investigated(state, 3);
  assert.equal(choose(state, 3, 'fix').ok, false);
  investigated(state, 2);
  state.time = 1439.99;
  assert.equal(choose(state, 2, 'fix').ok, false);
  state.time = 1440;
  assert.equal(choose(state, 2, 'fix').ok, true);
  assert.equal(choose(state, 3, 'exploit').ok, true);
  investigated(state, 5);
  assert.equal(choose(state, 5, 'fix').ok, false);
  investigated(state, 4);
  assert.equal(choose(state, 4, 'fix').ok, true);
  assert.equal(choose(state, 5, 'fix').ok, true);
});

test('a decision cannot be repeated, changed, or rewarded twice', () => {
  const state = createState();
  investigated(state, 1);
  assert.equal(choose(state, 1, 'exploit').ok, true);
  const resources = state.resources;
  const stability = state.stability;
  assert.equal(choose(state, 1, 'exploit').ok, false);
  assert.equal(choose(state, 1, 'fix').ok, false);
  assert.equal(choose(state, 99, 'fix').ok, false);
  assert.equal(choose(state, 2, 'other').ok, false);
  assert.equal(state.resources, resources);
  assert.equal(state.stability, stability);
  assert.deepEqual(getStats(state), { fix: 0, exploit: 1, total: 1 });
});

test('all six decisions determine the three distinct endings', () => {
  assert.equal(getEnding(createState()), null);
  assert.equal(getEnding(play(Array(6).fill('fix'))), 'allFix');
  assert.equal(getEnding(play(Array(6).fill('exploit'))), 'allExploit');
  assert.equal(getEnding(play(['fix', 'exploit', 'fix', 'exploit', 'fix', 'exploit'])), 'mixed');
});

test('save reload restores decisions and recomputes trusted totals', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  };
  const state = play(['fix', 'exploit', 'fix', 'exploit', 'fix', 'exploit']);
  state.player = { x: 1500, y: 700 };
  state.endingSeen = true;
  assert.equal(saveState(state), true);
  const restored = loadState();
  assert.deepEqual(restored, state);
  const forged = { ...state, resources: 99999, stability: -999 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(forged));
  assert.equal(loadState().resources, state.resources);
  assert.equal(loadState().stability, state.stability);
  assert.equal(clearSave(), true);
  assert.equal(loadState(), null);
});

test('corrupt and out-of-order saves cannot unlock districts or crash loading', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  };
  localStorage.setItem(STORAGE_KEY, '{not json');
  assert.equal(loadState(), null);
  assert.equal(localStorage.getItem(STORAGE_KEY), '{not json');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...createState(),
    choices: { 2: 'fix', 3: 'fix', 4: 'fix', 5: 'exploit', 6: 'exploit' },
    player: { x: 1500, y: 700 }, endingSeen: true,
  }));
  const restored = loadState();
  assert.deepEqual(restored.choices, {});
  assert.deepEqual(restored.player, createState().player);
  assert.equal(restored.endingSeen, false);
  localStorage.getItem = () => { throw new Error('storage denied'); };
  localStorage.setItem = () => { throw new Error('quota exhausted'); };
  assert.equal(loadState(), null);
  assert.equal(saveState(createState()), false);
  delete globalThis.localStorage;
});
