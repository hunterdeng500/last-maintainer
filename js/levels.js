/** Six visible failures left behind after the official human evacuation. */
export const LEVELS = [
  {
    id: 1,
    emoji: '🪙',
    name: '负金币铺',
    place: '杂货铺',
    bug: 'int16 溢出',
    reward: 30,
    anomaly: '钱包余额越过 32767 后变成负数，自动柜台反而向顾客退款。',
    desc: '撤离之后，店主程序仍按旧日的时间开门。一个配送机器人领到补贴，柜台上的余额突然翻成负数。\n「您购买了面包。系统还欠您 3000 金币。」合成语音又重复了一遍。',
    logs: [
      { t: 'dim', text: '[ledger] 打开交易流水 ledger.dat' },
      { t: 'out', text: 'TX#8821  buyer=配送单元  gold_before=32760' },
      { t: 'out', text: '补贴 +20 → 16 位写回 0x800C → gold_after=-32756' },
      { t: 'err', text: '[WARN] balance < 0，触发「店主债务」分支，退款 3000' },
      { t: 'dim', text: '[hint] 账本按有符号 16 位二进制补码解码：-32768 … 32767' },
    ],
    config: `// wallet.py — 旧账本的 16 位打包逻辑
from ctypes import c_int16

def credit(wallet, amount):
    wallet.gold = c_int16(wallet.gold + amount).value
    if wallet.gold < 0:
        refund_from_shop(3000)

# 修复：迁移到 int64 账本，并在写入前验证范围。
# 补贴与债务应分别记账，不能仅按余额符号退款。`,
    cause: '旧账本把结果截断到有符号 16 位。32760 + 20 被写成 -32756，随后错误进入债务退款分支。',
    fixText: '迁移到更宽的整数，检查写入范围，并核对负余额的业务含义。',
    exploitText: '把余额反复推过溢出边界，提走自动柜台的应急退款。',
    fixResult: '账本迁移完成。补贴与债务重新对齐。稳定性 +8，维护资源 +8。',
    exploitResult: '三笔退款被转入你的备用账户。商店储备开始亏空。稳定性 -5，资源 +30。',
  },
  {
    id: 2,
    emoji: '🕛',
    name: '午夜折扣门',
    place: '夜市入口',
    bug: '只比 HH:MM',
    reward: 38,
    anomaly: '第二天已经到来，昨晚的一次性半价活动仍亮着绿灯。',
    desc: '告示牌写着「第 1 天 23:00—23:59，最后一场半价」。午夜已过，自动摊位却没有收到结束指令。\n值守机器人看着完整日期，又看了一眼绿灯：「已经不是昨天了。对吗？」',
    logs: [
      { t: 'dim', text: '[event] night_market_half / 一次性活动 / 回放午夜采样' },
      { t: 'out', text: 'start = 2026-10-25 23:00  end = 2026-10-25 23:59' },
      { t: 'out', text: 'now = 2026-10-26 00:00; started = now >= start → true' },
      { t: 'err', text: 'expired = now.HHMM > end.HHMM → 00:00 > 23:59 → false' },
      { t: 'err', text: 'active = started && !expired → true（本应已经结束）' },
      { t: 'dim', text: '[hint] 启动使用完整时间戳；过期检查单独丢掉了日期。' },
    ],
    config: `# event_scheduler.py — 日期已固定的一次性活动
start = datetime(2026, 10, 25, 23, 0)
end   = datetime(2026, 10, 25, 23, 59)

def is_active(now):
    started = now >= start  # 这一步包含日期
    expired = now.strftime('%H%M') > end.strftime('%H%M')
    return started and not expired

# 修复：同一时区的完整时间戳比较
# expired = now > end`,
    cause: '活动按完整时间戳启动，但过期只看 HH:MM。第二天的 00:00 小于 23:59，expired 仍为 false，一次性折扣因此一直没有关闭。',
    fixText: '让过期判断也比较完整时间戳，保留日期和一致的时区。',
    exploitText: '借永不结束的半价调走夜市库存，补满自己的撤离储备。',
    fixResult: '时间戳校准完成。昨夜的活动终于结束，库存重新封存。稳定性 +8，维护资源 +8。',
    exploitResult: '半价订单连续获批。储备车满载离开，摊位货架逐一变空。稳定性 -5，资源 +38。',
  },
  {
    id: 3,
    emoji: '🚪',
    name: '半开的门',
    place: '机房侧门',
    bug: '竞态条件',
    reward: 46,
    anomaly: '安保与清洁机器人同时操作侧门，锁舌伸出时门板还开着。',
    desc: '安保单元请求关门，清洁单元请求开门。两条控制指令交错执行，门板卡在一半，马达不断空转。\n机房报警屏上，OPEN 与 LOCKED 两盏灯同时亮了。',
    logs: [
      { t: 'dim', text: '[door] 两个并发控制任务，没有串行队列' },
      { t: 'out', text: 'T0  清洁：unlock()      T1  清洁：motor.open()' },
      { t: 'out', text: 'T2  安保：motor.close() T3  安保：lock()' },
      { t: 'err', text: '开门任务仍在运动；锁舌提前伸出 → angle=41°, bolt=LOCKED' },
      { t: 'dim', text: '[hint] 多步骤门控操作没有互斥，单个字段赋值不能保护整个事务。' },
    ],
    config: `// door_controller.js
async function openDoor() {
  await door.unlock();
  await door.motor.open();
}
async function closeDoor() {
  await door.motor.close();
  await door.lock();
}
// 两个异步任务会在 await 处交错执行。
// 修复：所有开/关请求共用一个队列或互斥锁，
// 完整串行执行动作，且确认位置后再上锁。`,
    cause: '开门与关门是多步骤操作。并发任务在等待马达时交错，关门任务尚未确认位置就落锁，造成实际门板与锁状态矛盾。',
    fixText: '给所有门控任务共用的队列加互斥，并校验门板位置反馈。',
    exploitText: '从门缝绕过访问登记，取走机房的备用能源模块。',
    fixResult: '控制任务开始排队，门板归位后锁舌才落下。稳定性 +8，维护资源 +8。',
    exploitResult: '备用能源到手。门禁仍反复拉扯，磨损没有停止。稳定性 -5，资源 +46。',
  },
  {
    id: 4,
    emoji: '👻',
    name: '还活着的 Boss',
    place: '竞技场缓存',
    bug: '缓存未失效',
    reward: 54,
    anomaly: '训练 Boss 已经倒下，大屏还显示存活，旧战斗入口仍可领取奖励。',
    desc: '竞技场是人类离开前的训练设施。观众席空空荡荡，大屏却还循环播放 Boss 的最后一格血。\n回收机器人搬走奖箱后，新的奖箱又沿着传送带滑了出来。',
    logs: [
      { t: 'dim', text: '[cache] 查询 boss:arena_01' },
      { t: 'out', text: 'DB status=DEAD  kill_id=K-18  reward_claimed=true' },
      { t: 'err', text: 'CACHE status=ALIVE  ttl=∞  击杀后未 invalidate' },
      { t: 'err', text: '训练入口读 CACHE；结算缺少 kill_id 唯一领取校验' },
      { t: 'dim', text: '[hint] 旧缓存重新开放战斗，重复结算继续出货。' },
    ],
    config: `// boss_repo.js
async function killBoss(id) {
  await db.update(id, { status: 'DEAD' });
  // 缺少：await cache.invalidate('boss:' + id);
}
async function enterArena(id) {
  return (await cache.get('boss:' + id)).status === 'ALIVE';
}
// 修复：使缓存失效，并让奖励在数据库事务内
// 按 kill_id 唯一结算，重试不能再次发奖。`,
    cause: '击杀写库后没有使缓存失效，训练入口持续读取旧的 ALIVE 状态。结算又缺少幂等校验，于是同一场击杀可以重复领奖。',
    fixText: '清除旧缓存，为击杀奖励增加唯一领取记录和幂等校验。',
    exploitText: '再次进入已经结束的训练，提取重复生成的物资奖励。',
    fixResult: '缓存与数据库重新一致。训练大屏熄灭，奖箱不再复制。稳定性 +8，维护资源 +8。',
    exploitResult: '你装走了重复奖励。城市库存的账面数字与实物继续分离。稳定性 -5，资源 +54。',
  },
  {
    id: 5,
    emoji: '🦘',
    name: '一跳出界',
    place: '训练场',
    bug: '米/厘米混用',
    reward: 62,
    anomaly: '测试机器人轻跳一下就飞越围墙，轨迹越过了地图边界。',
    desc: '跳跃测试仍在无人值守地运行。一个小机器人弯下膝盖，下一秒变成夜空里的亮点。\n它的安全绳绷得笔直。配置面板上，只写着一个没有单位的数字：120。',
    logs: [
      { t: 'dim', text: '[physics] jump configuration → engine adapter' },
      { t: 'out', text: 'config.jump_speed = 120  // 配置作者使用 cm/s' },
      { t: 'err', text: 'engine.setVerticalSpeed(120)  // 接口要求 m/s' },
      { t: 'out', text: 'velocity.y = 120 m/s → 速度被放大 100 倍，越过训练边界' },
      { t: 'dim', text: '[hint] 这里配置的是速度；冲量的单位应为 kg·m/s。' },
    ],
    config: `# movement.yaml
jump_speed: 120          # 原意是 120 cm/s，字段未标单位

# physics_adapter.py
engine.set_vertical_speed(config.jump_speed)  # 接口：m/s

# 修复：在边界显式转换，并命名单位。
# jump_speed_cm_s: 120
# engine.set_vertical_speed(config.jump_speed_cm_s / 100)`,
    cause: '跳跃速度的配置使用厘米每秒，引擎接口要求米每秒。适配层没有换算，速度被放大了 100 倍。',
    fixText: '在接口边界换算单位，明确字段名称，并限制安全速度。',
    exploitText: '利用超速弹射越过货运围栏，把高处的储备箱拖回来。',
    fixResult: '速度恢复为 1.2 m/s。测试机器人平稳落地。稳定性 +8，维护资源 +8。',
    exploitResult: '储备箱落进背包。超速的测试继续撞击边界，物理服务逐渐过载。稳定性 -5，资源 +62。',
  },
  {
    id: 6,
    emoji: '👯',
    name: '连体分身',
    place: '角色工坊',
    bug: '浅拷贝',
    reward: 70,
    anomaly: '两个测试分身共用生命值，给一个充能，另一个的读数也一起上涨。',
    desc: '工坊自动复制了两个维修替身。它们有不同的编号，却同时捂住了受损的胳膊。\n充能台只接上一条线，两块生命读数却同步回满；连备用零件清单也一模一样。',
    logs: [
      { t: 'dim', text: '[clone] Character.copy() / 嵌套对象引用检查' },
      { t: 'out', text: 'clone = { ...original }; clone !== original → true' },
      { t: 'err', text: 'clone.stats === original.stats → true（hp 属于 stats）' },
      { t: 'out', text: 'clone.stats.hp -= 10 → original.stats.hp 同步 -10' },
      { t: 'dim', text: '[hint] 只复制了外层对象，stats 与 inventory 仍是共享引用。' },
    ],
    config: `// character.js — 可结构化复制的纯数据
const original = {
  id: 'unit-A', stats: { hp: 80 }, inventory: ['cell']
};
const clone = { ...original, id: 'unit-B' }; // 浅拷贝
clone.stats.hp += 20;  // original.stats.hp 也变成 100

// 修复：深拷贝可变的角色数据，身份单独分配。
// const clone = structuredClone(original);
// clone.id = 'unit-B';`,
    cause: '对象展开仅复制外层。两个分身的 stats 和 inventory 仍指向同一份可变数据，所以伤害、治疗和库存变化都会同步。',
    fixText: '深拷贝可变角色数据，为新分身分配独立身份和库存。',
    exploitText: '一次充能同步填满多个分身，提走原本为它们预留的能源。',
    fixResult: '生命值与库存终于各自独立。工坊重新生成了完整的维修轮值。稳定性 +8，维护资源 +8。',
    exploitResult: '充能额度被重复兑现。共享状态继续扩散，工坊失去最后的隔离边界。稳定性 -5，资源 +70。',
  },
];

export const ENDINGS = {
  allFix: {
    art: '✦',
    title: '结局 · 永久值守',
    subtitle: '城市继续运行。你的轮班没有终点。',
    body: '六处故障全部修复，街灯重新连成温暖的光线，机器人又开始各自的日程。\n人类已经撤离，没有人回来接班。城市继续运转，也一直需要维护。\n你保存了这座城，却永远无法离开。\n下一次巡检，已经排进日程。',
  },
  allExploit: {
    art: '↗',
    title: '结局 · 最后一次离线',
    subtitle: '城市彻底停摆。你终于自由。',
    body: '你利用了全部六处漏洞。被抽空的库存、失控的门控和共享状态让旧系统接连失效。\n城市全面崩溃，街灯一盏盏熄灭。再没有等待处理的工单。\n你带着积攒的资源走出小镇。这一次，你终于自由了。\n人类早已离开。现在，最后一位维护员也离开了。',
  },
  mixed: {
    art: '◐',
    title: '结局 · 未完成的黎明',
    subtitle: '一部分灯仍亮着，出口仍未完全打开。',
    body: '你修好了部分故障，也从其余漏洞里取走了一些储备。\n城市勉强运转。有些街灯亮着，有些终端再也没有回应。\n你的工具包还在，背包也不空。你得到了一点喘息的时间，却还不能彻底离开。\n你留在半明半暗的路口，等待下一个清晨。',
  },
};

export function getLevel(id) {
  return LEVELS.find((level) => level.id === Number(id));
}

export function getNightMarketInfo(time) {
  const total = Number.isFinite(time) ? Math.max(0, time) : 0;
  const start = 23 * 60;
  const end = 23 * 60 + 59;
  const minuteOfDay = Math.floor(total) % 1440;
  // The one-time event starts against a full timestamp. Only expiry loses its date.
  const active = total >= start && !(minuteOfDay > end);
  return { now: total, start, end, active, anomalous: active && total >= 1440 };
}
