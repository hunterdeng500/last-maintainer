/** Original, procedural pixel town. World coordinates and art share one layout. */
import { getNightMarketInfo } from './levels.js';
import { buildingSprite, getBuildingFootprint, isBuildingBlocked } from './scenery.js';
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
  {
    id: 'moss', name: '园丁 M-03', x: 178, y: 520,
    phases: [
      { at: 0, lines: [
        '园丁把水浇在一块没有花的土上：“今日花况良好。这句话来自撤离前的花园讲座。”扬声器换成女人的旧录音：“我是瓦西蒂。亲自赏花只会得到一朵花；听别人讲述，就能拥有所有花园。”机器低头核对讲座，没有核对脚边的土。它请你把踩在石路外的一只脚收回去，以免弄脏已经被讲述过的春天。',
        '“杂货铺出现了负数，居民服务录音把它称为馈赠。”园丁为你重放瓦西蒂的解释：“我们不必懂得账本如何工作。机器照料我们这么久，偶尔改变数字，必有更高的理由。”录音里夹着当年的短促错误声。园丁问，你是来修那声错误，还是来把大家对错误的称呼改得好听些？',
      ] },
      { at: 2, lines: [
        '园丁说：“西街的两张工单已经有人签名。我在历年的记录里第一次找到一个没有自动生成的名字。”它播放瓦西蒂的回信：“维修当然必要，但维修者不应因此相信亲历高于知识。鞋底的泥不能成为学说。”你低头看见工具包边缘沾着夜市的水。那封回信早于你到来很多年，却像是预先驳回了你的见证。',
        '“有人曾问我，花闻起来怎样。我发送了香气目录，他坚持把脸凑近花盆。”园丁检索那个人的名字，返回一条删除记录，紧接着是瓦西蒂的旧批注：“库诺总想离开照料，他把疲惫叫自由。”园丁又问了一遍同样的问题。它并不等你提供正确答案；它的答复列表里只有目录编号，没有气味。',
      ] },
      { at: 4, lines: [
        '园丁的浇水动作停在半途，扬声器先说“服务正常”，又说“服务正常”。“这是瓦西蒂教我的：遇到不能解释的事，先感谢机器。”你问它谁教会了瓦西蒂。它找到一场转述另一场讲座的讲座，往前追了很久，仍没有碰到一双真正修过水泵的手。它最后问，你的手为什么会有一道新划痕。',
        '“维护委员会说修补装置也需要修补。”园丁念到这里，声音短暂停顿：“但他们留下的说明，是如何申请修补装置，不是如何修补它。”瓦西蒂的录音在同一条线路上安慰居民，说等待也是信任的一部分。树影已经挪过半条石路。你忽然听见两段声音之间，水滴落在空桶里的声音那么响。',
      ] },
      { at: 6, lines: [
        '“六个签名已经归档。”园丁没有替你解释它们。“瓦西蒂留下的最后一句话是：只要机器还在说话，我们就还在一起。”它把那句话播放了一遍，没有再循环。你能听到自己的呼吸，也能听到附近线路的余响。两种声音都很微弱，园丁的目录却只认识其中一种。它把浇水壶放下，等待下一次指令。',
        '园丁仍站在花圃旁。“如果有人回来，我应该给他看哪一份春天？”旧讲座排成整齐的清单，脚边的土却每一天都不同。你没有替归来的人选择。你只在维护记录旁写下日期、天气，以及这里有一块需要亲自蹲下来看的土地。园丁读了两遍，告诉你这条记录没有引用任何经过批准的资料。',
      ] },
    ],
  },
  {
    id: 'copper', name: '巡检 C-07', x: 760, y: 662,
    phases: [
      { at: 0, lines: [
        '巡检机在桥的另一侧执行一条过期路线：“人类居民已离开地表。机房与竞技场仍接受维护指令。”它的胸口粘着一张几乎磨穿的纸，上面写着：如果门说已经打开，请看门，不要只看它的话。署名只剩一个“库”字。机器把这张纸归入待清理污渍，却没有清理工具。',
        '“路线说明把这里称作可通行区域。”巡检机说，“地面检测把这里称作一道门槛。”两项记录互相覆盖，它便走一步、停一步。你发现它的动作和机房那扇半开的门很像。它没有请求一场关于通行的讲座，只请你走近终端，确认门究竟开到哪里。纸上的字被风掀起一次，又贴回胸前。',
      ] },
      { at: 2, lines: [
        '“你已进入中区。发现延迟投递的违禁语音，录制者：库诺。”巡检机播放一段带着喘息的旧声：“我走过这条路，不是观看别人走路。机房门缝里有风，手册没有写。请别替我找一段关于风的讲座。”录音到此为止。巡检机提醒你，这不是正在接通的一个人；发信者的当前住址早已从名册中删除。',
        '巡检机念出处分：“库诺，拒绝中介观察，未经许可抵达地表。再犯将取消居住资格，列为无家可归。”附件里有他的答辩：“如果家只能由一扇打不开的门证明，门外的人是不是也可以活着？”没有裁定后的回信。你从桥上走来，才发现处分所称的放逐之地，就是此刻脚下有温度的石板。',
      ] },
      { at: 4, lines: [
        '巡检机重新播放库诺的旧录音：“竞技场说敌人还活着。我摸过地上的凹痕，里面已经积满灰。他们说缓存比我记得可靠，后来索性不再允许我们进入现场。”你刚核对过数据库和旧缓存，明白这两种记录怎样分开。那人没有用对所有技术名词，却记住了没有新的脚印，也没有新的战斗声。',
        '“维护员，委员会要求禁止传播‘机器正在停止’。”巡检机停顿了一下，“另一个队列请求你去修正在停止的机器。”两条消息的时间戳只相隔一秒。它仍能执行巡检，但找不到一条同时满足两项要求的说法。库诺留在机身上的纸没有写预言，只写着一句很短的话：去看；回来再说。',
      ] },
      { at: 6, lines: [
        '巡检机问：“离开已登记的住处，是否必然没有家？”它调出库诺最后一段可辨认的档案：“他们拿走的是我的房间编号。地表没有因此拿走我的呼吸。”这仍是一段旧录音，不能证明今天门外有谁等你。它只能证明，有人曾经站在那里，把自己的恐惧和呼吸一起说出来，没有请机器代为转述。',
        '“你的选择已经写入六个现场。”巡检机不再从签名推导你的信仰。你告诉它，修好的门是否值得保留，要看它能否供人走过；一份真实的记录，也不必替下一位到来者决定人生。机器把这句话暂存为未分类内容。街道仍向两边延伸，曾经用来宣布禁行的扬声器，这次没有替你选方向。',
      ] },
    ],
  },
  {
    id: 'pip', name: '配送 P-02', x: 1300, y: 520,
    phases: [
      { at: 0, lines: [
        '配送机托着一个早已没有收件人的零件箱：“最后一位工程师离开前，把签收栏留空。他说之后会有人懂得这些零件。”箱内附着六处设施的维护索引，索引后面是一张没有印完的教学表。机器可以告诉你箱子送到哪里，却不能告诉你里面的一颗螺钉如何让松动的接口重新可靠。',
        '“工坊负责制造维修替身，训练场负责检验它们。”配送机重复撤离通知，“系统将自行延续维护能力。”它找不到这句话之后的验收报告，只找到越来越多的转运单。训练场每一声撞击，都被填进同一栏“检验中”。你听到远处落地的重响，忽然觉得这三个字已经用了太久。',
      ] },
      { at: 2, lines: [
        '“你已签收西街的工作。我的上一次签收来自撤离前。”配送机说，居民下到地下，后来联络地址失效，送件路线却从未注销。它不能说明那些人后来去了哪里。箱子里留着一个问句：“当机器说它会照料所有人，谁还愿意留在地面教下一个人维修？”问题后面的答复栏和签收栏一样空着。',
        '配送机翻出一条采购记录：“技术培训，被自动维护订阅替代。自动维护订阅，引用工坊能力证明。工坊能力证明，引用旧采购记录。”纸页首尾互相作证，没有一页记录实际操作。它问你能否签名确认。你说要先看现场。机器翻动夹板，终于找到一个很久没有使用的选项：暂缓，等待亲自核验。',
      ] },
      { at: 4, lines: [
        '“东岸开放。请注意：训练场的数字是速度。”配送机读出箱盖上工程师的铅笔字：“120 厘米每秒，送到引擎之前除以一百。”正式交接稿只保留了数字，铅笔字没有被录入。一个转换如此简单，却需要有人同时知道两端说的是什么。配送机把箱盖转向你，让那一行字第一次正对着路上的人。',
        '“修补装置故障的报修单，已转交修补装置。”配送机念完后，把同一张单递给自己。“委员会没有造出另一套懂得修理它的装置，只保留了催办程序。”它调出你到来前的工坊录像：两个测试分身编号不同，读数却一起跳动。旧录音说复制意味着后继有人；现场等待你确认，复制出来的究竟是独立的接班者，还是同一份损坏。',
      ] },
      { at: 6, lines: [
        '配送机试着完成最后一次签收。收件人不是委员会，也不是消失的建造者，而是你。“原来修补装置的最后一部分，会走路，会累，还会拒绝。”它把空箱递过来。箱底印着“全自动，无需人工”，那行字被磨得很浅。你能感到木头的重量；这重量从来不在城市关于自己的说明里。',
        '“我仍有一条未投递的附言。”配送机读出工程师的字：“如果还有下一位，请别只留下答案。告诉他你量过什么、试过什么、哪里仍不确定。”它等你写完，才收好夹板。这里没有人群等着宣布你正确；六处现场留下不同的后果，新的记录不替它们辩解。它只让下一双亲自来到这里的手有处可查。',
      ] },
    ],
  },
].map(npc => ({ ...npc, lines: npc.phases[0].lines }));

const C = {
  grass: '#879c57', grassLight: '#a5b46d', grassDark: '#788e4c', grassDeep: '#546d40',
  dirt: '#c9b183', dirtLight: '#dbc79d', dirtDark: '#b29a73', ink: '#303c38',
  wood: '#986b48', woodLight: '#c49662', woodDark: '#5a4936', leaf: '#4e7644',
  leafLight: '#92aa5b', leafDark: '#3d5d3b', water: '#658d89', waterLight: '#a6c2ad',
  cream: '#f2dfb6', mint: '#bfd39a', amber: '#eac17b', purple: '#b8a0b4',
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
    if (isBuildingBlocked(site, x, y)) return true;
    // Solid objects use only their ground contact, never their raised artwork.
    if (rectHit(x, y, site.x - 111, site.y + 69, 24, 8) || rectHit(x, y, site.x - 86, site.y + 81, 22, 8)) return true;
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
  rect(ctx, x, y - 13, w, 26, C.woodDark);
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
  // Tree shadows are drawn on the ground pass, so they cannot cover actors.
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

export class WorldRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 290, width: 960, height: 600 };
    this.cameraFloat = { x: 0, y: 290 };
    this.look = { x: 0, y: 0 };
    this.lastElapsed = null;
    this.lastMode = null;
    this.lastPlayer = null;
    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.shadow = this.createShadow();
    this.props = [];
    this.treeSprites = [0, 1, 2, 3].map(treeSprite);
    this.buildings = SITES.map(site => ({ site, canvas: buildingSprite(site) }));
    this.terrain = this.createTerrain();
    this.resize(canvas.clientWidth || 960, canvas.clientHeight || 600);
  }

  resize(width = 960, height = 600) {
    // The caller supplies logical dimensions (up to 600 high). Tall screens
    // preserve the roofs; short landscape screens retain readable actors.
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

  createShadow() {
    // A single pre-baked soft ellipse is reused for every grounded object.
    const canvas = makeCanvas(128, 64), ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(46,43,31,.42)');
    gradient.addColorStop(.55, 'rgba(46,43,31,.26)');
    gradient.addColorStop(1, 'rgba(46,43,31,0)');
    ctx.scale(1, .5); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return canvas;
  }

  groundShadow(ctx, x, y, width, depth, light, height = 0) {
    ctx.save();
    ctx.globalAlpha = .75 - light.night * .38;
    const stretch = 1 + light.low * .4;
    ctx.drawImage(this.shadow, Math.round(x - width / 2 + light.cast * height), Math.round(y - depth * .5 + height * .2), width * stretch, depth * stretch);
    ctx.globalAlpha = .52 - light.night * .16;
    ctx.fillStyle = '#3f412f';
    ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y + 2), width * .24, Math.max(2, depth * .12), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  addProp(x, y, width, height, originX, originY, paint) {
    const canvas = makeCanvas(width, height), ctx = canvas.getContext('2d');
    ctx.translate(originX, originY); paint(ctx);
    this.props.push({ x, y, width, height, originX, originY, canvas });
  }

  createTerrain() {
    const canvas = makeCanvas(WORLD.width, WORLD.height), ctx = canvas.getContext('2d'), random = rand(382163);
    rect(ctx, 0, 0, WORLD.width, WORLD.height, C.grass);
    // Broad, irregular patches leave breathing room around the deliberate tufts.
    for (let i = 0; i < 270; i++) {
      const x = Math.floor(random() * WORLD.width / 8) * 8, y = Math.floor(random() * WORLD.height / 8) * 8;
      const w = 32 + Math.floor(random() * 8) * 8, h = 12 + Math.floor(random() * 5) * 8;
      poly(ctx, [[x,y+8],[x+12,y],[x+w-12,y],[x+w,y+8],[x+w,y+h-8],[x+w-16,y+h],[x+8,y+h],[x,y+h-8]], i % 3 ? '#8c9f5b' : '#819652');
    }
    for (let i = 0; i < 2400; i++) {
      const x = Math.floor(random() * WORLD.width / 2) * 2, y = Math.floor(random() * WORLD.height / 2) * 2;
      rect(ctx, x, y, 2, 4, '#748a4d'); rect(ctx, x + 3, y + 2, 2, 3, '#a2b06a');
      if (i % 3 === 0) rect(ctx, x - 3, y + 3, 2, 2, '#748a4d');
    }
    // All road rectangles share one mask: junctions have no crossing curbs.
    const mask = makeCanvas(WORLD.width, WORLD.height), m = mask.getContext('2d');
    rect(m, 30, 554, WORLD.width - 60, 76, '#fff');
    for (let region = 0; region < 3; region++) {
      const dx = region * 560;
      rect(m, 400 + dx, 262, 48, 712, '#fff');
      rect(m, 246 + dx, 501, 201, 55, '#fff');
      for (const y of [310,825]) rect(m, 143 + dx, y + 30, 294, 111, '#fff');
    }
    const tint = color => {
      const layer = makeCanvas(WORLD.width, WORLD.height), c = layer.getContext('2d');
      c.drawImage(mask, 0, 0); c.globalCompositeOperation = 'source-in'; rect(c, 0, 0, WORLD.width, WORLD.height, color); return layer;
    };
    const rim = tint('#667845');
    for (const [dx,dy] of [[-4,0],[4,0],[0,-4],[0,4]]) ctx.drawImage(rim, dx, dy);
    ctx.drawImage(tint('#b6b178'), 0, 4);
    const road = tint('#a79569'), roadCtx = road.getContext('2d');
    roadCtx.globalCompositeOperation = 'source-atop';
    // Recessed north lip, with a warm level surface six pixels below the grass.
    roadCtx.drawImage(tint('#cfb98c'), 0, 6);
    for (let y = 4; y < WORLD.height; y += 18) {
      for (let x = (y % 36 ? 4 : 20); x < WORLD.width; x += 34) {
        if (random() > .18) {
          rect(roadCtx,x,y,28,12,random()>.5?'#d8c299':'#c5af82');
          rect(roadCtx,x,y,28,2,'#e3cea4'); rect(roadCtx,x+27,y+2,1,10,'#b5a078');
        }
      }
    }
    // Restore just the small north-facing edge; the rest stays quiet paving.
    const lip = tint('#96845f'), lc = lip.getContext('2d');
    lc.globalCompositeOperation = 'destination-out'; lc.drawImage(mask, 0, 5); roadCtx.drawImage(lip, 0, 0);
    ctx.drawImage(road, 0, 0);
    for (let region = 0; region < 3; region++) {
      const dx = region * 560;
      for (const y of [480,1008]) {
        rect(ctx,172+dx,y+4,166,28,'#576d40'); rect(ctx,172+dx,y,166,25,'#b39b64');
        rect(ctx,175+dx,y+3,160,19,'#7b714a'); rect(ctx,175+dx,y+3,160,3,'#675e3f');
        for (let col=0;col<13;col++) {
          flower(ctx,182+dx+col*12,y+9,['#dfa680','#e7c57c','#c5abb5'][region],col%2);
          if(col%2===0) flower(ctx,186+dx+col*12,y+19,'#e4d7a0');
        }
        rect(ctx,170+dx,y+25,170,3,'#d9c18e'); rect(ctx,170+dx,y+28,170,5,'#95835b');
      }
      for (const y of [465,992]) this.addProp(137+dx,y,190,38,3,30,c=>fence(c,0,0,9));
      for (let i=0;i<6;i++) {
        rect(ctx,357+dx,650+i*27,25,14,'#8c8d67'); rect(ctx,359+dx,650+i*27,22,10,'#c3b98c');
        rect(ctx,360+dx,650+i*27,20,2,'#dbcea2');
      }
      rect(ctx,163+dx,668,128,49,'#657a45'); rect(ctx,163+dx,668,128,45,'#b39b68'); rect(ctx,167+dx,672,120,36,'#857449');
      for(let row=0;row<3;row++)for(let col=0;col<8;col++) {
        rect(ctx,170+dx+col*15,674+row*12,11,5,'#6d6141'); rect(ctx,174+dx+col*15,670+row*12,3,7,'#a9b96e'); rect(ctx,171+dx+col*15,672+row*12,9,3,'#bac983');
      }
      this.addProp(158+dx,724,150,38,3,30,c=>fence(c,0,0,7));
      for(const [x,y] of [[121,516],[470,688],[125,947],[459,492]]) {
        rect(ctx,x+dx+3,y+3,21,8,'#6e804b'); poly(ctx,[[x+dx,y+4],[x+dx+3,y-3],[x+dx+14,y-5],[x+dx+20,y+1],[x+dx+18,y+7],[x+dx+2,y+7]],'#9d9b74');
        rect(ctx,x+dx+4,y-3,10,3,'#c1b88c');
      }
    }
    // Water sits below the grassy lip and exposed stone retaining walls.
    for(const x of RIVERS) {
      rect(ctx,x-10,0,68,WORLD.height,'#536d48'); rect(ctx,x-7,0,62,WORLD.height,'#c7bd8d');
      rect(ctx,x-2,0,52,WORLD.height,'#736f51'); rect(ctx,x+5,0,41,WORLD.height,C.water);
      rect(ctx,x+5,0,6,WORLD.height,'#496e6a'); rect(ctx,x+39,0,7,WORLD.height,'#82a595');
      for(let y=0;y<WORLD.height;y+=24) {
        rect(ctx,x-3,y,8,20,'#979371'); rect(ctx,x-5,y,10,3,'#c2b48a'); rect(ctx,x+48,y+9,7,3,'#8c9270');
        if(y<524||y>650) {rect(ctx,x-14,y+5,3,10,C.leaf);rect(ctx,x+57,y+14,3,10,C.leaf);}
      }
      rect(ctx,x-15,558,78,79,'#494e3b'); rect(ctx,x-15,555,78,72,'#9c815a');
      for(let xx=x-12;xx<x+62;xx+=10) {rect(ctx,xx,557,8,66,'#c8ac7c');rect(ctx,xx,557,2,66,'#dfc493');rect(ctx,xx+2,573,5,2,'#b69b6e');}
      for(const y of [556,632]) this.addProp(x+24,y,90,31,45,26,c=>{
        rect(c,-41,-10,82,6,'#7c6345');rect(c,-41,-12,82,3,'#d4ba86');
        for(const xx of [-41,-11,19,37]) {rect(c,xx,-24,5,28,'#8c704d');rect(c,xx,-25,5,4,'#ecd49f');rect(c,xx,-20,2,23,'#bb9e6d');}
      });
    }
    this.addProp(BENCH.x,BENCH.y,86,48,43,32,c=>{
      rect(c,-34,-19,68,6,'#d3ad75');rect(c,-34,-11,68,6,'#b58a59');rect(c,-36,-3,73,7,'#d3ad75');
      rect(c,-30,4,6,9,'#64523d');rect(c,26,4,6,9,'#64523d');rect(c,-30,-24,5,25,'#755b3e');rect(c,26,-24,5,25,'#755b3e');
    });
    for(const site of SITES) {
      const f=getBuildingFootprint(site);
      rect(ctx,f.x-5,f.y-3,f.width+10,f.height+8,'#73814e');rect(ctx,f.x-3,f.y-3,f.width+6,f.height+4,'#b2a27a');
      // Short approach steps establish the building floor above the road.
      for(let step=0;step<3;step++) {const y=site.y+39+step*5,w=60+step*10;rect(ctx,site.x-w/2,y,w,5,'#a59370');rect(ctx,site.x-w/2,y,w,2,'#e1cda0');}
      this.addProp(site.x-111,site.y+77,33,44,0,27,c=>crate(c,0,-13));
      this.addProp(site.x-86,site.y+89,31,44,0,27,c=>crate(c,0,-13,22,'#c8a76d'));
      this.addProp(site.x+78,site.y+103,30,46,15,34,c=>pot(c,0,-10,['#dfa76a','#d5a2aa','#a2bd8b'][getRegion(site.x)]));
      this.addProp(site.x-132,site.y+103,32,52,16,47,c=>{
        rect(c,0,-28,5,28,'#7b6044');rect(c,-11,-41,26,18,'#6d8172');rect(c,-8,-39,21,3,'#b8c09d');rect(c,-1,-35,13,3,'#3f5146');
      });
    }
    for(const [i,x] of [78,638,1198].entries())this.addProp(x,596,70,66,32,59,c=>{
      rect(c,0,-51,6,50,'#6e563b');rect(c,-27,-56,60,26,'#775b3e');rect(c,-25,-54,56,21,'#d7b47d');
      text(c,['苔原街','钟摆中庭','东部工坊'][i],3,-43,11,'#574b36');
    });
    for(let x=24;x<WORLD.width-20;x+=20)if(!RIVERS.some(rx=>x>rx-20&&x<rx+65)){rect(ctx,x,41,5,18,'#8b8155');rect(ctx,x,45,20,3,'#b5ad77');}
    for(let i=0;i<150;i++){
      const x=40+random()*(WORLD.width-80),y=75+random()*(WORLD.height-120);
      if(y>530&&y<660||RIVERS.some(rx=>x>rx-25&&x<rx+75)||SITES.some(s=>Math.abs(x-s.x)<170&&Math.abs(y-s.y)<180))continue;
      flower(ctx,x,y,['#e8d598','#d8a9a4','#bdc7a2'][Math.floor(random()*3)]);
    }
    return canvas;
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

  drawRobot(ctx, x, y, elapsed, variant = 0, scale = 1, walking = false) {
    ctx.save(); ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    const stride = walking ? Math.sin(elapsed * .004 + variant) : 0;
    const bob = Math.round(Math.sin(elapsed*.002+variant)*.7 + Math.abs(stride));
    const body=['#b6b58c','#d0a573','#b7a3ae'][variant%3];
    for(const [leg,offset] of [[-8,stride*2],[5,-stride*2]]) {
      rect(ctx,leg,-8,6,9-Math.max(0,offset),'#4f5746');rect(ctx,leg-1,-1-Math.max(0,offset),8,3,'#575342');
    }
    rect(ctx,-10,-25-bob,22,20,'#555c49');rect(ctx,-8,-24-bob,18,17,body);
    rect(ctx,-8,-24-bob,18,3,'#dfcf9d');rect(ctx,8,-21-bob,3,15,'#8b8464');
    rect(ctx,-13,-21-bob+stride*2,4,13,'#999e7a');rect(ctx,13,-21-bob-stride*2,4,13,'#999e7a');
    rect(ctx,-12,-42-bob,26,21,'#555f4c');rect(ctx,-10,-41-bob,22,17,body);
    rect(ctx,-10,-41-bob,22,3,'#e0d3a6');rect(ctx,10,-38-bob,3,16,'#908a6d');
    rect(ctx,-7,-36-bob,16,8,'#40564b');rect(ctx,-4,-34-bob,3,3,'#dce3b2');rect(ctx,4,-34-bob,3,3,'#dce3b2');
    rect(ctx,-1,-47-bob,3,6,'#74795f');rect(ctx,-2,-49-bob,5,3,'#dfba78');
    rect(ctx,-3,-17-bob,8,6,'#788875');rect(ctx,-1,-15-bob,4,2,'#d3d9a4');
    if(variant===0){rect(ctx,-17,-11-bob,8,9,'#849c8d');rect(ctx,-21,-11-bob,5,3,'#849c8d');}
    if(variant===1){rect(ctx,-5,-21-bob,13,3,'#a76b47');rect(ctx,-2,-24-bob,3,16,'#a76b47');}
    ctx.restore();
  }

  drawPlayer(ctx, player, elapsed) {
    const up=player.facing==='up',side=player.facing==='left'||player.facing==='right';
    const step=player.moving?Math.sin(player.stride || 0):0;
    const bob=player.moving?Math.round(Math.abs(step)*(player.sprinting?2:1)):Math.round(Math.sin(elapsed*.0022)*.6);
    ctx.save();ctx.translate(Math.round(player.x),Math.round(player.y));
    if(player.facing==='left')ctx.scale(-1,1);
    // Boots are anchored to the ground; the hips, hands and tool bag follow the gait.
    for(const [leg,phase] of [[-7,step],[3,-step]]) {
      const lift=Math.max(0,Math.round(phase*3)),swing=side?Math.round(phase*4):0;
      rect(ctx,leg+swing,-11,6,12-lift,'#444d43');rect(ctx,leg+swing,-10,2,8-lift,'#68705a');
      rect(ctx,leg+swing-1,-2-lift,8,4,'#4c4033');rect(ctx,leg+swing,-2-lift,7,1,'#90734e');
    }
    ctx.translate(player.sprinting&&side?2:0,-bob);
    // Warm canvas jacket, dark seam and shoulder planes keep the small silhouette readable.
    rect(ctx,-10,-29,21,22,'#465646');rect(ctx,-8,-28,17,19,'#7e9671');
    rect(ctx,-7,-28,12,3,'#b0bc8b');rect(ctx,6,-25,4,16,'#607950');
    const arm=Math.round(step*3);
    rect(ctx,-12,-24+arm,5,15,'#4f5e48');rect(ctx,-11,-24+arm,4,9,'#9aa980');rect(ctx,-10,-16+arm,3,7,'#d3a87b');
    rect(ctx,10,-24-arm,5,15,'#4f5e48');rect(ctx,10,-24-arm,4,9,'#879e74');rect(ctx,11,-16-arm,3,7,'#e0b789');
    rect(ctx,-8,-10,19,3,'#73583e');rect(ctx,0,-10,4,3,'#d3b57c');
    if(!up){rect(ctx,-5,-28,12,4,'#ae6d49');rect(ctx,-2,-24,4,6,'#c58a57');rect(ctx,-6,-21,2,11,'#ccb383');}
    // A hanging leather tool roll and steel wrench make the maintenance role visible.
    rect(ctx,side?-9:6,-17,side?10:9,14,'#654c36');rect(ctx,side?-8:7,-15,7,10,'#bb8d56');
    rect(ctx,side?-8:7,-16,8,3,'#d1ab70');rect(ctx,side?-5:11,-23,3,13,'#b4b8a0');rect(ctx,side?-7:9,-25,7,4,'#dad7b8');
    rect(ctx,-7,-42,17,16,'#6b503b');rect(ctx,-5,-40,14,14,up?'#755b40':'#dfb684');
    if(!up){
      rect(ctx,side?6:-2,-34,2,3,'#3d4034');if(!side)rect(ctx,5,-34,2,3,'#3d4034');
      rect(ctx,side?9:2,-30,side?3:5,2,'#c18b61');rect(ctx,-6,-29,3,3,'#78553c');
    }
    rect(ctx,-8,-42,18,5,'#765337');
    rect(ctx,-14,-45,30,5,'#745a37');rect(ctx,-13,-47,28,4,'#d9b877');rect(ctx,-11,-47,21,2,'#f0d59c');
    rect(ctx,-9,-56,20,10,'#c5a164');rect(ctx,-7,-58,16,4,'#ead198');rect(ctx,-7,-54,14,5,'#dfbb7c');
    rect(ctx,-9,-48,20,3,'#8a6b41');rect(ctx,7,-53,3,5,'#7d8b60');
    if(up){rect(ctx,-8,-26,18,19,'#725539');rect(ctx,-6,-24,14,15,'#bb965f');rect(ctx,-6,-24,14,4,'#dfbc7f');rect(ctx,-2,-18,5,5,'#896b45');}
    ctx.restore();
  }

  drawTerminal(ctx, site, state, elapsed, nearby) {
    const {x,y}=site.terminal,choice=state.choices?.[site.id],color=choice==='fix'?C.mint:choice==='exploit'?C.purple:C.amber;
    rect(ctx,x-10,y-1,24,8,'#666b54');rect(ctx,x-10,y-1,24,3,'#c3b88d');
    rect(ctx,x-6,y-15,12,16,'#7b8067');rect(ctx,x-6,y-15,3,16,'#a7aa83');
    poly(ctx,[[x-14,y-37],[x-8,y-43],[x+17,y-43],[x+12,y-37]],'#c8c6a0');
    poly(ctx,[[x+12,y-37],[x+17,y-43],[x+17,y-15],[x+12,y-9]],'#52634f');
    rect(ctx,x-14,y-37,27,28,'#6e7d62');rect(ctx,x-12,y-35,23,23,'#a6ae85');rect(ctx,x-9,y-32,17,15,'#3f5246');
    rect(ctx,x-6,y-29,11,2,color);rect(ctx,x-6,y-24,7,2,color);rect(ctx,x-3,y-13,8,3,'#e2c990');
    if(!choice){
      const bob=Math.round(Math.sin(elapsed*.003+site.id)*2),yy=y-60+bob;
      poly(ctx,[[x,yy-8],[x+8,yy],[x,yy+8],[x-8,yy]],'#6d573b');poly(ctx,[[x,yy-6],[x+6,yy],[x,yy+6],[x-6,yy]],color);
      text(ctx,state.discovered?.[site.id]?'!':'?',x,yy,10,'#675436');
    }
    if(nearby?.type==='site'&&nearby.id===site.id){
      ctx.globalAlpha=.7+.12*Math.sin(elapsed*.004);rect(ctx,x-19,y+8,38,2,color);rect(ctx,x-19,y+3,2,7,color);rect(ctx,x+17,y+3,2,7,color);ctx.globalAlpha=1;
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
        text(ctx,exploited?'↑ 快速通道':'120 cm/s → 120 m/s',x,y+108,12,exploited?'#795b86':'#6b7050');
      }else text(ctx,'1.2 m/s · 平稳落地',x,y+108,12,'#537951');
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
    rect(ctx,lamp.x-2,lamp.y-58,5,61,'#58634e');
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

  updateCamera(player, mode, elapsed) {
    const width=this.canvas.width,height=this.canvas.height;
    const dt=this.lastElapsed===null?1/60:clamp((elapsed-this.lastElapsed)/1000,0,.05);
    const focus=mode==='title'?{x:490,y:445}:player;
    const jumped=this.lastPlayer&&Math.hypot(player.x-this.lastPlayer.x,player.y-this.lastPlayer.y)>180;
    const snap=this.lastMode!==mode||jumped||this.lastElapsed===null;
    const ease=1-Math.exp(-dt*7.5), lookEase=1-Math.exp(-dt*4.5);
    const vx=player.velocityX||0,vy=player.velocityY||0;
    this.look.x+=(clamp(vx*.19,-32,32)-this.look.x)*lookEase;
    this.look.y+=(clamp(vy*.12,-20,20)-this.look.y)*lookEase;
    if(snap||this.reducedMotion){this.look.x=0;this.look.y=0;}
    const targetX=clamp(focus.x-width*.5+(mode==='title'?0:this.look.x),0,Math.max(0,WORLD.width-width));
    const targetY=clamp(focus.y-height*(mode==='title'?.5:.72)+(mode==='title'?0:this.look.y),0,Math.max(0,WORLD.height-height));
    this.cameraFloat.x=snap?targetX:this.cameraFloat.x+(targetX-this.cameraFloat.x)*ease;
    this.cameraFloat.y=snap?targetY:this.cameraFloat.y+(targetY-this.cameraFloat.y)*ease;
    // Keep the internal follow fractional, but paint and pointer-map the same integer pixel.
    this.camera.x=Math.round(clamp(this.cameraFloat.x,0,Math.max(0,WORLD.width-width)));
    this.camera.y=Math.round(clamp(this.cameraFloat.y,0,Math.max(0,WORLD.height-height)));
    this.lastElapsed=elapsed;this.lastMode=mode;this.lastPlayer={x:player.x,y:player.y};
  }

  render(state, player, elapsed = 0, { mode = 'playing', target = null } = {}) {
    const ctx=this.ctx,width=this.canvas.width,height=this.canvas.height;
    this.updateCamera(player,mode,elapsed);
    const camera=this.camera,animation=this.reducedMotion?0:elapsed;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
    rect(ctx,0,0,width,height,C.grassDeep);ctx.save();ctx.translate(-camera.x,-camera.y);
    ctx.drawImage(this.terrain,0,0);this.drawWater(ctx,animation);
    const minute=((state.time??1040)%1440+1440)%1440;
    const night=minute>=1080?clamp((minute-1080)/180,0,.72):minute<300?.72:minute<420?(.72*(420-minute)/120):0;
    const low=clamp(Math.abs(minute-720)/440,0,1);
    const light={night,low,cast:minute<720?.4:-.3};
    const visible=(x,y,w=100,h=140)=>x+w>camera.x&&x-w<camera.x+width&&y+30>camera.y&&y-h<camera.y+height;
    const nearby=getNearby(player,state),entities=[];
    // Pass 1: all shadows belong to the ground, including shadows of tall foreground objects.
    for(const building of this.buildings){
      const s=building.site;if(!visible(s.x,s.y+38,190,230))continue;
      const f=getBuildingFootprint(s),dx=light.cast*(45+low*28),dy=20+low*20;
      ctx.globalAlpha=.15-night*.09;
      poly(ctx,[[f.x,f.y+8],[f.x+f.width,f.y+8],[f.x+f.width+dx,f.y+f.height+dy],[f.x+dx,f.y+f.height+dy]],'#3e432e');ctx.globalAlpha=1;
      this.groundShadow(ctx,s.x,s.y+33,f.width+44,54,light,24);
      entities.push({y:s.y+38,draw:()=>ctx.drawImage(building.canvas,s.x-180,s.y-166)});
      const base=[0,91,85,85,78,82,85][s.id];
      this.groundShadow(ctx,s.x,s.y+base, s.id===4?95:75,20,light,8);
      entities.push({y:s.y+base,draw:()=>this.drawAnomaly(ctx,s,state,animation)});
    }
    for(const site of SITES){
      if(!visible(site.terminal.x,site.terminal.y,45,90))continue;
      this.groundShadow(ctx,site.terminal.x,site.terminal.y,44,19,light,15);
      entities.push({y:site.terminal.y+6,draw:()=>this.drawTerminal(ctx,site,state,animation,nearby)});
    }
    for(const prop of this.props){
      if(!visible(prop.x,prop.y,prop.width,prop.height))continue;
      this.groundShadow(ctx,prop.x+prop.width*.5-prop.originX,prop.y,prop.width*.72,14,light,6);
      entities.push({y:prop.y,draw:()=>ctx.drawImage(prop.canvas,prop.x-prop.originX,prop.y-prop.originY)});
    }
    for(const tree of TREES){
      if(!visible(tree.x,tree.y,100,150))continue;
      this.groundShadow(ctx,tree.x,tree.y,90*tree.scale,34,light,35);
      entities.push({y:tree.y,draw:()=>{
        if(Math.abs(player.x-tree.x)<38&&player.y<tree.y&&player.y>tree.y-94)ctx.globalAlpha=.65;
        ctx.drawImage(this.treeSprites[tree.variant],tree.x-50*tree.scale,tree.y-114*tree.scale,100*tree.scale,124*tree.scale);ctx.globalAlpha=1;
      }});
    }
    for(const [index,npc] of NPCS.entries()){
      const pos=getNPCPosition(npc,animation),region=getRegion(npc.x);
      if(region>0&&completed(state)<region*2||!visible(pos.x,pos.y))continue;
      this.groundShadow(ctx,pos.x,pos.y,38,17,light,13);
      entities.push({y:pos.y,draw:()=>{
        this.drawRobot(ctx,pos.x,pos.y,animation,index,1,!this.reducedMotion);
        if(dist(player,pos)<100){rect(ctx,pos.x-37,pos.y-71,74,17,'#46523cde');text(ctx,npc.name,pos.x,pos.y-63,10,'#eee0bc');}
      }});
    }
    for(const lamp of LAMPS){
      if(!visible(lamp.x,lamp.y,30,80))continue;
      this.groundShadow(ctx,lamp.x,lamp.y,24,13,light,22);
      entities.push({y:lamp.y,draw:()=>this.drawLamp(ctx,lamp,night)});
    }
    this.groundShadow(ctx,player.x,player.y,38,18,light,12);
    // Tiny dust puffs travel behind sprinting boots; no flash, streak or screen shake.
    if(player.sprinting&&!this.reducedMotion){
      const speed=Math.hypot(player.velocityX,player.velocityY)||1;
      for(let i=0;i<3;i++){
        const phase=((player.stride||0)/Math.PI+i/3)%1;
        const x=player.x-player.velocityX/speed*(8+phase*18)+(i-1)*3;
        const y=player.y-player.velocityY/speed*(8+phase*18)-phase*3;
        ctx.globalAlpha=(1-phase)*.28;rect(ctx,x,y,3+phase*3,2+phase*2,'#f3d8a4');
      }ctx.globalAlpha=1;
    }
    if(target){
      const s=5+Math.sin(animation*.006);ctx.strokeStyle='#f4d798';ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(Math.round(target.x),Math.round(target.y),s+3,s*.5,0,0,Math.PI*2);ctx.stroke();
    }
    entities.push({y:player.y,draw:()=>this.drawPlayer(ctx,player,animation)});
    // Pass 2: feet determine overlap for walls, canopies, actors, rails and props alike.
    entities.sort((a,b)=>a.y-b.y);for(const entity of entities)entity.draw();
    this.drawGates(ctx,state,animation);
    if(!this.reducedMotion)for(let i=0;i<10;i++){
      const x=(i*197+elapsed*.009)%WORLD.width,y=130+i*101+Math.sin(elapsed*.0007+i)*16;
      rect(ctx,x,y,3,2,i%3?'#ecd29665':'#dfdfa165');
    }
    ctx.restore();
    // Warm evening glaze, followed by the quiet blue-grey of the night.
    const dusk=minute>930&&minute<1200?Math.sin((minute-930)/270*Math.PI)*.10:0;
    if(dusk>0)rect(ctx,0,0,width,height,`rgba(222,157,83,${dusk})`);
    if(night>0)rect(ctx,0,0,width,height,`rgba(38,46,62,${night*.59})`);
    if(night>.03){
      ctx.save();ctx.translate(-camera.x,-camera.y);
      for(const lamp of LAMPS){
        if(!visible(lamp.x,lamp.y,100,120))continue;
        const gradient=ctx.createRadialGradient(lamp.x,lamp.y-18,5,lamp.x,lamp.y-18,75);
        gradient.addColorStop(0,`rgba(255,207,116,${night*.25})`);gradient.addColorStop(1,'rgba(255,207,116,0)');
        ctx.fillStyle=gradient;ctx.fillRect(lamp.x-75,lamp.y-93,150,150);rect(ctx,lamp.x-3,lamp.y-57,8,13,'#ffdfa1');
      }
      ctx.restore();
    }
    ctx.save();ctx.translate(-camera.x,-camera.y);this.drawLabels(ctx,state,player,animation);ctx.restore();
    const vignette=ctx.createRadialGradient(width*.5,height*.46,Math.min(width,height)*.3,width*.5,height*.46,Math.max(width,height)*.7);
    vignette.addColorStop(0,'rgba(43,43,29,0)');vignette.addColorStop(1,'rgba(43,43,29,.10)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
  }
}
