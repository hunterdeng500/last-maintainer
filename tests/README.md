# 浏览器冒烟测试

状态逻辑可直接用 Node.js 22 运行，无额外依赖：

```bash
node --test tests/*.test.mjs
```

它覆盖调查前置条件、午夜与区域门禁、重复决定、三类结局、存档校验与存储失败，以及桥边浮点落点回归、六处终端路径、碰撞半径和手动移动。

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
