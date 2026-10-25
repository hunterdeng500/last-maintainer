import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../js/player.js';
import { SITES, isBlocked, getNearby } from '../js/world.js';
import { createState, choose } from '../js/state.js';

const EMPTY_KEYS = new Set();
const RADIUS_POINTS = [[0, 0], [-8, -8], [-8, 8], [8, -8], [8, 8]];

function assertClear(player, state) {
  for (const [dx, dy] of RADIUS_POINTS) {
    assert.equal(isBlocked(player.x + dx, player.y + dy, state), false,
      `Player radius collided at (${player.x}, ${player.y}), offset (${dx}, ${dy})`);
  }
}

function finishRoute(player, state, delta = () => 1 / 60) {
  assert.ok(player.target, 'A reachable route must have a destination');
  const destination = { ...player.target };
  for (let frame = 0; player.target && frame < 12000; frame += 1) {
    player.update(delta(frame), EMPTY_KEYS, state);
    assertClear(player, state);
  }
  assert.equal(player.target, null, 'Route must finish within the frame budget');
  assert.equal(player.x, destination.x, 'Arrival must snap to the exact destination x');
  assert.equal(player.y, destination.y, 'Arrival must snap to the exact destination y');
}

function complete(state, id) {
  state.discovered[id] = true;
  state.inspected[id] = { logs: true, config: true };
  assert.equal(choose(state, id, id % 2 ? 'fix' : 'exploit').ok, true);
}

test('fractional frame times cannot strand a route at a bridge corner', () => {
  const state = createState();
  state.time = 1440;
  complete(state, 1);
  complete(state, 2);
  const starts = [
    { x: 424.725, y: 840 },
    { x: 447.419, y: 847.137 },
    // Exact position captured from the browser regression: y is just outside
    // the bridge, and the previous implementation skipped its corner waypoint.
    { x: 549.9042791915969, y: 616.0001138475974 },
  ];
  for (const start of starts) {
    for (const dt of [0.016, 0.016667, 0.033333, 0.05]) {
      const player = new Player(start);
      assertClear(player, state);
      assert.equal(player.setTarget(970, 438, state), true);
      finishRoute(player, state, () => dt);
    }
  }
});

test('all six real terminals remain reachable with variable frame times and progressive gates', () => {
  const state = createState();
  state.time = 1440;
  const player = new Player();
  let seed = 20261025;
  const delta = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return 0.006 + (seed / 4294967296) * 0.044;
  };
  for (const site of SITES) {
    assert.equal(player.setTarget(site.terminal.x, site.terminal.y + 22, state), true);
    finishRoute(player, state, delta);
    assert.deepEqual(getNearby(player, state), { type: 'site', id: site.id });
    complete(state, site.id);
  }
  assert.equal(player.setTarget(360, 590, state), true);
  finishRoute(player, state, delta);
});

test('a locked bridge blocks both click routes and keyboard movement at the full player radius', () => {
  const state = createState();
  const player = new Player({ x: 540, y: 592 });
  assert.equal(player.setTarget(970, 438, state), false);
  for (let frame = 0; frame < 90; frame += 1) {
    player.update(1 / 60, new Set(['KeyD', 'ShiftLeft']), state);
    assertClear(player, state);
  }
  assert.ok(player.x + 8 < 558, 'The player cannot overlap the locked river gate');
  state.time = 1440;
  complete(state, 1);
  complete(state, 2);
  assert.equal(player.setTarget(970, 438, state), true);
  finishRoute(player, state);
  assert.equal(player.setTarget(1530, 438, state), false);
});

test('clicking a solid terminal routes to a nearby collision-free interaction point', () => {
  const state = createState();
  const player = new Player();
  const site = SITES[0];
  assert.equal(player.setTarget(site.terminal.x, site.terminal.y, state), true);
  assert.ok(Math.hypot(player.target.x - site.terminal.x, player.target.y - site.terminal.y) <= 64);
  finishRoute(player, state);
  assert.deepEqual(getNearby(player, state), { type: 'site', id: 1 });
});

test('keyboard movement normalizes diagonals, caps elapsed time, and cancels automatic routes', () => {
  const state = createState();
  const player = new Player();
  player.update(0.05, new Set(['KeyD', 'KeyS']), state);
  assert.ok(Math.abs(Math.hypot(player.x - 360, player.y - 590) - 5.25) < 1e-9);
  const sprint = new Player();
  sprint.update(2, new Set(['KeyD', 'ShiftLeft']), state);
  assert.equal(sprint.x, 368.75);
  assert.equal(sprint.setTarget(410, 438, state), true);
  sprint.update(0.01, new Set(['KeyW', 'KeyS']), state);
  assert.equal(sprint.target, null);
  assert.equal(sprint.moving, false);
});
