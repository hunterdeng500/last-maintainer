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

test('keyboard acceleration reaches walking and running speed in 0.1 seconds and normalizes diagonals', () => {
  const state = createState();
  const player = new Player();
  player.update(0.05, new Set(['KeyD', 'KeyS']), state);
  assert.ok(Math.abs(Math.hypot(player.velocityX, player.velocityY) - 52.5) < 1e-9);
  assert.ok(Math.abs(Math.hypot(player.x - 360, player.y - 590) - 1.3125) < 1e-9);
  player.update(0.05, new Set(['KeyD', 'KeyS']), state);
  assert.ok(Math.abs(Math.hypot(player.velocityX, player.velocityY) - 105) < 1e-9);
  assert.ok(Math.abs(Math.hypot(player.x - 360, player.y - 590) - 5.25) < 1e-9);
  assert.equal(player.sprinting, false);
  const sprint = new Player();
  sprint.update(0.05, new Set(['KeyD', 'ShiftLeft']), state);
  assert.equal(sprint.velocityX, 87.5);
  sprint.update(0.05, new Set(['KeyD', 'ShiftLeft']), state);
  assert.equal(sprint.velocityX, 175);
  assert.equal(sprint.x, 368.75);
  assert.equal(sprint.sprinting, true);
});

test('release brakes within 80ms without lingering drift, and stride follows actual travel', () => {
  const state = createState();
  for (const keys of [new Set(['KeyD']), new Set(['KeyD', 'ShiftLeft'])]) {
    const player = new Player();
    player.update(0.05, keys, state);
    player.update(0.05, keys, state);
    const releasedAt = player.x;
    const speed = player.velocityX;
    player.update(0.01, EMPTY_KEYS, state);
    assert.ok(player.velocityX > 0 && player.velocityX < speed, 'Release has a short, visible braking ramp');
    for (let frame = 0; frame < 7; frame += 1) player.update(0.01, EMPTY_KEYS, state);
    assert.ok(player.x > releasedAt && player.x - releasedAt < 6.5);
    assert.equal(player.velocityX, 0);
    assert.equal(player.velocityY, 0);
    assert.equal(player.moving, false);
    assert.equal(player.sprinting, false);
    assert.ok(Math.abs(player.stride - (player.x - 360) * Math.PI * 2 / 32) < 1e-9);
    const stoppedAt = { x: player.x, y: player.y, stride: player.stride };
    for (let frame = 0; frame < 30; frame += 1) player.update(1 / 60, EMPTY_KEYS, state);
    assert.deepEqual({ x: player.x, y: player.y, stride: player.stride }, stoppedAt);
  }
});

test('equal input durations have matching acceleration and braking at different frame rates', () => {
  const state = createState();
  const schedules = [
    Array(30).fill(1 / 30),
    Array(60).fill(1 / 60),
    Array(120).fill(1 / 120),
    Array.from({ length: 10 }, () => [0.01, 0.04, 0.015, 0.035]).flat(),
  ];
  for (const keys of [new Set(['KeyD']), new Set(['KeyD', 'ShiftRight'])]) {
    const players = schedules.map(schedule => {
      const player = new Player();
      for (const dt of schedule) player.update(dt, keys, state);
      for (const dt of schedule) player.update(dt / 10, EMPTY_KEYS, state);
      assertClear(player, state);
      return player;
    });
    for (const player of players.slice(1)) {
      assert.ok(Math.abs(player.x - players[0].x) < 1e-9);
      assert.ok(Math.abs(player.stride - players[0].stride) < 1e-9);
      assert.equal(player.velocityX, 0);
    }
  }
});

test('reversing or turning responds immediately without sideways momentum and retains four facings', () => {
  const state = createState();
  const player = new Player();
  player.update(0.05, new Set(['KeyD']), state);
  player.update(0.05, new Set(['KeyD']), state);
  const beforeReverse = player.x;
  player.update(1 / 60, new Set(['KeyA']), state);
  assert.ok(player.x < beforeReverse);
  assert.equal(player.velocityX, -105);
  assert.equal(player.facing, 'left');
  const beforeTurn = player.x;
  player.update(1 / 60, new Set(['ArrowUp']), state);
  assert.equal(player.x, beforeTurn);
  assert.equal(player.velocityX, 0);
  assert.equal(player.velocityY, -105);
  assert.equal(player.facing, 'up');
  player.update(1 / 60, new Set(['ArrowDown']), state);
  assert.equal(player.facing, 'down');
  player.update(1 / 60, new Set(['ArrowRight']), state);
  assert.equal(player.facing, 'right');
});

test('stop and opposing keyboard keys cancel routes and all pending momentum immediately', () => {
  const state = createState();
  for (const stop of [player => player.stop(), player => player.update(0.01, new Set(['KeyW', 'KeyS']), state)]) {
    const player = new Player();
    assert.equal(player.setTarget(450, 650, state), true);
    player.update(0.05, new Set(['ShiftLeft']), state);
    player.update(0.05, new Set(['ShiftLeft']), state);
    assert.equal(player.sprinting, true);
    const stoppedAt = { x: player.x, y: player.y, stride: player.stride };
    stop(player);
    assert.equal(player.target, null);
    assert.deepEqual(player.route, []);
    assert.equal(player.velocityX, 0);
    assert.equal(player.velocityY, 0);
    assert.equal(player.moving, false);
    assert.equal(player.sprinting, false);
    for (let frame = 0; frame < 10; frame += 1) player.update(0.05, EMPTY_KEYS, state);
    assert.deepEqual({ x: player.x, y: player.y, stride: player.stride }, stoppedAt);
  }
  const player = new Player();
  assert.equal(player.setTarget(450, 650, state), true);
  player.update(0.05, EMPTY_KEYS, state);
  player.update(0.05, EMPTY_KEYS, state);
  const beforeOverride = { x: player.x, y: player.y };
  player.update(0.01, new Set(['ArrowUp']), state);
  assert.equal(player.target, null);
  assert.deepEqual(player.route, []);
  assert.equal(player.x, beforeOverride.x);
  assert.ok(player.y < beforeOverride.y);
  for (let frame = 0; frame < 8; frame += 1) player.update(0.01, EMPTY_KEYS, state);
  const afterRelease = { x: player.x, y: player.y };
  player.update(0.05, EMPTY_KEYS, state);
  assert.deepEqual({ x: player.x, y: player.y }, afterRelease, 'The old click route must never resume after manual override');
  assert.equal(player.velocityY, 0);
});

test('wall sliding preserves the full radius, removes blocked velocity, and does not animate a stationary player', () => {
  const state = createState();
  const player = new Player({ x: 220, y: 370 });
  for (let frame = 0; frame < 40; frame += 1) {
    player.update(1 / 60, new Set(['KeyW', 'KeyD']), state);
    assertClear(player, state);
  }
  assert.ok(player.x > 250, 'Movement continues along the building wall');
  assert.ok(player.y > 356 && player.y < 356.001, 'The foot radius stops just outside the building front');
  assert.ok(player.velocityX > 0);
  assert.equal(player.velocityY, 0);
  for (let frame = 0; frame < 10; frame += 1) player.update(1 / 60, new Set(['KeyW', 'ShiftLeft']), state);
  const stride = player.stride;
  player.update(0.05, new Set(['KeyW', 'ShiftLeft']), state);
  assert.equal(player.velocityX, 0);
  assert.equal(player.velocityY, 0);
  assert.equal(player.moving, false);
  assert.equal(player.sprinting, false);
  assert.equal(player.stride, stride);
  assertClear(player, state);
});

test('elapsed time is capped and invalid frame durations cannot move the player', () => {
  const state = createState();
  const player = new Player();
  const capped = new Player();
  const keys = new Set(['KeyD', 'ShiftLeft']);
  player.update(2, keys, state);
  capped.update(0.05, keys, state);
  assert.equal(player.x, capped.x);
  assert.equal(player.velocityX, capped.velocityX);
  for (const dt of [NaN, Infinity, -1, 0]) player.update(dt, keys, state);
  assert.equal(player.x, capped.x);
  assert.equal(player.stride, capped.stride);
});

test('a click destination reached within one accelerated frame stops exactly and faces the travel direction', () => {
  const state = createState();
  const player = new Player();
  assert.equal(player.setTarget(361, 590, state), true);
  player.update(0.05, EMPTY_KEYS, state);
  assert.equal(player.x, 361);
  assert.equal(player.y, 590);
  assert.equal(player.target, null);
  assert.equal(player.velocityX, 0);
  assert.equal(player.velocityY, 0);
  assert.equal(player.moving, false);
  assert.equal(player.facing, 'right');
  assert.ok(Math.abs(player.stride - Math.PI * 2 / 32) < 1e-9);
});
