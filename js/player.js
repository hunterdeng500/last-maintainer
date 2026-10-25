import { isBlocked } from './world.js';

const WIDTH = 1728;
const HEIGHT = 1152;
const RADIUS = 8;
const GRID = 16;
const COLS = WIDTH / GRID;
const ROWS = HEIGHT / GRID;
const WALK_SPEED = 105;
const RUN_SPEED = 175;
const ACCELERATION_TIME = 0.1;
const BRAKING = 2400;
const STRIDE_LENGTH = 32;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

function canStand(x, y, state) {
  if (x < RADIUS || x > WIDTH - RADIUS || y < RADIUS || y > HEIGHT - RADIUS) return false;
  return !isBlocked(x, y, state)
    && !isBlocked(x - RADIUS, y - RADIUS, state)
    && !isBlocked(x + RADIUS, y - RADIUS, state)
    && !isBlocked(x - RADIUS, y + RADIUS, state)
    && !isBlocked(x + RADIUS, y + RADIUS, state);
}

function clearLine(ax, ay, bx, by, state, checkCorners = true) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  let previousX = ax;
  let previousY = ay;
  for (let i = 0; i <= steps; i += 1) {
    const part = i / steps;
    const x = ax + (bx - ax) * part;
    const y = ay + (by - ay) * part;
    // Check the swept rectangle, including both off-diagonal corners. Merely
    // sampling a diagonal can miss the thin slice where it clips a riverbank.
    if (!canStand(x, y, state) || (checkCorners && (!canStand(previousX, y, state) || !canStand(x, previousY, state)))) return false;
    previousX = x;
    previousY = y;
  }
  return true;
}

function accelerate(speed, target, elapsed) {
  const rate = target > speed ? target / ACCELERATION_TIME : BRAKING;
  const duration = Math.min(elapsed, Math.abs(target - speed) / rate);
  const next = duration < elapsed ? target : speed + Math.sign(target - speed) * rate * duration;
  // Integrate the ramp and any time at full speed separately, so the same
  // input travels the same distance at 30, 60, and 120 frames per second.
  return { speed: next, distance: (speed + next) * duration / 2 + next * (elapsed - duration) };
}

function slide(player, dx, dy, state) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  let blockedX = false;
  let blockedY = false;
  let distance = 0;
  const advance = (axis, amount) => {
    const start = player[axis];
    const clear = part => clearLine(player.x, player.y,
      axis === 'x' ? start + amount * part : player.x,
      axis === 'y' ? start + amount * part : player.y, state);
    if (clear(1)) {
      player[axis] += amount;
      return false;
    }
    // Reach the wall without leaving a speed-dependent gap or crossing it.
    let low = 0;
    let high = 1;
    for (let i = 0; i < 12; i += 1) {
      const middle = (low + high) / 2;
      if (clear(middle)) low = middle;
      else high = middle;
    }
    player[axis] += amount * low;
    return true;
  };
  for (let step = 0; step < steps; step += 1) {
    const beforeX = player.x;
    const beforeY = player.y;
    if (dx && !blockedX) blockedX = advance('x', dx / steps);
    if (dy && !blockedY) blockedY = advance('y', dy / steps);
    distance += Math.hypot(player.x - beforeX, player.y - beforeY);
  }
  return { distance, blockedX, blockedY };
}

const cellPoint = (index) => ({ x: (index % COLS) * GRID + GRID / 2, y: Math.floor(index / COLS) * GRID + GRID / 2 });

function nearestCell(x, y, state, maxDistance, mustConnect = false) {
  const candidates = [];
  const cx = Math.floor(x / GRID);
  const cy = Math.floor(y / GRID);
  const range = Math.ceil(maxDistance / GRID);
  for (let dy = -range; dy <= range; dy += 1) {
    for (let dx = -range; dx <= range; dx += 1) {
      const col = cx + dx;
      const row = cy + dy;
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
      const index = row * COLS + col;
      const point = cellPoint(index);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= maxDistance && canStand(point.x, point.y, state)) candidates.push({ index, point, distance });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.find(({ point }) => !mustConnect || clearLine(x, y, point.x, point.y, state)) || null;
}

// Small binary heap keeps a map-wide search responsive on the 108 × 72 grid.
class Frontier {
  constructor() { this.items = []; }
  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].score <= item.score) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = item;
  }
  pop() {
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if (items.length) {
      let index = 0;
      while (index * 2 + 1 < items.length) {
        let child = index * 2 + 1;
        if (child + 1 < items.length && items[child + 1].score < items[child].score) child += 1;
        if (items[child].score >= last.score) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }
}

function findPath(from, destination, state) {
  if (clearLine(from.x, from.y, destination.x, destination.y, state)) return [destination];
  const start = nearestCell(from.x, from.y, state, 40, true);
  const goal = nearestCell(destination.x, destination.y, state, 40, true);
  if (!start || !goal) return null;
  const count = COLS * ROWS;
  const cost = new Float64Array(count).fill(Infinity);
  const parents = new Int32Array(count).fill(-1);
  const closed = new Uint8Array(count);
  const available = new Int8Array(count); // 0 unknown, 1 free, -1 blocked
  const frontier = new Frontier();
  const walkable = (index) => {
    if (available[index] === 0) {
      const point = cellPoint(index);
      available[index] = canStand(point.x, point.y, state) ? 1 : -1;
    }
    return available[index] === 1;
  };
  const heuristic = (index) => {
    const dx = Math.abs((index % COLS) - (goal.index % COLS));
    const dy = Math.abs(Math.floor(index / COLS) - Math.floor(goal.index / COLS));
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  cost[start.index] = 0;
  frontier.push({ index: start.index, score: heuristic(start.index) });
  while (frontier.items.length) {
    const { index } = frontier.pop();
    if (closed[index]) continue;
    if (index === goal.index) {
      const route = [];
      let current = goal.index;
      while (current !== -1) {
        route.push(cellPoint(current));
        current = parents[current];
      }
      route.reverse();
      route.push(destination);
      // Remove redundant grid steps only when the full radius stays clear.
      const simplified = [];
      let anchor = from;
      let next = 0;
      while (next < route.length) {
        let furthest = next;
        while (furthest + 1 < route.length && clearLine(anchor.x, anchor.y, route[furthest + 1].x, route[furthest + 1].y, state)) furthest += 1;
        simplified.push(route[furthest]);
        anchor = route[furthest];
        next = furthest + 1;
      }
      return simplified;
    }
    closed[index] = 1;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    for (const [dx, dy] of DIRECTIONS) {
      const nx = col + dx;
      const ny = row + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      const neighbor = ny * COLS + nx;
      if (closed[neighbor] || !walkable(neighbor)) continue;
      // Diagonals may never cut between touching obstacles.
      if (dx && dy && (!walkable(row * COLS + nx) || !walkable(ny * COLS + col))) continue;
      const nextCost = cost[index] + (dx && dy ? Math.SQRT2 : 1);
      if (nextCost >= cost[neighbor]) continue;
      const a = cellPoint(index);
      const b = cellPoint(neighbor);
      if (!clearLine(a.x, a.y, b.x, b.y, state)) continue;
      parents[neighbor] = index;
      cost[neighbor] = nextCost;
      frontier.push({ index: neighbor, score: nextCost + heuristic(neighbor) });
    }
  }
  return null;
}

export class Player {
  constructor(position = { x: 360, y: 590 }) {
    this.x = Number.isFinite(position?.x) ? Math.max(RADIUS, Math.min(WIDTH - RADIUS, position.x)) : 360;
    this.y = Number.isFinite(position?.y) ? Math.max(RADIUS, Math.min(HEIGHT - RADIUS, position.y)) : 590;
    this.facing = 'down';
    this.moving = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this.stride = 0; // Radians, advanced by distance actually travelled.
    this.sprinting = false;
    this._speed = 0;
    this._headingX = 0;
    this._headingY = 0;
    this.target = null;
    this.route = [];
  }

  setTarget(x, y, state) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > WIDTH || y > HEIGHT) return false;
    let destination = { x, y };
    if (!canStand(x, y, state)) {
      const nearest = nearestCell(x, y, state, 64);
      if (!nearest) return false;
      destination = nearest.point;
    }
    const path = findPath(this, destination, state);
    if (!path) return false;
    this.target = destination;
    this.route = path;
    return true;
  }

  stop() {
    this.target = null;
    this.route = [];
    this.moving = false;
    this.sprinting = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this._speed = 0;
    this._headingX = 0;
    this._headingY = 0;
  }

  update(dt, keys, state) {
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
    if (!elapsed) return;
    this.moving = false;
    this.sprinting = false;
    const pressed = (...names) => names.some((name) => keys?.has?.(name));
    const right = pressed('KeyD', 'ArrowRight', 'd', 'keyd', 'arrowright');
    const left = pressed('KeyA', 'ArrowLeft', 'a', 'keya', 'arrowleft');
    const down = pressed('KeyS', 'ArrowDown', 's', 'keys', 'arrowdown');
    const up = pressed('KeyW', 'ArrowUp', 'w', 'keyw', 'arrowup');
    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);
    const manual = right || left || down || up;
    const shift = pressed('ShiftLeft', 'ShiftRight', 'Shift', 'shift', 'shiftleft', 'shiftright');
    if (manual) {
      this.target = null;
      this.route = [];
      // Opposite keys cancel a route and brake immediately, with no stale
      // automatic heading carried into a later release frame.
      if (!dx && !dy) {
        this.stop();
        return;
      }
      const length = Math.hypot(dx, dy);
      this._headingX = dx / length;
      this._headingY = dy / length;
    }
    const followingRoute = !manual && this.route.length > 0;
    const ramp = accelerate(this._speed, manual || followingRoute ? (shift ? RUN_SPEED : WALK_SPEED) : 0, elapsed);
    this._speed = ramp.speed;
    let facingX = this._headingX;
    let facingY = this._headingY;
    let travelled = 0;
    let blockedX = false;
    let blockedY = false;
    if (followingRoute) {
      let remaining = ramp.distance;
      while (this.route.length && remaining > 0) {
        const waypoint = this.route[0];
        dx = waypoint.x - this.x;
        dy = waypoint.y - this.y;
        const length = Math.hypot(dx, dy);
        const arrival = remaining >= length;
        const distance = Math.min(remaining, length);
        if (length) {
          this._headingX = dx / length;
          this._headingY = dy / length;
          facingX = this._headingX;
          facingY = this._headingY;
        }
        const nextX = arrival ? waypoint.x : this.x + this._headingX * distance;
        const nextY = arrival ? waypoint.y : this.y + this._headingY * distance;
        // The planner already checks swept corners for this entire segment.
        // Recheck its radius along the step, without imposing new off-diagonal
        // corners at frame-dependent sample points beside a narrow bridge.
        if (!clearLine(this.x, this.y, nextX, nextY, state, false)) {
          this.stop();
          break;
        }
        this.x = nextX;
        this.y = nextY;
        travelled += distance;
        remaining -= distance;
        if (arrival) this.route.shift();
        else break;
      }
      if (!this.route.length) this.stop();
    } else if (ramp.distance) {
      const movement = slide(this, this._headingX * ramp.distance, this._headingY * ramp.distance, state);
      travelled = movement.distance;
      blockedX = movement.blockedX;
      blockedY = movement.blockedY;
    }
    this.stride += travelled * Math.PI * 2 / STRIDE_LENGTH;
    this.moving = travelled > 0.000001 && this._speed > 0;
    this.sprinting = this.moving && shift;
    this.velocityX = blockedX || !this._speed ? 0 : this._headingX * this._speed;
    this.velocityY = blockedY || !this._speed ? 0 : this._headingY * this._speed;
    if (facingX || facingY) {
      this.facing = Math.abs(facingX) > Math.abs(facingY)
        ? (facingX > 0 ? 'right' : 'left') : (facingY > 0 ? 'down' : 'up');
    }
  }
}
