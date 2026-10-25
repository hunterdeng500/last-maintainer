# 浏览器冒烟测试

状态逻辑可直接用 Node.js 22 运行，无额外依赖：

```bash
node --test tests/*.test.mjs
```

它覆盖调查前置条件、午夜与区域门禁、重复决定、三类结局、存档校验与存储失败，以及桥边浮点落点回归、六处终端路径、碰撞半径和手动移动。`story.test.mjs` 补充检查阶段解锁、通讯证据条件、独立已读标记、新字段校验与旧版存档兼容；技术原因仍由同一套六处故障数据提供。

2.5D 回归另覆盖建筑南缘与屋顶后方通行、主路净宽、加减速、30–120fps 下同距离移动、反向接管、停下清除惯性和贴墙滑动。

测试只用于开发，游戏本身不需要 Node.js 或 Playwright。先按项目 README 启动本地 HTTP 服务，再准备 Playwright：

```bash
npm install --prefix /tmp/last-maintainer-qa playwright
npx --prefix /tmp/last-maintainer-qa playwright install chromium
PLAYWRIGHT_MODULE=/tmp/last-maintainer-qa/node_modules/playwright/index.mjs \
  node tests/browser-smoke.mjs
```

如果本机已有 Chrome，可以跳过下载浏览器并设置 `CHROME_PATH`。例如 macOS：

```bash
PLAYWRIGHT_MODULE=/tmp/last-maintainer-qa/node_modules/playwright/index.mjs \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  node tests/browser-smoke.mjs
```

可选环境变量：

| 名称 | 默认值 | 用途 |
| --- | --- | --- |
| `GAME_URL` | `http://127.0.0.1:8765/` | 本地游戏地址 |
| `PLAYWRIGHT_MODULE` | `playwright` | Playwright 或 playwright-core 的模块路径 |
| `CHROME_PATH` | Playwright 管理的 Chromium | 指定本机 Chrome |
| `QA_ARTIFACTS` | `/tmp/last-maintainer-qa-artifacts` | 截图和 JSON 测试报告目录 |

脚本使用独立浏览器上下文，不读取个人浏览器资料。覆盖正常入口、六处故障的实际移动与调查、日志和配置前置条件、区域门禁、碰撞、时钟和长椅、地图和日志、存档继续、三类结局，以及浏览器脚本错误与失败请求。调试入口只用于读取测试状态和补充结局分支，不代替主流程的鼠标行走与选择。

同样的环境变量也可用于额外的画面验证：

```bash
PLAYWRIGHT_MODULE=/tmp/last-maintainer-qa/node_modules/playwright/index.mjs \
  node tests/browser-depth.mjs
```

该脚本验证屋顶前后遮挡、投影层级、平滑镜头、点击映射和减少动态效果，保存六处日景、东岸夜景与桌面/手机截图，并记录预热后的 Canvas 绘制耗时和实际动画帧间隔的中位数及 P95。结果仅反映测试设备和浏览器，不代表所有设备的帧率。默认产物目录为 `/tmp/last-maintainer-25d-depth`，可用 `QA_ARTIFACTS` 更改。

《机器休止》主题演绎另有故事流程冒烟，使用同样的环境变量：

```bash
PLAYWRIGHT_MODULE=/tmp/last-maintainer-qa/node_modules/playwright/index.mjs \
  node tests/browser-story.mjs
```

它检查可跳过的接班序言、处理 2 处后的禁断接触、处理 4 处后的停止揭示、处理 6 处后的最后交接与三种结局，以及 `J` 手记中的通讯解锁和重读、刷新继续、窄屏面板与脚本错误。故事文字不增加第七处任务；完整阅读不是维护选择的前置条件。25–40 分钟是叙事体量的设计目标，自动化脚本的运行时长不能作为实际阅读时长。

## 受限环境中的替代检查

如果执行环境不允许绑定 HTTP 端口，可运行：

```bash
python3 tests/http-smoke.py
```

脚本在内存中调用 Python 的实际 `SimpleHTTPRequestHandler`，对入口、CSS 与完整 ES module 依赖图检查 `200 OK`、MIME、文件内容以及 HTML 的重复 ID。它不打开 socket，不模拟浏览器，也不证明视觉布局正确。

`game-story.test.mjs` 使用零依赖 DOM 测试环境加载真实 `index.html`、`game.js`、世界、角色与状态模块，检查键盘操作六关、阶段顺序、三种结局、通讯及旧档刷新。它已包含在 `node --test tests/*.test.mjs` 中，也可单独执行：

```bash
node --test tests/game-story.test.mjs
```

本次沙箱实测拒绝 Python 绑定端口（`Errno 1`），Chrome 启动也被拒绝（`SIGABRT / EPERM`），因此真实 HTTP 端口与 Playwright 画面验收未执行。DOM 集成测试中的绘图接口只作占位；Canvas 绘制、浏览器原生 `<dialog>` / `<details>` 行为及窄屏布局仍需在允许启动浏览器的环境中使用上述脚本复核。
