/** DOM orchestration only: simulation, data, movement, and art live in their own modules. */
import { LEVELS, ENDINGS, getLevel } from './levels.js';
import { createState, loadState, saveState, clearSave, getStats, getEnding, choose } from './state.js';
import { WORLD, SITES, NPCS, WorldRenderer, getNearby, getRegion, isBlocked, getNPCPosition } from './world.js';
import { Player } from './player.js';

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.floor(minutes) % 60).padStart(2, '0')}`;
const regionNames = ['西街 · 日常的裂缝', '中央街区 · 旧系统的回声', '东岸 · 分身与远方'];
const keys = new Set();
const canvas = $('#world');
const renderer = new WorldRenderer(canvas);
let saved = loadState();
let state = saved || createState();
let player = new Player(state.player);
let mode = 'title';
let activeLevel = null;
let activeTab = 'scene';
let pendingInteraction = null;
let elapsed = 0;
let previousTime = performance.now();
let hudTimer = 0;
let saveTimer = 0;
let near = null;
let warnedStorage = false;
const dialogs = [...document.querySelectorAll('dialog')];
const modalOpen = () => dialogs.some((d) => d.open);
const unlocked = (id) => getStats(state).total >= (id <= 2 ? 0 : id <= 4 ? 2 : 4);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const siteFor = (id) => SITES.find((s) => s.id === Number(id));

function toast(text, error = false) {
  const item = document.createElement('div');
  item.className = `toast${error ? ' error' : ''}`;
  item.textContent = text;
  $('#toasts').append(item);
  while ($('#toasts').children.length > 3) $('#toasts').firstElementChild.remove();
  setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 350); }, 3900);
}

function persist() {
  if (mode === 'title') return;
  state.player = { x: player.x, y: player.y };
  const ok = saveState(state);
  $('#save-indicator').innerHTML = `<i></i> ${ok ? '进度已保存' : '本次进度仅在内存中'}`;
  if (!ok && !warnedStorage) { warnedStorage = true; toast('浏览器未允许本地存档。当前仍可游玩，关闭页面后进度不会保留。', true); }
}

function showDialog(id) {
  keys.clear();
  player.stop();
  pendingInteraction = null;
  const dialog = $(id);
  if (!dialog.open) dialog.showModal();
}

function closeDialog(id) { $(id).close(); }

function startGame(fresh = false) {
  for (const dialog of dialogs) if (dialog.open) dialog.close();
  if (fresh) state = createState();
  else state = loadState() || saved || state;
  player = new Player(state.player);
  // Old or manually edited positions must never strand the player inside scenery.
  if (isBlocked(player.x, player.y, state) || isBlocked(player.x + 8, player.y + 8, state) || isBlocked(player.x - 8, player.y - 8, state)) player = new Player();
  mode = 'playing';
  keys.clear();
  pendingInteraction = null;
  $('#title-screen').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (matchMedia('(pointer: coarse)').matches) $('#mobile-controls').classList.remove('hidden');
  for (const id of ['#btn-map', '#btn-journal']) $(id).disabled = false;
  persist();
  updateHUD();
  canvas.focus({ preventScroll: true });
  if (getEnding(state) && !state.endingSeen) showEnding();
  else toast(fresh || !saved ? '你已接班。向北走，到杂货铺看看异常账本。' : '欢迎回来，维护员。上次的脚步与选择都还在。');
}

function returnToTitle() {
  persist();
  mode = 'title';
  keys.clear();
  player.stop();
  for (const dialog of dialogs) if (dialog.open) dialog.close();
  $('#title-screen').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#mobile-controls').classList.add('hidden');
  for (const button of document.querySelectorAll('.toolbelt button')) button.disabled = true;
  refreshTitle();
}

function refreshTitle() {
  saved = loadState();
  $('#btn-start').classList.toggle('hidden', !!saved);
  $('#btn-continue').classList.toggle('hidden', !saved);
  $('#btn-new').classList.toggle('hidden', !saved);
}

function smallDialog(title, content, actions = [], eyebrow = '小镇日常') {
  $('#small-title').textContent = title;
  $('#small-eyebrow').textContent = eyebrow;
  $('#small-content').textContent = content;
  $('#small-actions').replaceChildren();
  for (const [label, callback, primary] of actions) {
    const button = document.createElement('button');
    button.className = `button ${primary ? 'primary' : 'secondary'}`;
    button.textContent = label;
    button.addEventListener('click', () => { closeDialog('#small-dialog'); callback?.(); });
    $('#small-actions').append(button);
  }
  showDialog('#small-dialog');
}

function waitUntilMidnight() {
  state.time = (Math.floor(state.time / 1440) + 1) * 1440 + 10;
  $('#transition-flash').classList.add('active');
  setTimeout(() => $('#transition-flash').classList.remove('active'), 450);
  discoverNearby();
  persist();
  updateHUD();
  toast(`第 ${Math.floor(state.time / 1440) + 1} 天 · 00:10。昨晚的折扣灯仍亮着。`);
}

function rest() {
  if (mode !== 'playing' || modalOpen()) return;
  if (getNearby(player, state)?.type !== 'bench') { toast('西街的路边有张长椅。走近它，就能休息到午夜。'); return; }
  smallDialog('在长椅上歇一会', '风掠过河面，旧路灯依次亮起。\n要在这里等到下一个午夜吗？', [['继续散步', null, false], ['等到 00:10', waitUntilMidnight, true]], '时间会继续前进');
}

function discoverNearby() {
  let changed = false;
  for (const site of SITES) {
    if (state.discovered[site.id] || !unlocked(site.id)) continue;
    if (site.id === 2 && state.time < 1440) continue;
    if (distance(player, site.terminal) < 146) {
      state.discovered[site.id] = true;
      toast(`发现异常 · ${getLevel(site.id).name}。靠近发光终端，按 E 调查。`);
      changed = true;
    }
  }
  if (changed) { persist(); updateHUD(); }
}

function interact(target = getNearby(player, state)) {
  if (mode !== 'playing' || modalOpen() || !target) return;
  if (target.type === 'site') {
    const site = siteFor(target.id);
    if (!site || distance(player, site.terminal) > 94 || !unlocked(site.id)) return;
    activeLevel = site.id;
    activeTab = 'scene';
    if (activeLevel !== 2 || state.time >= 1440) state.discovered[activeLevel] = true;
    renderInvestigation();
    showDialog('#investigation-dialog');
    persist();
  } else if (target.type === 'bench') rest();
  else if (target.type === 'npc') {
    const npc = NPCS.find((n) => n.id === target.id);
    if (!npc) return;
    const lines = npc.lines || ['小镇还在运转。辛苦了，维护员。'];
    smallDialog(npc.name, lines[Math.floor(elapsed / 11) % lines.length], [['继续巡查', null, true]], '路边的服务机器人');
  } else if (target.type === 'gate') {
    const needed = Number(target.id) === 1 ? 2 : 4;
    smallDialog('桥闸还未开放', `旧电网需要逐区接通。累计处理 ${needed} 处异常后，这座桥就会开放。\n修复与利用都能推进路线。当前已处理 ${getStats(state).total} / 6。`, [['记下了', null, true]], '街区通行提示');
  }
}

function renderInvestigation() {
  const level = getLevel(activeLevel);
  if (!level) return;
  const inspected = state.inspected[activeLevel] || {};
  const choice = state.choices[activeLevel];
  const waiting = activeLevel === 2 && state.time < 1440;
  const ready = !!(inspected.logs && inspected.config && !waiting);
  $('#scene-place').textContent = `现场 ${String(activeLevel).padStart(2, '0')} / 06 · ${level.place}`;
  $('#scene-title').textContent = level.name;
  $('#investigation-steps').innerHTML = [[!waiting, '发现异常'], [inspected.logs && inspected.config, '核对日志与配置'], [!!choice, '作出选择']].map(([done, text]) => `<span class="${done ? 'complete' : ''}">${done ? '✓' : '◇'} ${text}</span>`).join('<b>→</b>');
  for (const tab of ['scene', 'logs', 'config']) {
    $(`#tab-${tab}`).setAttribute('aria-selected', String(activeTab === tab));
    $(`#tab-${tab}`).disabled = waiting && tab !== 'scene';
    const mark = $(`#tab-${tab} span`);
    if (mark) mark.textContent = inspected[tab] ? '✓' : '';
  }
  let content;
  if (waiting) {
    content = `<div class="scene-anomaly">告示牌：第 1 天 23:00—23:59，一次性半价。</div><p class="scene-desc">现在是第 ${Math.floor(state.time / 1440) + 1} 天 ${formatTime(state.time)}。异常还未出现。\n在夜市坐一会，亲眼看看跨过午夜后，折扣会不会结束。</p><button class="button primary" id="btn-wait-market" style="margin-top:16px">等到次日 00:10</button>`;
  } else if (activeTab === 'scene') {
    content = `<div class="scene-anomaly">${escapeHTML(level.anomaly)}</div><p class="scene-desc">${escapeHTML(level.desc)}</p>`;
  } else if (activeTab === 'logs') {
    let rows = level.logs.map((log) => `<span class="log-${log.t}">${escapeHTML(log.text)}</span>`).join('\n');
    if (activeLevel === 2) rows += `\n<span class="log-err">[实时终端] 第 ${Math.floor(state.time / 1440) + 1} 天 ${formatTime(state.time)} / ${choice === 'fix' ? 'active=false' : 'active=true'} / 原定截止：第 1 天 23:59</span>`;
    content = `<pre class="terminal">${rows}</pre>`;
  } else content = `<pre class="terminal">${escapeHTML(level.config)}</pre>`;
  $('#investigation-content').innerHTML = content;
  $('#btn-wait-market')?.addEventListener('click', () => { waitUntilMidnight(); state.discovered[2] = true; renderInvestigation(); persist(); });
  $('#cause-box').classList.toggle('hidden', !ready);
  $('#cause-box').innerHTML = `<strong>已定位 · ${escapeHTML(level.bug)}</strong>${escapeHTML(level.cause)}<p class="decision-description"><b>修复：</b>${escapeHTML(level.fixText)}<br><b>利用：</b>${escapeHTML(level.exploitText)}</p>`;
  $('#choice-area').classList.toggle('hidden', !!choice);
  $('#btn-fix').disabled = !ready || !!choice;
  $('#btn-exploit').disabled = !ready || !!choice;
  $('#btn-exploit small').textContent = `稳定性 −5 · 资源 +${level.reward}`;
  $('#choice-hint').textContent = ready ? '选择会改变现场，并永久记入这一局的维护记录。' : waiting ? '跨过午夜，才能记录这项异常。' : `调查进度：日志${inspected.logs ? '已读' : '未读'} · 配置${inspected.config ? '已读' : '未读'}`;
  $('#result-box').classList.toggle('hidden', !choice);
  $('#result-box').classList.toggle('exploited', choice === 'exploit');
  if (choice) {
    $('#result-box').innerHTML = `<strong>${choice === 'fix' ? '✓ 已修复' : '◆ 已利用'}</strong><br>${escapeHTML(choice === 'fix' ? level.fixResult : level.exploitResult)}<br><button class="button primary" id="btn-result-continue">${getStats(state).total === 6 && !state.endingSeen ? '翻到手记最后一页' : '回到小镇，看看变化'} →</button>`;
    $('#btn-result-continue').addEventListener('click', () => closeDialog('#investigation-dialog'));
  }
}

function inspect(tab) {
  if (!$('#investigation-dialog').open || !activeLevel) return;
  if (activeLevel === 2 && state.time < 1440 && tab !== 'scene') return;
  activeTab = tab;
  if (tab === 'logs' || tab === 'config') {
    state.inspected[activeLevel] ||= {};
    state.inspected[activeLevel][tab] = true;
    persist();
  }
  renderInvestigation();
}

function decide(choice) {
  if (!$('#investigation-dialog').open) return;
  const before = getStats(state).total;
  const result = choose(state, activeLevel, choice);
  if (!result.ok) { toast(result.message, true); return; }
  persist();
  renderInvestigation();
  updateHUD();
  if (before === 1 || before === 3) toast(before === 1 ? '中央街区的桥闸已开放。沿主路向东继续巡查。' : '东岸已接入电网。最后两处异常正在等待你。');
}

function showEnding() {
  const endingKey = getEnding(state);
  if (!endingKey) return;
  const ending = ENDINGS[endingKey];
  const stats = getStats(state);
  $('#ending-title').textContent = ending.title;
  $('#ending-body').textContent = ending.body;
  $('#btn-ending-walk').textContent = endingKey === 'allExploit' ? '回看离开前的小镇' : '再看看这座小镇';
  $('#ending-art').className = `ending-art ${endingKey === 'allExploit' ? 'collapse' : endingKey === 'mixed' ? 'mixed' : ''}`;
  $('#ending-stats').innerHTML = `<span>修复 ${stats.fix} 处</span><span>利用 ${stats.exploit} 处</span><span>稳定性 ${state.stability}%</span>`;
  state.endingSeen = true;
  persist();
  showDialog('#ending-dialog');
}

function updateHUD() {
  const stats = getStats(state);
  const clock = state.time % 1440;
  $('#clock').textContent = formatTime(state.time);
  $('#day-label').textContent = `第 ${Math.floor(state.time / 1440) + 1} 天 · ${clock >= 360 && clock < 1080 ? '晴' : clock >= 1080 && clock < 1200 ? '黄昏' : '夜'}`;
  $('#day-icon').textContent = clock >= 360 && clock < 1140 ? '☀' : '☾';
  $('#stability').textContent = state.stability;
  $('#stability-meter').style.width = `${state.stability}%`;
  $('#resources').textContent = state.resources;
  $('#progress').textContent = stats.total;
  const region = Math.max(0, Math.min(2, getRegion(player.x)));
  $('#region-label').textContent = regionNames[region];
  $('#location-label').textContent = regionNames[region];
  const next = LEVELS.find((level) => !state.choices[level.id]);
  if (!next) {
    $('#quest-title').textContent = '今天的维护结束了';
    $('#quest-copy').textContent = '每一处变化，都是你留下的选择。打开手记，可以重读最后一页。';
    $('#quest-step').textContent = `✓ 修复 ${stats.fix} · 利用 ${stats.exploit}`;
  } else {
    $('#quest-title').textContent = state.discovered[next.id] ? `调查：${next.name}` : `去${next.place}看看`;
    const copy = ['沿石路向北，自动柜台的金币好像不太对劲。', '西街南侧的夜市。等到午夜，看看折扣灯有没有熄灭。', '过桥后沿石路向北。机房侧门传来忽开忽关的声音。', '中央街区南侧。已经倒下的 Boss，似乎又站了起来。', '跨过第二座桥，向北走。高台上的测试单元飞得太高了。', '东岸南侧的工坊。两个分身，似乎共享着同一个影子。'];
    $('#quest-copy').textContent = copy[next.id - 1];
    const inspected = state.inspected[next.id] || {};
    $('#quest-step').textContent = inspected.logs && inspected.config ? '◇ 成因已定位 · 作出你的选择' : state.discovered[next.id] ? `◇ 查日志 ${inspected.logs ? '✓' : '○'} · 看配置 ${inspected.config ? '✓' : '○'}` : '◇ 靠近异常，开始调查';
  }
  near = getNearby(player, state);
  $('#interaction-bubble').classList.toggle('hidden', !near || modalOpen());
  if (near) $('#interaction-label').textContent = near.type === 'site' ? `${state.choices[near.id] ? '查看' : '调查'} · ${getLevel(near.id).name}` : near.type === 'npc' ? '与服务机聊聊' : near.type === 'bench' ? '坐下等到午夜' : '查看桥闸';
  $('#btn-interact').disabled = mode !== 'playing' || !near;
  $('#btn-rest').disabled = mode !== 'playing' || near?.type !== 'bench';
  drawMap($('#minimap'), false);
  if ($('#map-dialog').open) drawMap($('#large-map'), true);
}

function drawMap(mapCanvas, detailed) {
  const ctx = mapCanvas.getContext('2d');
  const sx = mapCanvas.width / WORLD.width;
  const sy = mapCanvas.height / WORLD.height;
  const stats = getStats(state);
  ctx.save(); ctx.scale(sx, sy);
  ctx.fillStyle = '#708f58'; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = '#8da16a'; ctx.fillRect(48, 48, WORLD.width - 96, WORLD.height - 96);
  ctx.fillStyle = '#beaf80'; ctx.fillRect(48, 548, WORLD.width - 96, 88);
  for (const x of [400, 960, 1520]) ctx.fillRect(x, 220, 48, 750);
  for (const x of [560, 1120]) {
    ctx.fillStyle = '#568c8d'; ctx.fillRect(x, 0, 48, WORLD.height);
    ctx.fillStyle = '#bfa57a'; ctx.fillRect(x - 8, 548, 64, 88);
  }
  for (let i = 0; i < 70; i++) {
    const x = 66 + ((i * 241 + 37) % 1580), y = 55 + ((i * 131 + 19) % 1030);
    if (Math.abs(y - 590) < 95 || [424, 984, 1544, 584, 1144].some((a) => Math.abs(x - a) < 65)) continue;
    ctx.fillStyle = '#607f4d'; ctx.fillRect(x, y, 20, 20);
  }
  for (const site of SITES) {
    const choice = state.choices[site.id];
    ctx.fillStyle = '#a77b58'; ctx.fillRect(site.x - 90, site.y - 50, 180, 100);
    ctx.fillStyle = choice === 'fix' ? '#537850' : choice === 'exploit' ? '#a36e8a' : '#cf9b55';
    ctx.fillRect(site.terminal.x - 16, site.terminal.y - 16, 32, 32);
    if (detailed) {
      ctx.fillStyle = '#f7edce'; ctx.fillRect(site.x - 105, site.y + 74, 220, 45);
      ctx.fillStyle = '#40533a'; ctx.font = '23px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${site.id} · ${getLevel(site.id).place}`, site.x + 5, site.y + 104);
    }
  }
  if (stats.total < 2) { ctx.fillStyle = '#203b3180'; ctx.fillRect(608, 0, 512, WORLD.height); }
  if (stats.total < 4) { ctx.fillStyle = '#203b3199'; ctx.fillRect(1168, 0, 560, WORLD.height); }
  if (detailed) {
    ctx.font = '25px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f8efcf';
    for (const [x, text] of [[285, '西街'], [860, stats.total < 2 ? '处理 2 处异常后开放' : '中央街区'], [1430, stats.total < 4 ? '处理 4 处异常后开放' : '东岸']]) ctx.fillText(text, x, 110);
    ctx.fillStyle = '#ebd89d'; ctx.fillRect(246, 567, 30, 20);
    ctx.font = '20px sans-serif'; ctx.fillStyle = '#f5edcf'; ctx.fillText('休息长椅', 260, 655);
  }
  const dot = detailed ? 13 : 19;
  ctx.fillStyle = '#2b443c'; ctx.fillRect(player.x - dot - 5, player.y - dot - 5, dot * 2 + 10, dot * 2 + 10);
  ctx.fillStyle = '#fff3d0'; ctx.fillRect(player.x - dot, player.y - dot, dot * 2, dot * 2);
  ctx.restore();
}

function openMap() {
  if (mode !== 'playing') return;
  if ($('#map-dialog').open) { closeDialog('#map-dialog'); return; }
  if (modalOpen()) return;
  drawMap($('#large-map'), true);
  showDialog('#map-dialog');
}

function routeTo(x, y, automatic = true) {
  const hit = SITES.find((site) => distance({ x, y }, site.terminal) < 64 || (Math.abs(x - site.x) < 104 && y > site.y - 120 && y <= site.y + 38));
  if (hit) {
    if (!unlocked(hit.id)) { toast(`这片街区还未开放。先处理 ${hit.id <= 4 ? 2 : 4} 处异常。`); return false; }
    const target = { type: 'site', id: hit.id };
    if (distance(player, hit.terminal) <= 90) { interact(target); return true; }
    if (player.setTarget(hit.terminal.x, hit.terminal.y + 22, state)) { pendingInteraction = automatic ? target : null; return true; }
  } else if (player.setTarget(x, y, state)) { pendingInteraction = null; return true; }
  toast('这里暂时走不到。试试沿石路、从桥上过去。');
  return false;
}

function openJournal() {
  if (mode !== 'playing') return;
  if ($('#journal-dialog').open) { closeDialog('#journal-dialog'); return; }
  if (modalOpen()) return;
  $('#journal-list').innerHTML = LEVELS.map((level) => {
    const choice = state.choices[level.id];
    const record = state.inspected[level.id] || {};
    const status = choice ? choice === 'fix' ? '✓ 已修复 · 稳定性 +8' : `◆ 已利用 · 资源 +${level.reward}` : !unlocked(level.id) ? '桥闸未开放' : state.discovered[level.id] ? `已发现 · 日志 ${record.logs ? '✓' : '○'} / 配置 ${record.config ? '✓' : '○'}` : '待前往现场';
    return `<article class="journal-entry"><span class="journal-number">0${level.id}</span><div><h3>${escapeHTML(level.name)}</h3><p>${escapeHTML(level.place)}${record.logs && record.config ? ` · ${escapeHTML(level.bug)}` : ''}</p><span class="journal-status">${status}</span></div><button data-route="${level.id}" ${!unlocked(level.id) ? 'disabled' : ''}>前往 →</button></article>`;
  }).join('');
  const stats = getStats(state);
  $('#journal-footer').innerHTML = `修复 ${stats.fix} · 利用 ${stats.exploit} · 资源 ${state.resources}${getEnding(state) ? '<br><button class="text-button" id="btn-review-ending">重读最后一页</button>' : '<br>每个选择都能继续前进，也都会留下一些改变。'}`;
  for (const button of document.querySelectorAll('[data-route]')) button.addEventListener('click', () => {
    const terminal = siteFor(button.dataset.route).terminal;
    closeDialog('#journal-dialog');
    routeTo(terminal.x, terminal.y);
  });
  $('#btn-review-ending')?.addEventListener('click', () => { closeDialog('#journal-dialog'); showEnding(); });
  showDialog('#journal-dialog');
}

function showHelp() {
  smallDialog('维护员口袋手册', 'WASD / 方向键：移动　Shift：冲刺\n点击地面：自动绕路步行；点击终端：走近调查\nE / 空格：互动　M：地图　J：手记\n调查中 L：日志　C：配置　F：修复　X：利用\nEsc：关闭面板\n\n先走近看见异常，再读日志与配置，最后作出选择。每处理两处异常，东边的桥闸就会开放。\n\n时间每秒推进 4 分钟，读面板时暂停。西街长椅和夜市可等到午夜。进度自动保存在当前浏览器。', [['知道了', null, true]], '背好工具，沿着石路出发');
}

$('#btn-start').addEventListener('click', () => startGame(true));
$('#btn-continue').addEventListener('click', () => startGame());
$('#btn-new').addEventListener('click', () => smallDialog('开启新的维护记录', '新的一局会覆盖这台浏览器中的小镇进度。已做出的选择将重新开始。', [['保留旧记录', null, false], ['开始新的一局', () => { clearSave(); saved = null; startGame(true); }, true]], '重新接班'));
$('#btn-help').addEventListener('click', () => { if (!modalOpen()) showHelp(); });
$('#brand-home').addEventListener('click', (event) => { event.preventDefault(); if (!modalOpen()) showHelp(); });
$('#btn-fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { toast('当前浏览器未开放全屏；可以继续窗口游玩。'); } });
$('#btn-interact').addEventListener('click', () => interact());
$('#btn-rest').addEventListener('click', rest);
for (const id of ['#btn-map', '#btn-minimap']) $(id).addEventListener('click', openMap);
$('#btn-journal').addEventListener('click', openJournal);
$('#btn-close-dialog').addEventListener('click', () => closeDialog('#investigation-dialog'));
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => closeDialog(`#${button.dataset.close}`));
for (const tab of ['scene', 'logs', 'config']) $(`#tab-${tab}`).addEventListener('click', () => inspect(tab));
$('#btn-fix').addEventListener('click', () => decide('fix'));
$('#btn-exploit').addEventListener('click', () => decide('exploit'));
$('#btn-title').addEventListener('click', returnToTitle);
$('#btn-ending-walk').addEventListener('click', () => closeDialog('#ending-dialog'));
for (const dialog of dialogs) dialog.addEventListener('close', () => {
  keys.clear();
  if (mode === 'playing') {
    canvas.focus({ preventScroll: true });
    updateHUD();
    // Also catches Escape on the final result; the ending cannot accidentally be skipped.
    if (getEnding(state) && !state.endingSeen) queueMicrotask(() => { if (!modalOpen() && mode === 'playing') showEnding(); });
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (mode !== 'playing' || modalOpen()) return;
  const point = renderer.screenToWorld(event.clientX, event.clientY);
  const npc = NPCS.find((n) => distance(getNPCPosition(n, elapsed * 1000), point) < 27);
  const current = getNearby(player, state);
  if (npc && current?.type === 'npc' && current.id === npc.id) { interact(current); return; }
  if (distance(point, { x: 260, y: 580 }) < 35 && current?.type === 'bench') { rest(); return; }
  routeTo(point.x, point.y);
});
$('#large-map').addEventListener('click', (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((event.clientY - rect.top) / rect.height) * WORLD.height;
  closeDialog('#map-dialog');
  routeTo(x, y);
});

const movementCodes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
document.addEventListener('keydown', (event) => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.repeat && !movementCodes.has(event.code)) return;
  if (event.code === 'Escape') { if (!modalOpen()) { player.stop(); pendingInteraction = null; } return; }
  if (modalOpen()) {
    if ($('#investigation-dialog').open) {
      if (event.code === 'KeyL') inspect('logs');
      if (event.code === 'KeyC') inspect('config');
      if (event.code === 'KeyF') decide('fix');
      if (event.code === 'KeyX') decide('exploit');
    }
    return;
  }
  if (mode === 'title') { if (event.code === 'Enter') startGame(!saved); return; }
  if (movementCodes.has(event.code)) { keys.add(event.code); if (!event.code.startsWith('Shift')) pendingInteraction = null; }
  if (event.code === 'KeyE' || event.code === 'Space') interact();
  if (event.code === 'KeyM') openMap();
  if (event.code === 'KeyJ') openJournal();
  if (debug && /^Digit[1-6]$/.test(event.code)) debug.teleport(Number(event.code.slice(-1)));
  if (debug && event.code === 'KeyT') waitUntilMidnight();
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); player.stop(); pendingInteraction = null; persist(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); persist(); } previousTime = performance.now(); });
window.addEventListener('pagehide', persist);
for (const button of document.querySelectorAll('[data-move]')) {
  button.addEventListener('pointerdown', (event) => { if (modalOpen()) return; event.preventDefault(); button.setPointerCapture(event.pointerId); keys.add(button.dataset.move); pendingInteraction = null; });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, () => keys.delete(button.dataset.move));
}

function resize() {
  const bounds = canvas.getBoundingClientRect();
  const logicalHeight = 600;
  renderer.resize(Math.round(logicalHeight * bounds.width / bounds.height), logicalHeight);
}
new ResizeObserver(resize).observe($('.game-frame'));
resize();

function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  if (!document.hidden) {
    elapsed += dt;
    if (mode === 'playing' && !modalOpen()) {
      player.update(dt, keys, state);
      state.time += dt * 4;
      discoverNearby();
      if (pendingInteraction) {
        const terminal = siteFor(pendingInteraction.id)?.terminal;
        if (terminal && distance(player, terminal) < 75) { const target = pendingInteraction; pendingInteraction = null; player.stop(); interact(target); }
        else if (!player.target) pendingInteraction = null;
      }
      saveTimer += dt;
      if (saveTimer > 4) { persist(); saveTimer = 0; }
    }
    renderer.render(state, player, elapsed * 1000, { mode, target: player.target });
    hudTimer += dt;
    if (hudTimer > .15) { updateHUD(); hudTimer = 0; }
  }
  requestAnimationFrame(frame);
}

// Test convenience is deliberately opt-in. Ordinary itch.io builds expose no cheats.
const debug = new URLSearchParams(location.search).get('debug') === '1' ? {
  getState: () => structuredClone(state),
  getPlayer: () => ({ x: player.x, y: player.y, moving: player.moving, target: player.target ? { ...player.target } : null }),
  getCamera: () => renderer.getCamera(),
  teleport(id) {
    const site = siteFor(id);
    if (!site || !unlocked(site.id)) return false;
    for (const dialog of dialogs) if (dialog.open) dialog.close();
    player.stop(); player.x = site.terminal.x; player.y = site.terminal.y + 35;
    pendingInteraction = null; discoverNearby(); updateHUD(); return true;
  },
  setTime(minutes) { if (Number.isFinite(minutes)) { state.time = Math.max(1040, minutes); discoverNearby(); updateHUD(); persist(); } },
  reset() { clearSave(); saved = null; startGame(true); },
  finish(which = 'mixed') {
    this.reset(); this.setTime(1450);
    for (const level of LEVELS) {
      state.discovered[level.id] = true;
      state.inspected[level.id] = { logs: true, config: true };
      choose(state, level.id, which === 'fix' || which === 'allFix' ? 'fix' : which === 'exploit' || which === 'allExploit' ? 'exploit' : level.id % 2 ? 'fix' : 'exploit');
    }
    updateHUD(); persist(); showEnding();
  },
} : null;
if (debug) window.__maintainer = debug;
refreshTitle(); updateHUD(); requestAnimationFrame(frame);
