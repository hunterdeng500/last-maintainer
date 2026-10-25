import { LEVELS, getLevel } from './levels.js';

export const STORAGE_KEY = 'last-maintainer-remaster-v1';
const INITIAL_TIME = 1040;
const INITIAL_RESOURCES = 80;
const INITIAL_STABILITY = 52;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const validChoice = (value) => value === 'fix' || value === 'exploit';

export function createState() {
  return {
    version: 1,
    choices: {},
    discovered: {},
    inspected: {},
    time: INITIAL_TIME,
    resources: INITIAL_RESOURCES,
    stability: INITIAL_STABILITY,
    player: { x: 360, y: 590 },
    endingSeen: false,
  };
}

export function getStats(state) {
  let fix = 0;
  let exploit = 0;
  for (const level of LEVELS) {
    if (state?.choices?.[level.id] === 'fix') fix += 1;
    if (state?.choices?.[level.id] === 'exploit') exploit += 1;
  }
  return { fix, exploit, total: fix + exploit };
}

export function getEnding(state) {
  const { fix, exploit, total } = getStats(state);
  if (total !== LEVELS.length) return null;
  if (fix === LEVELS.length) return 'allFix';
  if (exploit === LEVELS.length) return 'allExploit';
  return 'mixed';
}

function unlocked(state, id) {
  const required = id <= 2 ? 0 : id <= 4 ? 2 : 4;
  return getStats(state).total >= required;
}

function reconstructTotals(state) {
  state.resources = INITIAL_RESOURCES;
  state.stability = INITIAL_STABILITY;
  for (const level of LEVELS) {
    if (state.choices[level.id] === 'fix') {
      state.resources += 8;
      state.stability += 8;
    } else if (state.choices[level.id] === 'exploit') {
      state.resources += level.reward;
      state.stability -= 5;
    }
  }
  state.stability = clamp(state.stability, 0, 100);
}

function sanitize(raw) {
  if (!isObject(raw) || raw.version !== 1) return null;
  const state = createState();
  if (typeof raw.time === 'number' && Number.isFinite(raw.time)) {
    state.time = clamp(raw.time, INITIAL_TIME, 1440 * 3650);
  }
  // Validate each district in order. Invalid decisions cannot unlock the next district.
  for (const level of LEVELS) {
    const id = level.id;
    if (!unlocked(state, id)) continue;
    if (id === 2 && state.time < 1440) continue;
    if (isObject(raw.discovered) && raw.discovered[id] === true) state.discovered[id] = true;
    const inspected = isObject(raw.inspected) ? raw.inspected[id] : null;
    if (isObject(inspected) && state.discovered[id]) {
      state.inspected[id] = { logs: inspected.logs === true, config: inspected.config === true };
    }
    if (isObject(raw.choices) && validChoice(raw.choices[id])) {
      state.choices[id] = raw.choices[id];
      // A recorded decision is proof that its investigation was completed.
      state.discovered[id] = true;
      state.inspected[id] = { logs: true, config: true };
    }
  }
  reconstructTotals(state);
  if (isObject(raw.player) && Number.isFinite(raw.player.x) && Number.isFinite(raw.player.y)) {
    const x = clamp(raw.player.x, 8, 1720);
    const y = clamp(raw.player.y, 8, 1144);
    const total = getStats(state).total;
    const allowed = x < 560 || (x < 1120 && total >= 2) || total >= 4;
    if (allowed) state.player = { x, y };
  }
  state.endingSeen = raw.endingSeen === true && getEnding(state) !== null;
  return state;
}

export function loadState() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!stored) return null;
    return sanitize(JSON.parse(stored));
  } catch {
    // Keep unreadable or incompatible saves intact for future recovery.
    return null;
  }
}

export function saveState(state) {
  try {
    const sanitized = sanitize(state);
    if (!sanitized || !globalThis.localStorage) return false;
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    if (!globalThis.localStorage) return false;
    globalThis.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function choose(state, id, choice) {
  const level = getLevel(id);
  if (!level || !validChoice(choice) || !isObject(state)) {
    return { ok: false, message: '无效的维护指令。' };
  }
  id = level.id;
  if (state.choices?.[id]) return { ok: false, message: '这处故障已经做出决定。' };
  if (!unlocked(state, id)) return { ok: false, message: '先完成当前街区的两项维护，才能开启下一道桥闸。' };
  if (id === 2 && (!Number.isFinite(state.time) || state.time < 1440)) {
    return { ok: false, message: '等到第 2 天 00:00，亲眼确认昨夜的折扣仍未结束。' };
  }
  if (state.discovered?.[id] !== true) return { ok: false, message: '先到现场观察异常。' };
  if (state.inspected?.[id]?.logs !== true || state.inspected?.[id]?.config !== true) {
    return { ok: false, message: '先阅读日志和配置，查明故障原因。' };
  }
  if (!isObject(state.choices)) state.choices = {};
  state.choices[id] = choice;
  reconstructTotals(state);
  return {
    ok: true,
    message: choice === 'fix' ? level.fixResult : level.exploitResult,
    reward: choice === 'fix' ? 8 : level.reward,
  };
}
