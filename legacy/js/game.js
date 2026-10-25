/**
 * 最后一位维护员 × bug大乱斗 — MVP
 * Core loop: notice anomaly → check logs/config → locate cause → Fix | Exploit
 */

const LEVELS = [
  {
    id: 1,
    emoji: "🪙",
    name: "负金币铺",
    place: "杂货铺",
    bug: "int16 溢出",
    anomaly: "顾客钱包里金币 > 32767 时变成负数，店主反而倒欠钱。",
    desc: "杂货铺门口排着队。一个背包鼓鼓的旅人结账时，柜台屏幕闪了一下——\n店主一脸懵：「你……你买了面包，我怎么倒欠你 3000 金币？」",
    logs: [
      { t: "dim", text: "[ledger] 打开交易流水 ledger.dat" },
      { t: "out", text: "TX#8821  buyer=旅人  item=面包  gold_before=32760" },
      { t: "out", text: "TX#8821  gold_delta=+20  → gold_after=-32756" },
      { t: "err", text: "[WARN] balance < 0，触发「店主债务」分支，退款 3000" },
      { t: "dim", text: "[hint] 钱包字段类型：int16（范围 -32768 ~ 32767）" },
    ],
    config: `// wallet.h
struct Wallet {
  int16_t gold;   // ← 坏了：超过 32767 会绕回负数
  // int32_t gold; // ← 修好：更大的类型
};`,
    cause: "金币字段用了 int16。超过 32767 时整数溢出，变成很大的负数，系统判定「店主欠你钱」。",
    fixText: "把 Wallet.gold 改成 int32（或更大）。溢出不再发生，账本恢复正常。",
    exploitText: "故意把金币刷到刚好溢出，反复触发「店主债务」退款，薅一笔资源。",
    fixResult: "类型加宽。杂货铺账本不再翻脸。城市稳定性 +8。",
    exploitResult: "你摸到溢出边界，连薅三笔退款。口袋鼓了，但街角开始流传「负金币玄学」。城市埋下一颗新雷。稳定性 -5，资源 +。",
  },
  {
    id: 2,
    emoji: "🕛",
    name: "午夜折扣门",
    place: "夜市入口",
    bug: "只比 HH:MM",
    anomaly: "过了午夜的限时活动，时间一直停在 23:59，折扣永不结束。",
    desc: "夜市霓虹还亮着。告示牌写着「23:00–23:59 半价」，可墙上的钟已经指向凌晨两点。\n摊主打着哈欠：「系统说还在活动时间……我也不敢关。」",
    logs: [
      { t: "dim", text: "[event] 检查限时活动 night_market_half" },
      { t: "out", text: "now = 2026-10-26 02:14:33" },
      { t: "out", text: "window_start = 23:00   window_end = 23:59" },
      { t: "err", text: "compare(now.HHMM, end.HHMM) → 02:14 < 23:59 ? true  ← 只比了时分！" },
      { t: "dim", text: "[hint] 日期被丢掉了，跨日之后永远「还在窗内」" },
    ],
    config: `// event_scheduler.py
def in_window(now, start, end):
    # 坏了：只比 HH:MM，跨日后永远 true
    return start.HHMM <= now.HHMM <= end.HHMM
    # 修好：用完整时间戳（含日期）
    # return start_ts <= now_ts <= end_ts`,
    cause: "活动判定只比较「时:分」，丢掉了日期。过了午夜，02:14 仍然小于 23:59，折扣永不关。",
    fixText: "改成完整时间戳（日期+时分秒）比较。午夜一过，活动正常结束。",
    exploitText: "卡在午夜前后反复进出，用永不关闭的半价把库存搬空。",
    fixResult: "时间窗用上完整时间戳。夜市准时打烊。稳定性 +8。",
    exploitResult: "你连刷半价到摊位空货。钱包舒服，日程表开始怀疑人生。稳定性 -5，资源 +。",
  },
  {
    id: 3,
    emoji: "🚪",
    name: "半开的门",
    place: "机房侧门",
    bug: "竞态条件",
    anomaly: "两个 NPC 同时开门，门卡在半开，谁也过不去——也封不死。",
    desc: "机房侧门嗡嗡响。守卫 A 和保洁 B 同时刷卡。门开到一半卡住了，缝宽刚好能挤一只猫。\n告警灯在闪：「DOOR_STATE = HALF_OPEN」。",
    logs: [
      { t: "dim", text: "[door] 并发请求" },
      { t: "out", text: "T0  NPC_A.lock_request()  → acquired? 竞态中…" },
      { t: "out", text: "T0  NPC_B.lock_request()  → acquired? 竞态中…" },
      { t: "err", text: "T1  A.set(OPENING)  B.set(CLOSING)  → 合并态 HALF_OPEN" },
      { t: "dim", text: "[hint] 没有互斥锁，两个写者同时改 door.state" },
    ],
    config: `// door_controller.c
void open_door(Actor *a) {
  // 坏了：无锁，两人同时写 state
  door.state = OPENING;
  door.angle += a->force;
  // 修好：加互斥锁
  // lock(&door.mutex);
  // ... critical section ...
  // unlock(&door.mutex);
}`,
    cause: "开门/关门没有互斥锁。两个 NPC 同时写 door.state，合成了一个不存在的 HALF_OPEN。",
    fixText: "给门控加锁，同一时刻只允许一个写者。门会完整开或完整关。",
    exploitText: "趁半开的缝钻进去，绕过门禁，抄近路进机房。",
    fixResult: "互斥锁就位。侧门恢复「全开或全关」。稳定性 +8。",
    exploitResult: "你从缝里滑进机房。省了时间，但门控状态机多了一个「幽灵半开」分支。稳定性 -5。",
  },
  {
    id: 4,
    emoji: "👻",
    name: "还活着的 Boss",
    place: "竞技场缓存",
    bug: "缓存未失效",
    anomaly: "Boss 已被打倒，地图上仍显示存活，还能再打一次掉落。",
    desc: "竞技场大屏还在播「Boss 血量 3%」。地上明明躺着战利品箱。\n路人小声说：「我昨天打过了……今天怎么又站起来了？」",
    logs: [
      { t: "dim", text: "[cache] 查询 boss:arena_01" },
      { t: "out", text: "DB  status=DEAD  last_kill=昨天 18:02" },
      { t: "err", text: "CACHE status=ALIVE  ttl=∞  ← 击杀后未 invalidate" },
      { t: "out", text: "地图渲染读的是 CACHE，所以 Boss 还在刷" },
      { t: "dim", text: "[hint] 写库成功，缓存没清" },
    ],
    config: `// boss_repo.js
async function killBoss(id) {
  await db.update(id, { status: "DEAD" });
  // 坏了：忘了清缓存
  // 修好：
  // await cache.invalidate("boss:" + id);
}`,
    cause: "击杀只写了数据库，忘了让缓存失效。地图读的是旧缓存，Boss 看起来还活着。",
    fixText: "击杀后 invalidate 对应缓存键。地图与数据库一致。",
    exploitText: "反复「再打一次」已死的 Boss，刷掉落。",
    fixResult: "缓存失效。竞技场大屏终于黑掉。稳定性 +8。",
    exploitResult: "你又薅了两轮掉落。背包满了，世界表开始出现重复击杀记录。稳定性 -5，资源 +。",
  },
  {
    id: 5,
    emoji: "🦘",
    name: "一跳出界",
    place: "训练场",
    bug: "米/厘米混用",
    anomaly: "角色只跳一下就飞出地图——有的系统用米，有的用厘米。",
    desc: "训练场的蹦床区。你按了一次跳跃。视野猛地拉远——角色已经在地图外的虚空里缓慢旋转。\n物理日志疯狂刷屏。",
    logs: [
      { t: "dim", text: "[physics] 跳跃冲量" },
      { t: "out", text: "input.jump_force = 120        // 设计意图：120 cm/s" },
      { t: "err", text: "engine.applyImpulse(120)     // 引擎单位：米 → 当成 120 m/s" },
      { t: "out", text: "velocity.y = 120 m/s  → 直接飞出 bounding box" },
      { t: "dim", text: "[hint] 配置写厘米，引擎读米，差了 100 倍" },
    ],
    config: `// movement.yaml
jump_force: 120          # 策划按 cm/s 填的
# engine.ini
# units = meters         # 引擎按米解释 → 120 m/s
# 修好：统一单位，例如全用米：jump_force: 1.2`,
    cause: "跳跃力配置按厘米写，物理引擎按米读。数值被放大 100 倍，一跳飞出地图。",
    fixText: "统一单位（全米或全厘米），并把数值换算正确。",
    exploitText: "保留错误单位，故意一跳跳关，跳过整段路程。",
    fixResult: "单位对齐。蹦床重新变成蹦床。稳定性 +8。",
    exploitResult: "你借 120 m/s 直接跳到下一区。捷径爽了，碰撞体开始抱怨。稳定性 -5。",
  },
  {
    id: 6,
    emoji: "👯",
    name: "连体分身",
    place: "角色工坊",
    bug: "浅拷贝",
    anomaly: "复制出的角色，打一个两个一起掉血——共享了同一份状态。",
    desc: "工坊里有一键「复制角色」。你复制出分身去试伤害。\n你给本体喝药，分身也满血；你砍分身一刀，本体捂住了肚子。",
    logs: [
      { t: "dim", text: "[clone] Character.copy()" },
      { t: "out", text: "clone = original  // 赋值 / 浅拷贝" },
      { t: "err", text: "clone.hp 与 original.hp 指向同一块内存" },
      { t: "out", text: "damage(clone, 10) → original.hp 同步 -10" },
      { t: "dim", text: "[hint] 需要深拷贝，各自独立 hp / inventory" },
    ],
    config: `// character.ts
copy(): Character {
  // 坏了：浅拷贝 / 引用赋值
  return this;
  // 或 return { ...this };  // 嵌套的 hp 对象仍共享
  // 修好：深拷贝
  // return structuredClone(this);
}`,
    cause: "复制角色用了浅拷贝（或直接返回引用）。两个角色共享同一份 hp，伤一个等于伤两个。",
    fixText: "改成深拷贝，分身拥有独立状态。",
    exploitText: "利用共享血量：一瓶药奶两个；或者让分身挡刀，本体也……等等那是副作用。选「一药双疗」薅资源。",
    fixResult: "深拷贝就位。分身终于是分身。稳定性 +8。",
    exploitResult: "你给分身灌药，本体同步回满。药瓶经济崩溃的前夜。稳定性 -5，资源 +。",
  },
];

const ENDINGS = {
  allFix: {
    art: "🛠️",
    title: "结局 · 守夜人",
    body: "六处漏洞全部按规范修掉。\n小镇的灯还亮着，日志里只剩心跳。\n没有人回来表扬你——但系统还在，城市还在。\n你仍是最后一位维护员。这就够了。",
  },
  allExploit: {
    art: "🏴‍☠️",
    title: "结局 · Bug 领主",
    body: "六处漏洞全被你榨干。\n口袋满了，地图上多了六种「特色现象」。\n城市还在跑，只是每一次重启都更像抽奖。\n你赢得了乱斗——也把自己写进了下一场乱斗。",
  },
  mixed: {
    art: "⚖️",
    title: "结局 · 实用主义者",
    body: "有的洞堵上了，有的洞留作后门。\n小镇勉强稳定，你的背包也不空。\n维护员手册不会写这一页——\n但在没人来换班的夜里，这或许是唯一能撑下去的写法。",
  },
};

const state = {
  screen: "title",
  current: 1,
  choices: {}, // id -> 'fix' | 'exploit'
  inspected: {}, // id -> { log, config }
  phase: "intro", // intro | investigated | decided
  stability: 80,
};

// ---- DOM ----
const $ = (sel) => document.querySelector(sel);
const terminal = () => $("#terminal");
const actionsEl = () => document.querySelector("#screen-game .level-actions");

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  $(`#screen-${name}`).classList.add("active");
  state.screen = name;
}

function level() {
  return LEVELS.find((l) => l.id === state.current);
}

function scores() {
  let fix = 0, exploit = 0;
  Object.values(state.choices).forEach((c) => {
    if (c === "fix") fix++;
    if (c === "exploit") exploit++;
  });
  return { fix, exploit };
}

function updateScores() {
  const { fix, exploit } = scores();
  $("#score-fix").textContent = `修复 ${fix}`;
  $("#score-exploit").textContent = `利用 ${exploit}`;
  $("#level-label").textContent = `关卡 ${state.current} / 6`;
  const s = Math.max(0, Math.min(100, state.stability));
  const filled = Math.round(s / 10);
  $("#city-stability").textContent = "█".repeat(filled) + "░".repeat(10 - filled);
  $("#city-stability-num").textContent = `${s}%`;
}

function renderMap() {
  const map = $("#town-map");
  map.innerHTML = "";
  LEVELS.forEach((lv) => {
    const choice = state.choices[lv.id];
    const unlocked = lv.id === 1 || state.choices[lv.id - 1];
    const cell = document.createElement("div");
    cell.className = "town-cell";
    if (!unlocked) cell.classList.add("locked");
    if (lv.id === state.current && !choice) cell.classList.add("current");
    if (choice === "fix") cell.classList.add("done-fix");
    if (choice === "exploit") cell.classList.add("done-exploit");
    cell.innerHTML = `
      <span class="emoji">${lv.emoji}</span>
      <div class="name">${lv.id}. ${lv.name}</div>
      <div class="hint">${lv.place} · ${lv.bug}${choice ? (choice === "fix" ? " · 已修复" : " · 已利用") : ""}</div>
    `;
    if (unlocked) {
      cell.addEventListener("click", () => selectLevel(lv.id));
    }
    map.appendChild(cell);
  });
}

function clearTerminal() {
  terminal().innerHTML = "";
}

function termLine(cls, text) {
  const div = document.createElement("div");
  div.className = `line ${cls || ""}`;
  div.textContent = text;
  terminal().appendChild(div);
  terminal().scrollTop = terminal().scrollHeight;
}

function termPrompt(cmd) {
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = `<span class="prompt">maintainer@city:~$</span> <span class="cmd">${escapeHtml(cmd)}</span>`;
  terminal().appendChild(div);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ensureInspected() {
  if (!state.inspected[state.current]) {
    state.inspected[state.current] = { log: false, config: false };
  }
  return state.inspected[state.current];
}

function bothInspected() {
  const i = ensureInspected();
  return i.log && i.config;
}

function renderLevel() {
  const lv = level();
  const choice = state.choices[lv.id];
  $("#scene-title").textContent = `${lv.emoji} ${lv.name}`;
  $("#scene-desc").textContent = lv.desc;
  $("#anomaly-box").textContent = `异常：${lv.anomaly}`;
  $("#panel-scene-header").textContent = `${lv.place} · ${lv.bug}`;
  $("#code-area").innerHTML = "";
  $("#result-banner").className = "";
  $("#result-banner").textContent = "";
  clearTerminal();
  termLine("dim", `# 现场接入 · ${lv.place}`);
  termLine("dim", `# 输入命令或点下方按钮。建议先查日志与配置。`);

  const acts = actionsEl();
  acts.innerHTML = "";

  if (choice) {
    showResult(lv, choice);
    appendNextButton(acts);
    updateScores();
    renderMap();
    return;
  }

  // Investigation buttons
  const btnLog = button("ghost", "查日志 (L)", () => doInspectLog());
  const btnCfg = button("ghost", "看配置 (C)", () => doInspectConfig());
  const btnCause = button("ghost", "定位原因", () => doShowCause());
  acts.append(btnLog, btnCfg, btnCause);

  const btnFix = button("fix", "修复 (F)", () => doChoose("fix"));
  const btnExploit = button("exploit", "利用 (E)", () => doChoose("exploit"));
  btnFix.disabled = true;
  btnExploit.disabled = true;
  btnFix.id = "btn-fix";
  btnExploit.id = "btn-exploit";
  acts.append(btnFix, btnExploit);

  // If already inspected this session revisit
  const ins = ensureInspected();
  if (ins.log || ins.config) {
    maybeUnlockChoices();
  }

  updateScores();
  renderMap();
}

function button(cls, label, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  if (cls) b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function doInspectLog() {
  const lv = level();
  if (state.choices[lv.id]) return;
  const ins = ensureInspected();
  termPrompt("tail -n 20 /var/log/city/" + lv.id + ".log");
  lv.logs.forEach((line) => termLine(line.t, line.text));
  ins.log = true;
  maybeUnlockChoices();
}

function doInspectConfig() {
  const lv = level();
  if (state.choices[lv.id]) return;
  const ins = ensureInspected();
  termPrompt("cat /etc/city/bug_" + lv.id + ".conf");
  const pre = document.createElement("pre");
  pre.className = "code-block";
  pre.textContent = lv.config;
  $("#code-area").innerHTML = "";
  $("#code-area").appendChild(pre);
  termLine("out", "(配置已显示在下方)");
  ins.config = true;
  maybeUnlockChoices();
}

function doShowCause() {
  const lv = level();
  if (state.choices[lv.id]) return;
  if (!bothInspected()) {
    termLine("err", "信息不足：请先查日志并看配置，再定位原因。");
    return;
  }
  termPrompt("diagnose --level " + lv.id);
  termLine("out", "根因：" + lv.cause);
  maybeUnlockChoices();
}

function maybeUnlockChoices() {
  if (!bothInspected()) return;
  const bf = $("#btn-fix");
  const be = $("#btn-exploit");
  if (bf) bf.disabled = false;
  if (be) be.disabled = false;
  if (state.phase !== "decided") {
    termLine("dim", "— 根因已可判定。选择【修复】或【利用】—");
    state.phase = "investigated";
  }
}

function doChoose(kind) {
  const lv = level();
  if (state.choices[lv.id]) return;
  if (!bothInspected()) {
    termLine("err", "先查日志、看配置，再做决定。");
    return;
  }
  state.choices[lv.id] = kind;
  state.phase = "decided";
  if (kind === "fix") {
    state.stability = Math.min(100, state.stability + 8);
    termPrompt("patch --apply " + lv.id);
    termLine("out", lv.fixText);
  } else {
    state.stability = Math.max(0, state.stability - 5);
    termPrompt("exploit --use " + lv.id);
    termLine("err", lv.exploitText);
  }
  showResult(lv, kind);
  const acts = actionsEl();
  // disable choose buttons, keep inspect history
  acts.querySelectorAll("button").forEach((b) => {
    if (b.id === "btn-fix" || b.id === "btn-exploit") b.disabled = true;
  });
  appendNextButton(acts);
  updateScores();
  renderMap();
}

function showResult(lv, kind) {
  const banner = $("#result-banner");
  banner.className = "show " + (kind === "fix" ? "fix-result" : "exploit-result");
  banner.textContent = kind === "fix" ? "✓ " + lv.fixResult : "⚡ " + lv.exploitResult;
}

function appendNextButton(acts) {
  if (acts.querySelector("#btn-next")) return;
  const done = Object.keys(state.choices).length >= 6;
  const btn = button("primary", done ? "查看结局 (N)" : "下一关 (N)", () => goNext());
  btn.id = "btn-next";
  acts.appendChild(btn);
}

function selectLevel(id) {
  const unlocked = id === 1 || state.choices[id - 1];
  if (!unlocked) return;
  state.current = id;
  state.phase = state.choices[id] ? "decided" : "intro";
  renderLevel();
}

function goNext() {
  if (Object.keys(state.choices).length >= 6) {
    showEnding();
    return;
  }
  // next unfinished sequential
  let next = state.current + 1;
  while (next <= 6 && state.choices[next]) next++;
  if (next > 6) {
    // find any unfinished
    next = LEVELS.find((l) => !state.choices[l.id])?.id;
  }
  if (!next) {
    showEnding();
    return;
  }
  selectLevel(next);
}

function showEnding() {
  const { fix, exploit } = scores();
  let ending;
  if (fix === 6) ending = ENDINGS.allFix;
  else if (exploit === 6) ending = ENDINGS.allExploit;
  else ending = ENDINGS.mixed;

  $("#ending-art").textContent = ending.art;
  $("#ending-title").textContent = ending.title;
  $("#ending-body").textContent = ending.body;
  $("#ending-stats").textContent =
    `修复 ${fix} · 利用 ${exploit} · 最终稳定性 ${state.stability}%`;
  showScreen("ending");
}

function startGame() {
  state.current = 1;
  state.choices = {};
  state.inspected = {};
  state.phase = "intro";
  state.stability = 80;
  showScreen("game");
  renderLevel();
}

// ---- Events ----
$("#btn-start").addEventListener("click", startGame);
$("#btn-restart").addEventListener("click", () => {
  showScreen("title");
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  const key = e.key.toLowerCase();

  if (state.screen === "title" && (key === "enter" || key === " ")) {
    e.preventDefault();
    startGame();
    return;
  }
  if (state.screen === "ending" && (key === "enter" || key === "r")) {
    showScreen("title");
    return;
  }
  if (state.screen !== "game") return;

  if (key >= "1" && key <= "6") {
    selectLevel(Number(key));
    return;
  }
  if (key === "l") doInspectLog();
  if (key === "c") doInspectConfig();
  if (key === "f") {
    const bf = $("#btn-fix");
    if (bf && !bf.disabled) doChoose("fix");
  }
  if (key === "e") {
    const be = $("#btn-exploit");
    if (be && !be.disabled) doChoose("exploit");
  }
  if (key === "n") {
    if (state.choices[state.current]) goNext();
  }
});

// boot
showScreen("title");
