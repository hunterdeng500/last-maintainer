import { LEVELS, getLevel } from './levels.js';
import { STORY } from './story.js';

export const STORAGE_KEY = 'last-maintainer-remaster-v1';
const INITIAL_TIME = 1040;
const INITIAL_RESOURCES = 80;
const INITIAL_STABILITY = 52;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const owns = (object, key) => isObject(object) && Object.prototype.hasOwnProperty.call(object, key);
const isTrue = (object, key) => owns(object, key) && object[key] === true;
const validChoice = (value) => value === 'fix' || value === 'exploit';
const NPC_IDS = ['moss', 'copper', 'pip'];

export function createState() {
  return {
    version: 2,
    choices: {},
    discovered: {},
    inspected: {},
    storyFlags: {},
    readComms: {},
    npcVisits: {},
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
    if (!owns(state?.choices, level.id)) continue;
    if (state.choices[level.id] === 'fix') fix += 1;
    if (state.choices[level.id] === 'exploit') exploit += 1;
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

export function getAvailableStory(state) {
  const { total } = getStats(state);
  return STORY.filter(event => event.at <= total);
}

export function getPendingStory(state) {
  return getAvailableStory(state).find(event => !isTrue(state?.storyFlags, event.id)) ?? null;
}

export function markStorySeen(state, id) {
  if (!isObject(state) || !getAvailableStory(state).some(event => event.id === id)) return false;
  if (!isObject(state.storyFlags)) state.storyFlags = {};
  state.storyFlags[id] = true;
  return true;
}

export function getAvailableComms(state) {
  const entries = getAvailableStory(state).map(event => ({
    ...event, id: `story:${event.id}`, storyId: event.id, kind: '通讯',
  }));
  for (const level of LEVELS) {
    if (!unlocked(state, level.id) || !isTrue(state?.discovered, level.id)) continue;
    if (level.id === 2 && (!Number.isFinite(state.time) || state.time < 1440)) continue;
    const inspected = owns(state?.inspected, level.id) ? state.inspected[level.id] : null;
    if (!isTrue(inspected, 'logs') || !isTrue(inspected, 'config')) continue;
    for (const [index, archive] of (level.archive ?? []).entries()) {
      entries.push({ ...archive, id: `archive:${level.id}:${index}`, levelId: level.id, kind: '档案' });
    }
  }
  return entries;
}

export function markCommRead(state, id) {
  if (!isObject(state) || !getAvailableComms(state).some(entry => entry.id === id)) return false;
  if (!isObject(state.readComms)) state.readComms = {};
  state.readComms[id] = true;
  return true;
}

export function recordNpcVisit(state, id) {
  if (!isObject(state) || !NPC_IDS.includes(id)) return 0;
  if (!isObject(state.npcVisits)) state.npcVisits = {};
  const previous = owns(state.npcVisits, id) && Number.isFinite(state.npcVisits[id])
    ? Math.floor(state.npcVisits[id]) : 0;
  state.npcVisits[id] = clamp(previous + 1, 1, 10000);
  return state.npcVisits[id];
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
  if (!owns(raw, 'version') || ![1, 2].includes(raw.version)) return null;
  const state = createState();
  if (owns(raw, 'time') && typeof raw.time === 'number' && Number.isFinite(raw.time)) {
    state.time = clamp(raw.time, INITIAL_TIME, 1440 * 3650);
  }
  // Validate each district in order. Invalid decisions cannot unlock the next district.
  for (const level of LEVELS) {
    const id = level.id;
    if (!unlocked(state, id)) continue;
    if (id === 2 && state.time < 1440) continue;
    if (owns(raw, 'discovered') && isTrue(raw.discovered, id)) state.discovered[id] = true;
    const inspected = owns(raw, 'inspected') && owns(raw.inspected, id) ? raw.inspected[id] : null;
    if (isObject(inspected) && state.discovered[id]) {
      state.inspected[id] = { logs: isTrue(inspected, 'logs'), config: isTrue(inspected, 'config') };
    }
    if (owns(raw, 'choices') && owns(raw.choices, id) && validChoice(raw.choices[id])) {
      state.choices[id] = raw.choices[id];
      // A recorded decision is proof that its investigation was completed.
      state.discovered[id] = true;
      state.inspected[id] = { logs: true, config: true };
    }
  }
  reconstructTotals(state);
  if (owns(raw, 'player') && owns(raw.player, 'x') && owns(raw.player, 'y')
    && Number.isFinite(raw.player.x) && Number.isFinite(raw.player.y)) {
    const x = clamp(raw.player.x, 8, 1720);
    const y = clamp(raw.player.y, 8, 1144);
    const total = getStats(state).total;
    const allowed = x < 560 || (x < 1120 && total >= 2) || total >= 4;
    if (allowed) state.player = { x, y };
  }
  state.endingSeen = isTrue(raw, 'endingSeen') && getEnding(state) !== null;
  // Version 1 had no story acknowledgement. Existing towns keep their decisions
  // and can discover every newly added transmission, including after an ending.
  if (raw.version === 2) {
    for (const event of getAvailableStory(state)) {
      if (owns(raw, 'storyFlags') && isTrue(raw.storyFlags, event.id)) state.storyFlags[event.id] = true;
    }
    for (const entry of getAvailableComms(state)) {
      if (owns(raw, 'readComms') && isTrue(raw.readComms, entry.id)) state.readComms[entry.id] = true;
    }
    for (const id of NPC_IDS) {
      if (owns(raw, 'npcVisits') && owns(raw.npcVisits, id) && Number.isFinite(raw.npcVisits[id])) {
        state.npcVisits[id] = clamp(Math.floor(raw.npcVisits[id]), 0, 10000);
      }
    }
  }
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
