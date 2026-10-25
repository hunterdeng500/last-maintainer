import { isBlocked } from './world.js';

const WIDTH = 1728;
const HEIGHT = 1152;
const RADIUS = 8;
const GRID = 16;
const COLS = WIDTH / GRID;
const ROWS = HEIGHT / GRID;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

function canStand(x, y, state) {
  if (x < RADIUS || x > WIDTH - RADIUS || y < RADIUS || y > HEIGHT - RADIUS) return false;
  return !isBlocked(x, y, state)
    && !isBlocked(x - RADIUS, y - RADIUS, state)
    && !isBlocked(x + RADIUS, y - RADIUS, state)
    && !isBlocked(x - RADIUS, y + RADIUS, state)
    && !isBlocked(x + RADIUS, y + RADIUS, state);
}

function clearLine(ax, ay, bx, by, state) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  let previousX = ax;
  let previousY = ay;
  for (let i = 0; i <= steps; i += 1) {
    const part = i / steps;
    const x = ax + (bx - ax) * part;
    const y = ay + (by - ay) * part;
    // Check the swept rectangle, including both off-diagonal corners. Merely
    // sampling a diagonal can miss the thin slice where it clips a riverbank.
    if (!canStand(x, y, state) || !canStand(previousX, y, state) || !canStand(x, previousY, state)) return false;
    previousX = x;
    previousY = y;
  }
  return true;
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
  }

  update(dt, keys, state) {
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
    this.moving = false;
    if (!elapsed) return;
    const pressed = (...names) => names.some((name) => keys?.has?.(name));
    const right = pressed('KeyD', 'ArrowRight', 'd', 'keyd', 'arrowright');
    const left = pressed('KeyA', 'ArrowLeft', 'a', 'keya', 'arrowleft');
    const down = pressed('KeyS', 'ArrowDown', 's', 'keys', 'arrowdown');
    const up = pressed('KeyW', 'ArrowUp', 'w', 'keyw', 'arrowup');
    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);
    const manual = right || left || down || up;
    const speed = pressed('ShiftLeft', 'ShiftRight', 'Shift', 'shift', 'shiftleft', 'shiftright') ? 175 : 105;
    let distance = speed * elapsed;
    if (manual) {
      this.stop();
    } else {
      // Never skip a nearly reached corner: even a tiny residual can put the
      // player's radius outside the next narrow bridge segment.
      while (this.route.length && Math.hypot(this.route[0].x - this.x, this.route[0].y - this.y) < 0.1) {
        const waypoint = this.route[0];
        if (!clearLine(this.x, this.y, waypoint.x, waypoint.y, state)) break;
        this.x = waypoint.x;
        this.y = waypoint.y;
        this.route.shift();
      }
      if (!this.route.length) {
        this.stop();
        return;
      }
      dx = this.route[0].x - this.x;
      dy = this.route[0].y - this.y;
      distance = Math.min(distance, Math.hypot(dx, dy));
    }
    const length = Math.hypot(dx, dy);
    if (!length) return;
    dx = (dx / length) * distance;
    dy = (dy / length) * distance;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const beforeX = this.x;
    const beforeY = this.y;
    if (manual) {
      // Keyboard input slides naturally along a building's wall.
      if (canStand(this.x + dx, this.y, state)) this.x += dx;
      if (canStand(this.x, this.y + dy, state)) this.y += dy;
    } else {
      // A planned diagonal is one segment, not two independent axis moves.
      // Snap an arriving step to the exact waypoint rather than accumulating
      // rounding errors at a bridge or building corner.
      const arrival = distance >= length;
      const nextX = arrival ? this.route[0].x : this.x + dx;
      const nextY = arrival ? this.route[0].y : this.y + dy;
      if (canStand(nextX, nextY, state)) {
        this.x = nextX;
        this.y = nextY;
      }
    }
    this.moving = Math.hypot(this.x - beforeX, this.y - beforeY) > 0.001;
    if (!manual && !this.moving) this.stop();
    if (this.target && Math.hypot(this.x - this.target.x, this.y - this.target.y) < 0.1) {
      if (clearLine(this.x, this.y, this.target.x, this.target.y, state)) {
        this.x = this.target.x;
        this.y = this.target.y;
      }
      this.stop();
    }
  }
}
