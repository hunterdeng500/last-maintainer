/** Original, procedural pixel town. World coordinates and art share one layout. */
import { getNightMarketInfo } from './levels.js';
export const WORLD = Object.freeze({ width: 1728, height: 1152 });
export const SITES = [
  { id: 1, x: 290, y: 310, terminal: { x: 410, y: 416 } },
  { id: 2, x: 290, y: 825, terminal: { x: 410, y: 915 } },
  { id: 3, x: 850, y: 310, terminal: { x: 970, y: 416 } },
  { id: 4, x: 850, y: 825, terminal: { x: 970, y: 915 } },
  { id: 5, x: 1410, y: 310, terminal: { x: 1530, y: 416 } },
  { id: 6, x: 1410, y: 825, terminal: { x: 1530, y: 915 } },
];
export const NPCS = [
  { id: 'moss', name: '园丁 M-03', x: 178, y: 520, lines: ['人类撤离后，我仍每天给花浇水。今天的花开得很好。', '杂货铺的账本正在倒着数。路边发光的终端可以查日志。'] },
  { id: 'copper', name: '巡检 C-07', x: 760, y: 662, lines: ['欢迎进入中庭。机房的门开了一半，缓存里的大个子却一直没走。', '修复或利用都能让通行系统记录你的处理结果。选择留在城市里。'] },
  { id: 'pip', name: '配送 P-02', x: 1300, y: 520, lines: ['配送路线已更新。请小心训练场：一个很小的跳跃指令，也会飞得很高。', '工坊的两个测试机器人，总在同一秒恢复电量。也许它们共享了什么。'] },
];

const C = {
  grass: '#78994c', grassLight: '#8da65c', grassDark: '#6b8c45', grassDeep: '#536f3b',
  dirt: '#c9b183', dirtLight: '#dbc79d', dirtDark: '#b29a73', ink: '#303c38',
  wood: '#986b48', woodLight: '#c49662', woodDark: '#5a4936', leaf: '#4e7644',
  leafLight: '#6e934b', leafDark: '#36573c', water: '#477e89', waterLight: '#75b0ac',
  cream: '#f2dfb6', mint: '#b7e4a3', amber: '#f3c372', purple: '#be92c8',
};
const LABELS = ['负金币杂货铺', '午夜折扣夜市', '半开的机房', '缓存竞技场', '跃迁训练场', '双生工坊'];
const SUBLABELS = ['INT16 · 自动结算', '23:00 — 23:59', 'DOOR · 自动门控', 'CACHE · 训练系统', 'UNITS · 跳跃测试', 'COPY · 复制测试'];
const BENCH = { x: 260, y: 580 };
const RIVERS = [560, 1120];
const LAMPS = [
  { x: 106, y: 542 }, { x: 480, y: 646 }, { x: 652, y: 542 },
  { x: 1036, y: 646 }, { x: 1212, y: 542 }, { x: 1620, y: 646 },
  ...SITES.map(s => ({ x: s.x - 132, y: s.y + 108 })),
];
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const completed = state => Object.values(state?.choices || {}).filter(v => v === 'fix' || v === 'exploit').length;
const rectHit = (x, y, a, b, w, h) => x >= a && x <= a + w && y >= b && y <= b + h;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function rand(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function poly(ctx, points, color) {
  ctx.fillStyle = color; ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)));
  ctx.closePath(); ctx.fill();
}
function text(ctx, value, x, y, size = 12, color = C.cream, align = 'center') {
  ctx.font = `600 ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(value, Math.round(x), Math.round(y));
}
function makeCanvas(width, height) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  return canvas;
}

export function getRegion(x) { return x < 584 ? 0 : x < 1144 ? 1 : 2; }
export function getNPCPosition(npc, elapsed = 0) {
  return { x: npc.x + Math.round(Math.sin(elapsed * 0.00038 + npc.x) * 15), y: npc.y + Math.round(Math.cos(elapsed * 0.0003 + npc.x) * 7) };
}

// Blocking trees stay out of roads, plazas, terminals and bridge approaches.
const TREES = (() => {
  const out = [], random = rand(19024);
  for (let region = 0; region < 3; region++) {
    const offset = region * 560;
    const rows = [
      [66, 112], [138, 84], [222, 92], [318, 72], [411, 110], [486, 164],
      [60, 248], [96, 368], [486, 338], [70, 453], [491, 464],
      [74, 722], [111, 843], [488, 763], [495, 1010], [64, 1012],
      [145, 1088], [225, 1080], [321, 1098], [414, 1073],
    ];
    for (const [x, y] of rows) out.push({ x: x + offset + Math.floor(random() * 15), y: y + Math.floor(random() * 15), variant: Math.floor(random() * 4), scale: random() > .8 ? 1.2 : 1 });
  }
  return out;
})();

export function isBlocked(x, y, state = {}) {
  if (x < 30 || y < 46 || x > WORLD.width - 30 || y > WORLD.height - 30) return true;
  for (let index = 0; index < RIVERS.length; index++) {
    if (x >= RIVERS[index] - 2 && x <= RIVERS[index] + 50) {
      if (y < 560 || y > 624 || completed(state) < (index + 1) * 2) return true;
    }
  }
  // The whole eastern bank is locked, including externally supplied coordinates.
  if (x > 608 && completed(state) < 2) return true;
  if (x > 1168 && completed(state) < 4) return true;
  for (const site of SITES) {
    const width = site.id === 2 ? 246 : site.id === 4 ? 218 : 208;
    if (rectHit(x, y, site.x - width / 2, site.y - 64, width, 102)) return true;
    if (rectHit(x, y, site.terminal.x - 10, site.terminal.y - 18, 20, 23)) return true;
  }
  for (const tree of TREES) if (rectHit(x, y, tree.x - 10, tree.y - 9, 20, 17)) return true;
  if (rectHit(x, y, BENCH.x - 35, BENCH.y - 15, 70, 15)) return true;
  return false;
}

export function getNearby(player, state = {}) {
  const candidates = SITES.filter(s => !((getRegion(s.x) === 1 && completed(state) < 2) || (getRegion(s.x) === 2 && completed(state) < 4)))
    .map(s => ({ site: s, distance: dist(player, s.terminal) })).sort((a, b) => a.distance - b.distance);
  if (candidates[0]?.distance < 90) return { type: 'site', id: candidates[0].site.id };
  for (const npc of NPCS) if (dist(player, npc) < 60) return { type: 'npc', id: npc.id };
  if (dist(player, BENCH) < 66) return { type: 'bench' };
  for (let index = 0; index < RIVERS.length; index++) {
    if (completed(state) < (index + 1) * 2 && dist(player, { x: RIVERS[index] + 24, y: 592 }) < 108) return { type: 'gate', id: index + 1 };
  }
  return null;
}

function flower(ctx, x, y, color, variant = 0) {
  rect(ctx, x, y + 2, 2, 6, C.grassDeep); rect(ctx, x - 2, y + 5, 4, 2, C.leaf);
  rect(ctx, x - 2, y - 2, 6, 4, color); rect(ctx, x, y - 4, 2, 8, color);
  rect(ctx, x, y - 1, 2, 2, variant ? '#f6d784' : '#fff1ba');
}
function crate(ctx, x, y, w = 24, color = C.woodLight) {
  rect(ctx, x + 4, y + 6, w, 18, '#42563d66'); rect(ctx, x, y - 13, w, 26, C.woodDark);
  rect(ctx, x + 2, y - 11, w - 4, 22, color);
  for (let row = -7; row < 11; row += 7) rect(ctx, x + 3, y + row, w - 6, 2, C.wood);
  rect(ctx, x + 3, y - 11, 3, 22, '#d1a774'); rect(ctx, x + w - 7, y - 11, 3, 22, '#b27d50');
}
function pot(ctx, x, y, color = '#e7b66c') {
  rect(ctx, x - 8, y - 6, 16, 5, '#c38856'); rect(ctx, x - 6, y - 1, 12, 11, '#ae6e48');
  rect(ctx, x - 4, y, 3, 8, '#ce9865');
  flower(ctx, x - 3, y - 12, color); flower(ctx, x + 3, y - 17, color, 1);
}
function fence(ctx, x, y, count = 5) {
  rect(ctx, x, y - 14, count * 20, 4, '#ab8659'); rect(ctx, x, y - 4, count * 20, 4, '#805d41');
  for (let i = 0; i <= count; i++) {
    rect(ctx, x + i * 20, y - 24, 6, 29, '#69543c');
    rect(ctx, x + i * 20, y - 24, 4, 26, '#c8a36f'); rect(ctx, x + i * 20, y - 26, 4, 2, '#e0c492');
  }
}
function treeSprite(variant) {
  const canvas = makeCanvas(100, 124), ctx = canvas.getContext('2d');
  const autumn = variant === 3;
  const dark = autumn ? '#6e7141' : C.leafDark, mid = autumn ? '#9a984c' : C.leaf;
  const light = autumn ? '#bdac62' : C.leafLight;
  rect(ctx, 26, 108, 64, 9, '#34583b35'); rect(ctx, 38, 113, 43, 6, '#34583b35');
  rect(ctx, 46, 73, 12, 41, '#5c4b35'); rect(ctx, 48, 76, 4, 36, '#a27b4b');
  rect(ctx, 42, 105, 6, 10, '#5c4b35'); rect(ctx, 57, 103, 5, 11, '#5c4b35');
  poly(ctx, [[16, 67], [11, 48], [20, 45], [20, 31], [32, 25], [35, 14], [56, 7], [76, 22], [81, 40], [90, 47], [86, 69], [72, 85], [49, 91], [28, 83]], dark);
  poly(ctx, [[16, 55], [23, 33], [38, 23], [44, 13], [63, 16], [77, 29], [79, 48], [84, 55], [69, 73], [47, 79], [26, 70]], mid);
  poly(ctx, [[23, 45], [31, 31], [44, 28], [48, 18], [65, 23], [71, 37], [62, 47], [40, 42], [37, 52]], light);
  rect(ctx, 23, 52, 15, 5, light); rect(ctx, 48, 58, 14, 6, light); rect(ctx, 67, 43, 9, 5, light);
  rect(ctx, 30, 69, 10, 4, dark); rect(ctx, 65, 65, 12, 5, dark); rect(ctx, 42, 46, 8, 4, mid);
  if (variant === 1) for (const [x, y] of [[30, 46], [57, 31], [70, 54], [49, 66]]) { rect(ctx, x, y, 5, 6, '#ca7955'); rect(ctx, x, y, 2, 2, '#edb779'); }
  return canvas;
}

function windowBox(ctx, x, y, w = 30, h = 31, cool = false) {
  rect(ctx, x - 3, y - 3, w + 6, h + 8, '#775c42'); rect(ctx, x, y, w, h, cool ? '#74aaa2' : '#d9b875');
  rect(ctx, x + 3, y + 3, w - 6, h - 6, cool ? '#507d7b' : '#edcd8c');
  rect(ctx, x + 4, y + 3, 4, h - 6, cool ? '#acd0b7' : '#f6e0a9');
  rect(ctx, x + w / 2 - 2, y, 4, h, '#8b6d49'); rect(ctx, x, y + h / 2 - 2, w, 4, '#8b6d49');
  rect(ctx, x - 5, y + h + 1, w + 10, 5, '#bf9864');
}
function roof(ctx, x, y, w, h, palette = ['#8a4f3d', '#b96c4b', '#cc8156']) {
  const [dark, base, light] = palette;
  poly(ctx, [[x - 10, y + h + 9], [x + 23, y + 9], [x + w - 21, y + 9], [x + w + 14, y + h + 9]], '#423c3280');
  poly(ctx, [[x - 9, y + h], [x + 24, y], [x + w - 24, y], [x + w + 9, y + h]], dark);
  poly(ctx, [[x - 4, y + h - 8], [x + 27, y + 5], [x + w - 27, y + 5], [x + w + 4, y + h - 8]], base);
  for (let row = 10; row < h - 6; row += 12) {
    const inset = 24 * (1 - row / h);
    rect(ctx, x + inset, y + row, w - inset * 2, 3, light);
    rect(ctx, x + inset, y + row + 9, w - inset * 2, 2, dark);
    for (let xx = x + inset + (row % 24 ? 10 : 0); xx < x + w - inset - 5; xx += 20) rect(ctx, xx, y + row + 3, 2, 6, dark);
  }
  rect(ctx, x - 9, y + h - 5, w + 18, 6, dark); rect(ctx, x + 24, y, w - 48, 4, light);
}
function buildingSprite(site) {
  const canvas = makeCanvas(360, 272), ctx = canvas.getContext('2d');
  // Site origin is (180, 166), with its front edge at y=204.
  const ox = 180, oy = 166;
  rect(ctx, 78, 158, 223, 61, '#40563738'); rect(ctx, 93, 207, 196, 10, '#40563725');
  if (site.id === 2) {
    // Small, permanently staffed automatic market. Three canopies share a clock.
    for (let i = 0; i < 3; i++) {
      const x = 55 + i * 84;
      rect(ctx, x + 4, 119, 70, 80, '#795c43'); rect(ctx, x + 9, 133, 60, 39, '#4d5349');
      rect(ctx, x + 5, 174, 70, 28, '#bb8c60');
      for (let a = 12; a < 66; a += 16) rect(ctx, x + a, 177, 2, 23, '#8f694a');
      rect(ctx, x + 2, 169, 77, 6, '#dfba7a');
      poly(ctx, [[x - 3, 142], [x + 13, 104], [x + 64, 104], [x + 81, 142]], '#685169');
      for (let a = 0; a < 6; a++) {
        const stripe = a % 2 ? '#e7c5a1' : ['#ab6c83', '#d29b58', '#749e8d'][i];
        poly(ctx, [[x - 3 + a * 14, 142], [x + 13 + a * 8.5, 104], [x + 21.5 + a * 8.5, 104], [x + 11 + a * 14, 142]], stripe);
        rect(ctx, x - 3 + a * 14, 142, 14, 8 + (a % 2 ? 0 : 3), stripe);
      }
      for (let a = 0; a < 4; a++) {
        rect(ctx, x + 14 + a * 12, 157, 8, 10, ['#dfa866', '#8dab61', '#b886af'][i]);
        rect(ctx, x + 16 + a * 12, 153, 4, 4, '#e5d5aa');
      }
    }
    rect(ctx, 151, 73, 58, 32, '#574b42'); rect(ctx, 156, 77, 48, 23, '#d2b77b');
    text(ctx, '夜 市', 180, 89, 14, '#524737');
    for (let x = 52; x < 320; x += 42) { rect(ctx, x, 91, 3, 15, '#645340'); rect(ctx, x - 5, 100, 13, 17, '#e4ab60'); rect(ctx, x - 2, 102, 5, 12, '#f6d58b'); }
    rect(ctx, 49, 90, 269, 2, '#675d48');
    return canvas;
  }
  if (site.id === 4) {
    // Roofless, overgrown training amphitheatre.
    poly(ctx, [[64, 172], [86, 123], [129, 100], [232, 100], [277, 124], [297, 172], [271, 201], [87, 201]], '#767f70');
    poly(ctx, [[77, 169], [97, 130], [134, 114], [228, 114], [266, 135], [282, 170], [263, 191], [96, 191]], '#b0b097');
    poly(ctx, [[94, 162], [113, 134], [141, 125], [220, 125], [251, 141], [265, 166], [248, 186], [110, 186]], '#cbbd94');
    for (let i = 0; i < 5; i++) { rect(ctx, 83 + i * 42, 116, 36, 14, '#a3a68c'); rect(ctx, 86 + i * 42, 115, 29, 3, '#c6c4a4'); }
    rect(ctx, 137, 64, 89, 53, '#4c5a4e'); rect(ctx, 143, 70, 77, 39, '#253e3c');
    rect(ctx, 147, 74, 69, 2, '#54887a'); text(ctx, 'ARENA / 04', 181, 86, 10, '#94c5a1');
    rect(ctx, 110, 118, 8, 71, '#8e8569'); rect(ctx, 247, 118, 8, 71, '#8e8569');
    poly(ctx, [[112, 119], [112, 155], [137, 164], [137, 126]], '#b77b67');
    poly(ctx, [[249, 119], [249, 155], [224, 164], [224, 126]], '#b77b67');
    for (const [x,y] of [[77,166],[268,171],[96,119]]) { rect(ctx,x,y,15,8,C.leaf); rect(ctx,x+7,y-5,12,8,C.leafLight); }
    return canvas;
  }
  const palettes = {
    1: ['#824c3d', '#b96c4b', '#cf8656'],
    3: ['#3e625e', '#62928a', '#85aaa0'],
    5: ['#657044', '#8e975e', '#b1b879'],
    6: ['#5f556b', '#86738a', '#ad919f'],
  };
  rect(ctx, 77, 123, 208, 84, '#695441'); rect(ctx, 82, 127, 198, 73, site.id === 3 ? '#c8c8ac' : '#dec79c');
  rect(ctx, 83, 127, 196, 9, '#b89d78'); rect(ctx, 84, 191, 196, 10, '#aa8a63');
  for (let y = 144; y < 196; y += 14) rect(ctx, 85, y, 193, 2, '#c3aa82');
  for (const x of [80, 147, 211, 275]) rect(ctx, x, 127, 6, 73, '#9c7952');
  rect(ctx, 159, 153, 41, 48, '#775d43'); rect(ctx, 164, 157, 31, 44, '#566052');
  rect(ctx, 168, 161, 23, 21, '#738977'); rect(ctx, 187, 184, 4, 4, '#e9bd6e');
  rect(ctx, 151, 202, 56, 8, '#c1b397'); rect(ctx, 145, 210, 68, 6, '#aca58c');
  windowBox(ctx, 100, 153, 29, 29, site.id === 3); windowBox(ctx, 229, 153, 29, 29, site.id === 3);
  roof(ctx, 72, 38, 218, 101, palettes[site.id]);
  rect(ctx, 234, 29, 23, 45, '#7d7563'); rect(ctx, 237, 30, 17, 39, '#b3a88a'); rect(ctx, 231, 25, 29, 7, '#d0c2a2');
  for (let y=38; y<68; y+=10) rect(ctx, 238, y, 16, 2, '#8f8772');
  if (site.id === 1) {
    rect(ctx, 139, 80, 82, 31, '#78533d'); rect(ctx, 143, 84, 74, 23, '#ead2a1');
    text(ctx, '日 用 杂 货', 180, 96, 12, '#694e35');
    for (let i = 0; i < 9; i++) { rect(ctx, 87 + i * 21, 139, 21, 9, i % 2 ? '#e3d1a7' : '#af6f4c'); rect(ctx, 87 + i * 21, 148, 21, i % 2 ? 4 : 7, i % 2 ? '#d3be91' : '#955f45'); }
    pot(ctx, 95, 201, '#f0bd65'); pot(ctx, 268, 201, '#d59196');
  } else if (site.id === 3) {
    rect(ctx, 140, 76, 83, 35, '#466664'); rect(ctx, 145, 81, 73, 24, '#293f40');
    text(ctx, 'SYSTEM / 03', 182, 94, 10, '#b8d5b0');
    for (let i=0; i<4; i++) { rect(ctx, 94, 171+i*5, 34, 3, '#5c716b'); rect(ctx, 98+i*8, 161, 4, 4, '#afc779'); }
    rect(ctx, 282, 153, 18, 41, '#6e8178'); rect(ctx, 286, 157, 10, 16, '#3e5853');
    rect(ctx, 280, 151, 22, 4, '#b4bca2');
  } else if (site.id === 5) {
    rect(ctx, 146, 75, 71, 40, '#72764d'); rect(ctx, 151, 80, 61, 30, '#d5d3a5');
    text(ctx, '↑  跃 迁', 181, 95, 15, '#687148');
    rect(ctx, 260, 154, 30, 5, '#687950');
    for (let i=0;i<5;i++) { rect(ctx, 282, 147-i*18, 4, 18, '#8c9274'); rect(ctx, 274, 147-i*18, 12, 3, '#d6c59a'); }
    pot(ctx, 95, 201, '#b7c377');
  } else {
    rect(ctx, 142, 78, 78, 33, '#65556d'); rect(ctx, 146, 82, 70, 25, '#d7c6be');
    text(ctx, '双 生 工 坊', 181, 95, 12, '#6e596d');
    rect(ctx, 106, 38, 18, 23, '#887c86'); rect(ctx, 102, 34, 26, 6, '#c7b7ac');
    pot(ctx, 95, 201, '#bb96c8'); pot(ctx, 269, 201, '#bb96c8');
  }
  return canvas;
}

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 290, width: 960, height: 600 };
    this.treeSprites = [0, 1, 2, 3].map(treeSprite);
    this.buildings = SITES.map(site => ({ site, canvas: buildingSprite(site) }));
    this.terrain = this.createTerrain();
    this.resize(canvas.clientWidth || 960, canvas.clientHeight || 600);
  }

  resize(width = 960, height = 600) {
    // The caller supplies logical dimensions (600 high in the game). Keeping
    // that height on wide displays preserves the roofs above the player.
    this.canvas.width = Math.max(2, Math.round(width / 2) * 2);
    this.canvas.height = Math.max(2, Math.round(height / 2) * 2);
    this.camera.width = this.canvas.width; this.camera.height = this.canvas.height;
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.style.imageRendering = 'pixelated';
  }

  getCamera() { return { ...this.camera }; }

  screenToWorld(clientX, clientY) {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: (clientX - bounds.left) / bounds.width * this.canvas.width + this.camera.x, y: (clientY - bounds.top) / bounds.height * this.canvas.height + this.camera.y };
  }

  createTerrain() {
    const canvas = makeCanvas(WORLD.width, WORLD.height), ctx = canvas.getContext('2d'), random = rand(382163);
    rect(ctx, 0, 0, WORLD.width, WORLD.height, C.grass);
    // Low-frequency patches and sparse individual blades make the ground quiet.
    for (let i=0;i<850;i++) {
      const x = Math.floor(random()*WORLD.width/4)*4, y = Math.floor(random()*WORLD.height/4)*4;
      rect(ctx,x,y,16+Math.floor(random()*8)*4,8+Math.floor(random()*6)*4,random()>.5?'#829e52':'#729348');
    }
    for (let i=0;i<6500;i++) {
      const x = Math.floor(random()*WORLD.width/2)*2, y = Math.floor(random()*WORLD.height/2)*2;
      rect(ctx,x,y,2,random()>.8?5:2,random()>.5?'#9aaf64':'#608643');
      if (random()>.75) rect(ctx,x+3,y+2,2,3,'#608643');
    }
    // Sun-warmed paved main street, with a double stone curb.
    this.path(ctx, 30, 554, WORLD.width-60, 76, random);
    for (let region=0;region<3;region++) {
      this.path(ctx, 400+region*560, 262, 48, 712, random);
      this.path(ctx, 246+region*560, 501, 201, 55, random);
      for (const y of [310,825]) this.path(ctx, 143+region*560, y+30, 294, 111, random);
      // Inset garden beds, with orderly flowers and stepping stones.
      for (const y of [480,1008]) {
        rect(ctx, 172+region*560, y, 166, 26, '#5d7842'); rect(ctx, 176+region*560, y+3, 158, 21, '#786b43');
        for (let col=0;col<13;col++) {
          flower(ctx,182+region*560+col*12,y+9,['#dfaa80','#e9ca80','#c5b2d1'][region],col%2);
          if (col%2===0) flower(ctx,186+region*560+col*12,y+19,'#e4d7a0');
        }
        rect(ctx,169+region*560,y+26,172,4,'#d0ba86');
      }
      fence(ctx, 137+region*560, 465, 9); fence(ctx, 137+region*560, 992, 9);
      for (let i=0;i<7;i++) { rect(ctx, 442+region*560, 310+i*31, 5, 13, '#9f9c72'); rect(ctx, 449+region*560, 318+i*31, 4, 3, '#c2bd8b'); }
      for (let i=0;i<6;i++) { rect(ctx, 357+region*560, 650+i*27, 25, 14, '#a5a17c'); rect(ctx, 359+region*560, 650+i*27, 22, 10, '#c6bd96'); }
      // Small maintenance garden beside the route, with original pixel props.
      rect(ctx, 163+region*560, 668, 128, 45, '#9a865a');
      for (let row=0;row<3;row++) for (let col=0;col<8;col++) {
        rect(ctx, 170+region*560+col*15, 674+row*12, 11, 5, '#7b704a');
        rect(ctx, 174+region*560+col*15, 670+row*12, 3, 7, '#9cb468');
        rect(ctx, 171+region*560+col*15, 672+row*12, 9, 3, '#b5c77b');
      }
      fence(ctx, 158+region*560, 724, 7);
      for (const [x,y] of [[121,516],[470,688],[125,947],[459,492]]) {
        rect(ctx,x+region*560,y,18,9,'#6b8050'); rect(ctx,x+region*560+3,y-4,12,7,'#97a572');
      }
    }
    // Rivers have a stone embankment. Collision and bridge art use the same bounds.
    for (const x of RIVERS) {
      rect(ctx,x-8,0,64,WORLD.height,'#426f65'); rect(ctx,x-5,0,58,WORLD.height,'#a1ab87');
      rect(ctx,x,0,48,WORLD.height,C.water); rect(ctx,x,0,7,WORLD.height,'#386b78');
      rect(ctx,x+42,0,6,WORLD.height,'#649795');
      for (let y=0;y<WORLD.height;y+=24) {
        rect(ctx,x-8,y,7,3,'#6c8267'); rect(ctx,x+48,y+10,6,3,'#6c8267');
        if (y<524||y>650) { rect(ctx,x-14,y+5,3,10,C.leaf); rect(ctx,x+55,y+14,3,10,C.leaf); }
      }
      rect(ctx,x-14,552,76,80,'#5d5946'); rect(ctx,x-14,559,76,63,'#bca67b');
      for (let xx=x-10;xx<x+60;xx+=10) { rect(ctx,xx,559,8,63,'#d0b58a'); rect(ctx,xx+1,559,2,63,'#dec49b'); }
      for (const y of [550,628]) { rect(ctx,x-17,y,82,7,'#594d3c'); rect(ctx,x-17,y,82,3,'#c7b68c');
        for (const xx of [x-17,x+13,x+43,x+61]) { rect(ctx,xx,y-14,5,20,'#8c7653'); rect(ctx,xx,y-17,5,5,'#e0c995'); } }
    }
    // Rest point, mailboxes, stacked goods and a hand-drawn town sign.
    rect(ctx,223,578,81,11,'#48593830');
    rect(ctx,226,561,68,6,'#d3ad75'); rect(ctx,226,569,68,6,'#b58a59');
    rect(ctx,224,577,73,7,'#d3ad75'); rect(ctx,230,584,6,9,'#64523d'); rect(ctx,286,584,6,9,'#64523d');
    rect(ctx,230,556,5,25,'#755b3e'); rect(ctx,286,556,5,25,'#755b3e');
    for (const site of SITES) {
      crate(ctx,site.x-111,site.y+64); crate(ctx,site.x-86,site.y+76,22,'#c8a76d');
      pot(ctx,site.x+78,site.y+93,['#dfa76a','#d5a2ba','#a2c8ad'][getRegion(site.x)]);
      rect(ctx,site.x-132,site.y+75,5,28,'#7b6044'); rect(ctx,site.x-143,site.y+62,26,18,'#6b8280');
      rect(ctx,site.x-140,site.y+64,21,3,'#99b9aa'); rect(ctx,site.x-133,site.y+68,13,3,'#344d4c');
    }
    for (const [x,y] of [[78,583],[638,583],[1198,583]]) {
      rect(ctx,x,y-38,6,50,'#6e563b'); rect(ctx,x-27,y-43,60,26,'#775b3e'); rect(ctx,x-25,y-41,56,21,'#c7a16c');
      text(ctx,['苔原街','钟摆中庭','东部工坊'][Math.round((x-78)/560)],x+3,y-30,11,'#574b36');
    }
    // Distant boundary fence and scattered meadow flowers.
    for(let x=24;x<WORLD.width-20;x+=20) if(!RIVERS.some(rx=>x>rx-20&&x<rx+65)) { rect(ctx,x,41,5,18,'#8b8155'); rect(ctx,x,45,20,3,'#a19a6d'); }
    for (let i=0;i<175;i++) {
      const x=40+random()*(WORLD.width-80),y=75+random()*(WORLD.height-120);
      if (y>530&&y<660 || RIVERS.some(rx=>x>rx-25&&x<rx+75) || SITES.some(s=>Math.abs(x-s.x)<170&&Math.abs(y-s.y)<180)) continue;
      flower(ctx,x,y,['#e8d598','#d8a9b5','#b7cab3'][Math.floor(random()*3)]);
    }
    return canvas;
  }

  path(ctx, x, y, w, h, random) {
    rect(ctx,x-4,y-4,w+8,h+8,'#8a9368'); rect(ctx,x-2,y-2,w+4,h+4,'#b8ad83');
    rect(ctx,x,y,w,h,C.dirt);
    for(let yy=y+3;yy<y+h;yy+=17) {
      for(let xx=x+((yy-y)%34?2:16);xx<x+w-5;xx+=30) {
        const ww=Math.min(25,x+w-xx-1),hh=Math.min(12,y+h-yy-1);
        if(ww>0&&hh>0) {rect(ctx,xx,yy,ww,hh,random()>.48?'#d2bc90':'#c3ac82');rect(ctx,xx,yy,ww,2,'#dec9a0');}
      }
    }
    for(let i=0;i<w*h/500;i++) rect(ctx,x+random()*w,y+random()*h,2+random()*3,2,'#b39e76');
  }

  drawWater(ctx, elapsed) {
    for(const x of RIVERS) for(let y=35;y<WORLD.height;y+=45) {
      if(y>525&&y<650)continue;
      const phase=elapsed*.00055+y*.1,xx=x+10+Math.sin(phase)*9;
      rect(ctx,xx,y+Math.sin(phase*.7)*4,15,2,'#8fc0b174');
      rect(ctx,x+20+Math.cos(phase)*9,y+18,9,2,'#a0cfbd55');
      if(Math.sin(phase)> .55)rect(ctx,xx+5,y-4,3,9,'#b6ddc177');
    }
  }

  drawRobot(ctx, x, y, elapsed, variant = 0, scale = 1) {
    ctx.save(); ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    const bob=Math.round(Math.sin(elapsed*.004+variant)*1.5),body=['#b8b997','#d8af78','#b1a5c1'][variant%3];
    rect(ctx,-10,0,23,6,'#40583b40'); rect(ctx,-8,-5,6,9,'#4e5c50'); rect(ctx,5,-5,6,9,'#4e5c50');
    rect(ctx,-10,-25+bob,22,21,'#5c6758');rect(ctx,-8,-24+bob,18,18,body);
    rect(ctx,-13,-21+bob,4,13,'#9a9f7b');rect(ctx,13,-21+bob,4,13,'#9a9f7b');
    rect(ctx,-12,-42+bob,26,21,'#647563');rect(ctx,-10,-41+bob,22,17,body);
    rect(ctx,-7,-36+bob,16,8,'#3b5651');rect(ctx,-4,-34+bob,3,3,'#bcddad');rect(ctx,4,-34+bob,3,3,'#bcddad');
    rect(ctx,-1,-47+bob,3,6,'#6f775f');rect(ctx,-2,-49+bob,5,3,'#dfba78');
    rect(ctx,-3,-17+bob,8,6,'#718774');rect(ctx,-1,-15+bob,4,2,'#d3e2a4');
    if(variant===0){rect(ctx,-17,-11+bob,8,9,'#7d9c9b');rect(ctx,-21,-11+bob,5,3,'#7d9c9b');}
    ctx.restore();
  }

  drawPlayer(ctx, player, elapsed) {
    const x=Math.round(player.x),y=Math.round(player.y),up=player.facing==='up',side=player.facing==='left'||player.facing==='right';
    const step=player.moving?Math.round(Math.sin(elapsed*.017)*3):0,bob=player.moving?Math.abs(step)*.5:0;
    ctx.save();ctx.translate(x,y);
    if(player.facing==='left')ctx.scale(-1,1);
    rect(ctx,-10,0,24,6,'#2f493d50');rect(ctx,-7,-8,6,10+step,'#3a4c4c');rect(ctx,3,-8,6,10-step,'#3a4c4c');
    rect(ctx,-8,-1+step,7,4,'#554c3e');rect(ctx,3,-1-step,8,4,'#554c3e');
    rect(ctx,-9,-28-bob,20,22,'#3f6462');rect(ctx,-7,-28-bob,16,18,'#67958a');
    rect(ctx,-10,-23-bob,5,17,'#c89b6b');rect(ctx,8,-23-bob,5,17,'#d5ac7f');
    rect(ctx,-10,-25-bob,5,8,'#799e8c');rect(ctx,8,-25-bob,5,8,'#799e8c');
    rect(ctx,-5,-20-bob,12,14,'#b48e5c');rect(ctx,-3,-18-bob,8,10,'#d0af77');
    rect(ctx,8,-12-bob,4,9,'#6e563f');rect(ctx,11,-18-bob,3,13,'#b6c0a3');rect(ctx,10,-20-bob,7,4,'#c5c9ab');
    rect(ctx,-7,-41-bob,17,16,'#6d5140');rect(ctx,-5,-40-bob,14,14,up?'#6e5641':'#e2b785');
    if(!up){rect(ctx,side?6:-2,-34-bob,2,3,'#3e4036');if(!side)rect(ctx,5,-34-bob,2,3,'#3e4036');rect(ctx,2,-28-bob,5,2,'#b8805d');}
    rect(ctx,-8,-42-bob,18,5,'#795b3c');
    rect(ctx,-14,-44-bob,30,5,'#85663d');rect(ctx,-13,-47-bob,28,4,'#e0bc76');
    rect(ctx,-9,-56-bob,20,11,'#d3ab65');rect(ctx,-7,-58-bob,16,4,'#e9c889');rect(ctx,-9,-48-bob,20,3,'#8e7550');
    rect(ctx,7,-53-bob,3,5,'#87a683');
    if(up){rect(ctx,-8,-24-bob,18,17,'#9d7c50');rect(ctx,-5,-22-bob,12,12,'#c1a16c');rect(ctx,-2,-17-bob,5,4,'#8e7650');}
    ctx.restore();
  }

  drawTerminal(ctx, site, state, elapsed, nearby) {
    const {x,y}=site.terminal,choice=state.choices?.[site.id],color=choice==='fix'?C.mint:choice==='exploit'?C.purple:C.amber;
    rect(ctx,x-13,y+1,30,8,'#3d573a35');rect(ctx,x-8,y-11,17,17,'#687264');
    rect(ctx,x-14,y-37,28,29,'#4d5f52');rect(ctx,x-12,y-36,24,23,'#9aa88d');rect(ctx,x-9,y-33,18,16,'#324e49');
    rect(ctx,x-6,y-29,12,2,color);rect(ctx,x-6,y-24,8,2,color);rect(ctx,x-4,y-12,8,3,'#d0c9a4');
    rect(ctx,x-10,y+4,22,3,'#b2b38f');
    if(!choice){
      const bob=Math.round(Math.sin(elapsed*.003+site.id)*3),yy=y-59+bob;
      poly(ctx,[[x,yy-8],[x+9,yy],[x,yy+8],[x-9,yy]],'#594d38');
      poly(ctx,[[x,yy-6],[x+7,yy],[x,yy+6],[x-7,yy]],color);
      text(ctx,state.discovered?.[site.id]?'!':'?',x,yy,10,'#675436');
    }
    if(nearby?.type==='site'&&nearby.id===site.id){
      ctx.globalAlpha=.65+.2*Math.sin(elapsed*.006);rect(ctx,x-19,y+8,38,2,color);rect(ctx,x-19,y+3,2,7,color);rect(ctx,x+17,y+3,2,7,color);ctx.globalAlpha=1;
    }
  }

  drawAnomaly(ctx, site, state, elapsed) {
    const choice=state.choices?.[site.id],fixed=choice==='fix',exploited=choice==='exploit',x=site.x,y=site.y,t=elapsed*.001;
    const glow=fixed?C.mint:exploited?C.purple:C.amber;
    if(site.id===1){
      // The ledger visibly rolls over; exploitation leaves a refund fountain.
      rect(ctx,x-31,y+46,65,32,'#705a43');rect(ctx,x-27,y+49,57,23,'#374e43');
      text(ctx,fixed?'+ 032780':exploited?'+ 3 000':Math.sin(t*2)>0?'− 32756':'+ 32760',x+1,y+61,12,glow);
      const amount=fixed?2:exploited?9:5;
      for(let i=0;i<amount;i++) {
        const phase=(t*(exploited?1.1:.7)+i*.27)%1,xx=x-42+i*17+(exploited?Math.sin(t*2+i)*16:0),yy=y+89-(fixed?0:Math.sin(phase*Math.PI)*43);
        rect(ctx,xx-4,yy-6,8,10,'#9f7842');rect(ctx,xx-3,yy-7,6,9,'#e8bd65');rect(ctx,xx-1,yy-5,2,5,'#ffe0a0');
        if(!fixed&&i%2===0)text(ctx,exploited?'+':'−',xx,yy-17,12,glow);
      }
    } else if(site.id===2){
      // The physical schedule follows game time once repaired.
      const market=getNightMarketInfo(state.time ?? 1040);
      const open=fixed?(market.now>=market.start&&market.now<market.end+1):market.active;
      const display=fixed?(open?'正在营业':'准时休市'):exploited?'半价 × ∞':market.anomalous?'23:59':open?'半价营业中':'23:00 待开市';
      rect(ctx,x-54,y+49,110,36,'#684e53');rect(ctx,x-50,y+53,102,27,'#3a4142');text(ctx,display,x+1,y+66,14,glow);
      for(let i=0;i<5;i++) {
        const xx=x-78+i*39,yy=y+26;
        rect(ctx,xx-6,yy-10,13,17,!open?'#9b8471':i%2?'#dfa77c':'#c491ab');
        rect(ctx,xx-3,yy-8,6,12,!open?'#b3a187':'#f5d393');
        if(open&&!fixed&&Math.sin(t*3+i)>.3)rect(ctx,xx-9,yy+11,19,2,'#f3c78366');
      }
      if(exploited){crate(ctx,x-71,y+108,25,'#baa47d');text(ctx,'空',x-59,y+108,10,'#675d47');crate(ctx,x+45,y+108,25,'#baa47d');text(ctx,'空',x+57,y+108,10,'#675d47');}
    } else if(site.id===3){
      // Sliding leaves write competing positions until a mutex is installed.
      const opening=fixed?43:exploited?17+Math.sin(t*9)*2:12+Math.sin(t*13)*3;
      rect(ctx,x-26,y+44,55,40,'#576a60');rect(ctx,x-21,y+48,45,31,'#2b443f');
      rect(ctx,x-22-opening/2,y+48,23,31,exploited?'#a58cae':'#829d8a');rect(ctx,x+1+opening/2,y+48,23,31,exploited?'#9178a3':'#8fa892');
      for(let i=0;i<3;i++){rect(ctx,x-18-opening/2,y+53+i*7,14,2,'#b3bda1');rect(ctx,x+6+opening/2,y+53+i*7,14,2,'#bbc2a4');}
      rect(ctx,x-6,y+39,16,5,glow);text(ctx,fixed?'互斥 · 已同步':exploited?'维护员捷径':'开门 ↔ 关门',x,y+105,11,exploited?'#745b85':'#5b6850');
      if(fixed){rect(ctx,x-3,y+31,9,9,'#58745d');rect(ctx,x-1,y+29,5,5,C.mint);rect(ctx,x-2,y+33,7,6,C.mint);rect(ctx,x+1,y+35,2,3,'#58745d');}
      if(exploited){
        for(let i=0;i<7;i++)rect(ctx,x+8+i*8,y+78+Math.sin(i*.5)*5,5,3,'#b990c5');
        poly(ctx,[[x+68,y+77],[x+59,y+72],[x+59,y+82]],'#9c7eac');
        rect(ctx,x-30,y+56+Math.sin(t*7)*10,63,2,'#e2c2e5');
      }
      if(!fixed){for(let i=0;i<3;i++)rect(ctx,x-30+Math.sin(t*8+i)*8,y+51+i*11,6,3,'#e8b875');}
    } else if(site.id===4){
      const by=y+74+Math.sin(t*2)*5;
      if(fixed){
        rect(ctx,x-29,y+54,58,12,'#929e7d');rect(ctx,x-23,y+49,46,8,'#b5b99a');
        text(ctx,'已清除缓存',x,y+81,12,'#4c7255');
        for(const off of [-22,18])flower(ctx,x+off,y+100,'#e6d8a4');
      }else{
        const count=exploited?2:1;
        for(let j=0;j<count;j++){
          const bx=x+(exploited?(j?29:-29):0);
          ctx.globalAlpha=.7+Math.sin(t*5+j)*.15;
          rect(ctx,bx-22,by-35,44,30,'#806e96');rect(ctx,bx-29,by-28,58,20,'#9b84ad');
          rect(ctx,bx-18,by-48,36,20,'#b19dc2');rect(ctx,bx-24,by-54,9,16,'#d0b6c6');rect(ctx,bx+15,by-54,9,16,'#d0b6c6');
          rect(ctx,bx-10,by-40,5,5,'#eee3a4');rect(ctx,bx+6,by-40,5,5,'#eee3a4');
          for(let i=0;i<4;i++)rect(ctx,bx-24+i*13,by-10,9,8+(i%2)*4,'#9b84ad');
          ctx.globalAlpha=1;rect(ctx,bx-25,by-66,50,5,'#575d4e');rect(ctx,bx-23,by-65,exploited?46:3,3,'#d9a581');
        }
        text(ctx,exploited?'掉落 × 2':'HP 3% · 仍然存活',x,y+107,11,'#765e80');
        if(exploited){crate(ctx,x-70,y+100,24,'#c3a764');crate(ctx,x+53,y+100,24,'#c3a764');}
      }
    } else if(site.id===5){
      rect(ctx,x-41,y+65,83,18,'#667c65');rect(ctx,x-37,y+61,75,15,'#9cae83');rect(ctx,x-29,y+62,59,8,'#cfbf85');
      for(let i=0;i<5;i++)rect(ctx,x-30+i*14,y+77,6,10,'#5f705d');
      const phase=(t*.7)%1,height=fixed?Math.sin(phase*Math.PI)*17:Math.sin(phase*Math.PI)*(exploited?132:108);
      this.drawRobot(ctx,x,y+57-height,elapsed,1,.65);
      if(!fixed) {
        for(let i=0;i<5;i++)rect(ctx,x-2,y+49-height+i*13,4,7,'#ede0a377');
        text(ctx,exploited?'↑ 快速通道':'120 cm → 120 m',x,y+108,12,exploited?'#795b86':'#6b7050');
      }else text(ctx,'1.2 m · 平稳落地',x,y+108,12,'#537951');
    } else {
      const yy=y+81,synced=!fixed,a=fixed?Math.sin(t*2)*3:Math.sin(t*4)*4;
      this.drawRobot(ctx,x-36,yy+a,elapsed,2,.8);this.drawRobot(ctx,x+37,yy+(synced?a:Math.cos(t*2)*3),elapsed+(fixed?900:0),2,.8);
      if(synced){
        for(let i=0;i<12;i++)rect(ctx,x-24+i*5,yy-22+Math.sin(t*5+i*.6)*3,3,3,exploited?'#c6a1d0':'#d6b780');
        const hp=exploited?31:14+Math.round(Math.sin(t*2)*13);
        for(const xx of [x-50,x+23]){rect(ctx,xx,yy-54,33,5,'#536453');rect(ctx,xx+1,yy-53,hp,3,glow);}
        text(ctx,exploited?'一瓶药 · 双份补给':'HP ↔ HP',x,y+108,11,'#7e6583');
      }else{
        for(const xx of [x-50,x+23]){rect(ctx,xx,yy-54,33,5,'#536453');rect(ctx,xx+1,yy-53,29,3,C.mint);}
        text(ctx,'独立运行 · 各自安好',x,y+108,11,'#537951');
      }
    }
  }

  drawLamp(ctx, lamp, night) {
    rect(ctx,lamp.x+3,lamp.y+1,14,5,'#3a52382b');rect(ctx,lamp.x-2,lamp.y-58,5,61,'#58634e');
    rect(ctx,lamp.x-7,lamp.y+1,15,5,'#8b9070');rect(ctx,lamp.x-7,lamp.y-64,16,5,'#545e49');
    rect(ctx,lamp.x-6,lamp.y-59,14,18,'#8c8056');rect(ctx,lamp.x-3,lamp.y-57,8,13,night>.1?'#ffdda0':'#e2c48b');
    rect(ctx,lamp.x-7,lamp.y-42,16,4,'#5b634b');rect(ctx,lamp.x-3,lamp.y-68,7,4,'#666e50');
  }

  drawGates(ctx,state,elapsed) {
    for(let index=0;index<RIVERS.length;index++) {
      const x=RIVERS[index]+24,locked=completed(state)<(index+1)*2;
      if(locked){
        rect(ctx,x-5,561,10,64,'#725f48');
        for(let y=564;y<624;y+=12){rect(ctx,x-5,y,10,7,'#dab77a');rect(ctx,x-2,y+1,4,5,'#eed39a');}
        rect(ctx,x-16,582,32,25,'#615b47');rect(ctx,x-13,585,26,19,'#bd9c65');
        rect(ctx,x-5,585,10,8,'#625d48');rect(ctx,x-6,591,12,9,'#6e6249');rect(ctx,x-1,594,3,4,'#e2c48d');
        text(ctx,`处理 ${(index+1)*2} 处后通行`,x,534,11,'#f2dfaf');
      }else{
        rect(ctx,x-5,547,10,8,'#b9d89f');rect(ctx,x-5,626,10,8,'#b9d89f');
      }
      if(locked&&Math.sin(elapsed*.002)>.25){rect(ctx,x-3,574,6,3,'#ffdb94');}
    }
  }

  drawLabels(ctx,state,player,elapsed) {
    for(const site of SITES){
      const region=getRegion(site.x),locked=region===1?completed(state)<2:region===2?completed(state)<4:false;
      const choice=state.choices?.[site.id],x=site.x,y=site.y-160;
      const w=126;
      rect(ctx,x-w/2+3,y+4,w,27,'#334a3638');rect(ctx,x-w/2,y,w,27,'#efe0bce8');
      rect(ctx,x-w/2,y,w,3,'#c9aa73');rect(ctx,x-w/2,y+24,w,3,'#947b52');
      text(ctx,LABELS[site.id-1],x,y+14,13,locked?'#8b8971':'#4f5a43');
      if(choice){
        const color=choice==='fix'?'#b9dba5':'#cbb3ce';rect(ctx,x-34,y+33,68,19,'#425342d9');
        text(ctx,choice==='fix'?'✓ 已修复':'↗ 已利用',x,y+43,10,color);
      }else if(!locked&&dist(player,site)<280){
        text(ctx,SUBLABELS[site.id-1],x,y+41,9,'#e2e4bc');
      }
    }
  }

  render(state, player, elapsed = 0, { mode = 'playing', target = null } = {}) {
    const ctx=this.ctx,width=this.canvas.width,height=this.canvas.height;
    const focus=mode==='title'?{x:500,y:430}:player;
    this.camera.x=Math.round(clamp(focus.x-width*.5,0,Math.max(0,WORLD.width-width)));
    this.camera.y=Math.round(clamp(focus.y-height*(mode==='title'?.5:.7),0,Math.max(0,WORLD.height-height)));
    const camera=this.camera;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
    rect(ctx,0,0,width,height,C.grassDeep);ctx.save();ctx.translate(-camera.x,-camera.y);
    ctx.drawImage(this.terrain,0,0);this.drawWater(ctx,elapsed);
    const minute=((state.time??1040)%1440+1440)%1440;
    const night=minute>=1080?clamp((minute-1080)/180,0,.72):minute<300?.72:minute<420?(.72*(420-minute)/120):0;
    const nearby=getNearby(player,state),entities=[];
    for(const building of this.buildings){const s=building.site;entities.push({y:s.y+38,draw:()=>ctx.drawImage(building.canvas,s.x-180,s.y-166)});entities.push({y:s.y+106,draw:()=>this.drawAnomaly(ctx,s,state,elapsed)});entities.push({y:s.terminal.y+6,draw:()=>this.drawTerminal(ctx,s,state,elapsed,nearby)});}
    for(const tree of TREES) {
      if(tree.x<camera.x-110||tree.x>camera.x+width+110||tree.y<camera.y-20||tree.y>camera.y+height+130)continue;
      entities.push({y:tree.y,draw:()=>{
        if(Math.abs(player.x-tree.x)<38&&player.y<tree.y&&player.y>tree.y-94)ctx.globalAlpha=.48;
        ctx.drawImage(this.treeSprites[tree.variant],tree.x-50*tree.scale,tree.y-114*tree.scale,100*tree.scale,124*tree.scale);ctx.globalAlpha=1;
      }});
    }
    for(const npc of NPCS) {
      const pos=getNPCPosition(npc,elapsed),region=getRegion(npc.x);
      if(region>0&&completed(state)<region*2)continue;
      entities.push({y:pos.y,draw:()=>{this.drawRobot(ctx,pos.x,pos.y,elapsed,NPCS.indexOf(npc));if(dist(player,pos)<115){rect(ctx,pos.x-37,pos.y-71,74,17,'#3e5643d9');text(ctx,npc.name,pos.x,pos.y-63,10,'#e2dec1');}}});
    }
    for(const lamp of LAMPS)entities.push({y:lamp.y,draw:()=>this.drawLamp(ctx,lamp,night)});
    if(target){
      const s=4+Math.sin(elapsed*.008)*2;ctx.strokeStyle='#fbdf9c';ctx.lineWidth=2;ctx.strokeRect(Math.round(target.x-s),Math.round(target.y-s/2),Math.round(s*2),Math.round(s));
    }
    entities.push({y:player.y,draw:()=>this.drawPlayer(ctx,player,elapsed)});
    entities.sort((a,b)=>a.y-b.y);for(const entity of entities)entity.draw();
    this.drawGates(ctx,state,elapsed);
    // Small drifting leaves and fireflies tie the still background to the clock.
    for(let i=0;i<15;i++){
      const x=(i*137+elapsed*.012)%WORLD.width,y=130+i*71+Math.sin(elapsed*.0007+i)*24;
      rect(ctx,x,y,4,2,i%3?'#e1cb8b70':'#d5e1a070');
    }
    ctx.restore();
    if(night>0){rect(ctx,0,0,width,height,`rgba(29,43,67,${night*.58})`);}
    // Warm windows and pools of light are painted after the cool night tint.
    if(night>.03){
      ctx.save();ctx.translate(-camera.x,-camera.y);
      for(const lamp of LAMPS){
        const gradient=ctx.createRadialGradient(lamp.x,lamp.y-18,5,lamp.x,lamp.y-18,75);
        gradient.addColorStop(0,`rgba(255,207,116,${night*.22})`);gradient.addColorStop(1,'rgba(255,207,116,0)');
        ctx.fillStyle=gradient;ctx.fillRect(lamp.x-75,lamp.y-93,150,150);rect(ctx,lamp.x-3,lamp.y-57,8,13,'#ffdfa1');
      }
      ctx.restore();
    }
    ctx.save();ctx.translate(-camera.x,-camera.y);this.drawLabels(ctx,state,player,elapsed);ctx.restore();
    // Subtle vignette keeps the playable center bright without muddying pixel art.
    const vignette=ctx.createRadialGradient(width*.5,height*.46,Math.min(width,height)*.3,width*.5,height*.46,Math.max(width,height)*.7);
    vignette.addColorStop(0,'rgba(26,42,35,0)');vignette.addColorStop(1,'rgba(26,42,35,.14)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
  }
}
