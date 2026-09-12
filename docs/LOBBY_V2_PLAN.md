# Lobby V2 执行计划与依赖审阅

日期：2026-09-11。基线：本地与 GitHub master 均为 `4f9b55540d9e4a5195476a06d844268024686e43`。

GitHub 交付授权（2026-09-12）：用户追加要求“提交github”，授权将本次 Lobby V2 重构、一屏适配及对应测试提交并推送到 `master`。提交范围为文末列出的 25 个文件；既有技能规则文档改动、`artifacts/` 与 `scripts/__pycache__/` 不纳入提交。下文“未提交／未推送”描述的是各轮验收完成时的状态。

追加要求（2026-09-11）：用户要求大厅至少保证一屏，取代原始需求中“移动端允许滚动”的布局取舍。当前调整优先收紧卡片、留白、构筑与底栏换行，保持说明可读和主要触控高度不小于 44px；用无滚动、内容未裁切、按钮无需滚动即可命中的断言验收。

- [x] 定位桌面与窄屏高度来源，调整前景布局。
- [x] 在 1440×900、1366×768、1280×720、390×844、320×700 下验证中英文、高低档与四技能构筑一屏。
- [x] 完成相关回归、实际浏览器检查与截图更新。

## 一屏追加调整完成结果（2026-09-12）

本轮产品调整仅涉及 `public/lobby-v2.css`：按实际可用高度收紧上下留白、Logo、模式卡片及主区域间距；移动端构筑改成两列技能标签，昵称、编辑和加入入口保持同一行；本地 FX LAB 入口预留实际高度。主按钮至少 50px，其余大厅控件至少 44px。小高度手机隐藏重复的“开始对局 / Play”视觉标题，仍保留其无障碍语义。没有用裁切或禁止纵向滚动来制造一屏结果。

`auditLobbyLayout` 增加整页无滚动、头部/主体/底栏完全在视口内的检查，并在滚动位置为零时检查所有按钮是否可命中；删除会掩盖裁切的自动滚动到控件行为。布局矩阵覆盖 1440×900、1366×768、1280×720、390×844、320×700 × 中英文 × 高低档 × Classic/Skills，Skills 均使用四技能、8/8 负载。触屏场景同时保留一屏滑动不误触，以及 320×460 下真实滚动取消按压的检查。

| 本轮验证 | 结果 | 命令退出码 |
| --- | --- | ---: |
| verify:lobby-v2 | 58 个场景、593 项检查，0 失败 | 0 |
| verify:lobby-feedback | 13 个场景，0 失败 | 0 |
| verify:ui | mobile、onescreen、rulebook 三个子脚本通过 | 0 |
| JS 语法与 git diff --check | 两个更新的测试脚本与差异检查通过 | 0 |

实际浏览器追加检查：1280×720 中文低档技能大厅、390×844 英文低档技能大厅、320×700 英文高档技能大厅，页面高度分别等于 720、844、700；底栏完整在屏幕内。320×700 的所有大厅控件均在视口内、可命中且高度至少 44px。窄屏加入弹窗可正常打开，Esc 关闭后焦点返回加入入口；语言和动画设置可正常操作。验收后恢复原有中文、低档、默认模式及正常预览尺寸，用户已保存构筑保留。

本轮 51 张截图与独立验证汇总保存在 `artifacts/lobby-one-screen-20260911/`，`review.html` 可查看重点尺寸对照。截图等待连接提示自然消失后再拍摄。本轮统计与下方首轮重构结果分开记录。

当前一屏验收下限为 320×700；320×568 的部分英文或技能布局仍会纵向滚动。长昵称和长技能名可省略，编辑昵称与 Skill Lab 保留完整信息。未进行真实手机实机验收，也未量化帧率、耗电或软键盘表现。未提交、未 push、未部署、未创建 PR。

以下为首轮 Lobby V2 重构的审阅与实施记录，其中“移动端允许滚动”的验收取舍已由上方一屏追加要求取代。

本轮只修改客户端大厅与对应验证，不提交、不推送、不部署、不创建 PR，不使用子代理。

## 只读审阅（已完成）

已定位并阅读 Lobby DOM、Salon/基础/反馈样式、反馈控制器、客户端模式和昵称入口、两种语言目录、构筑读取/保存/合法性校验、匹配/建房/人机/加入/密码流程、请求 pending、教程焦点、房间恢复及相关自动验证。

依赖关系：

- 主模式 → `setSkillMode` → `state.skillMode` → 两张卡的 `aria-checked` 与构筑行。
- 高爆开关 → `setMode` → `state.gameMode` → 开关 `aria-checked`。
- 中央启动按钮 → 当前 state → `startMatchAction` / `startRoomAction` → `requireLoadoutForSkillMode` → 原有请求与 Socket。非法构筑经 `pendingRoomAction` 进入 Skill Lab，保存后续接原操作。
- 构筑行 → `validateLoadoutIds(state.savedLoadout)` 与原有 catalog / limits；仅投影，不引入第二套校验，不因切换模式修改构筑。
- 昵称编辑 → `setPlayerName` → `state.myName` / `STORAGE.playerName` / 页面显示；所有入口由 `getEffectivePlayerName` 读取，移除旧 `input-name`。
- 加入入口 → 轻量 Join Modal → 原 `pendingJoinRoomId` / `emitJoin` / 密码流程；不根据大厅选择改写目标房间模式。
- 新弹窗 → 原 `setModalVisible` / `syncModalIsolation` / Tab 约束；关闭回到真实 opener。
- Quick Start → 保留内容、翻页、图片缩放；结束与关闭统一返回 opener，移除旧卡片焦点依赖。
- Feedback → 稳定 `data-lobby-mode-card`，增加 `aria-checked` 监听；保留指针取消、键盘单次触发、稳定点击边界及高／低两档。
- Reconnect → 原 roomId / token / playerId 及房间恢复；服务端房间中的本人昵称用于恢复客户端显示。

审阅判断：服务端 `player1` / `player2` 仅在未提供昵称时按座位兜底，身份判定使用 playerId 与 reconnectToken。未发现测试依赖客户端按操作发送不同默认昵称。因此大厅统一显示并发送明确的 `player1` 缺省身份，服务端兜底逻辑保持原样。

需替换的旧测试依赖：四张 protocol card、12 个嵌套按钮、隐藏模式 radio、旧昵称输入、大构筑条、大教程横条及 selected protocol 焦点。手机绝对一屏与空白高度断言改为实际可达、无遮挡、可正常滚动和无横向溢出检查；牌桌、Skill Lab 既有布局覆盖保留。

## 执行步骤

- [x] 完整只读依赖审阅、确认最新 master 与既有脏文件边界。
- [x] 两个选择维度、统一启动入口、昵称及 Join Modal、状态同步。
- [x] 保留现有背景与 Logo，完成两卡、Modifier、条件构筑行、导航、底栏和响应式。
- [x] 反馈、焦点、键盘、触屏取消以及中英文适配。
- [x] 迁移旧 UI 测试，新增 Lobby V2 状态/昵称/动作/异常构筑专项并加入 CI。
- [x] 完整回归、桌面与手机模拟浏览器验收、截图与完成记录。

## 验收范围

四种合法模式组合、三个启动动作、构筑合法/空/数量错误/超载/目录未就绪、Classic 不清空构筑、昵称显示与持久化及发送一致、Join 与密码、Reconnect、键盘 radio / switch、指针取消、真实 opener 焦点、快速弹窗反向操作。

1440×900、390×844、320×700 × zh-CN/en-US × high/low。移动端允许正常滚动，保持文字与触控区域可用。

运行 npm test、verify:visual-quality、verify:lobby-feedback、verify:lobby-v2、verify:ui（含 rulebook）、verify:interactions、verify:online、verify:i18n、verify:skill-fx、JS 语法与 git diff --check。

产物保存在本地 `artifacts/lobby-v2-20260911/`，不加入 Git。未进行真实手机实机验收，也不以浏览器模拟代替实机或量化性能结论。

## 完成结果

信息架构已由 4 张组合卡 × 3 个动作，改成 2 张主模式卡 + 1 个高爆牌面 Modifier + 3 个中央启动操作。Classic 对应 `skillMode=off`，Skills 对应 `skillMode=abyss`；高爆关闭/开启分别对应 `gameMode=standard/overdrive`。默认仍为 Classic + Standard，未新增模式持久化。

已删除旧 protocol cards/buttons、summary、顶部 mode pills、大构筑条、大 Quick Start 横条、大 Join Panel、旧隐藏 radio 与旧昵称输入。客户端和反馈控制器不再查询旧结构。规则手册及牌桌技能效果中含 protocol 的名称属于既有游戏功能，保留。没有 legacy compatibility DOM。

技能构筑完全复用原有合法性判断；Classic 隐藏且不占高度，不修改已保存构筑。无效构筑的 Match/Solo/Create 均先进入原 Skill Lab continuation；目录未就绪不发送非法启动请求。

昵称通过 `setPlayerName` 写入 `state.myName`、原 `STORAGE.playerName`（sessionStorage）和底栏显示；四类 Socket 请求统一读取 `getEffectivePlayerName`。编辑输入可选字、全选和取消。Join Modal 沿用原房间号、密码、pending 和重连流程。

Quick Start 关闭/完成回到实际 opener。新 radio 与 switch 使用 `aria-checked`，反馈控制器监听真实状态变化，保留按压取消、触屏滚动取消、焦点清理和键盘单次触发。高/低两档保留；低档不做缩放回弹。

## 验证结果（2026-09-11）

| 验证 | 统计口径 | 通过 | 失败 |
| --- | --- | ---: | ---: |
| npm test | 单元测试；28 个 suite | 508 | 0 |
| verify:lobby-v2 | 49 个场景、445 项检查 | 49 场景 / 445 检查 | 0 |
| verify:visual-quality | 档位与旧设置迁移场景 | 10 | 0 |
| verify:lobby-feedback | 12 个视口/语言/档位组合及触屏取消场景 | 13 | 0 |
| verify:ui | mobile、onescreen、rulebook 三个子脚本 | 3 | 0 |
| verify:interactions | 整套端到端交互回归 | 1 | 0 |
| verify:i18n | 整套国际化回归 | 1 | 0 |
| verify:online | 整套联机与房间同步回归 | 1 | 0 |
| verify:skill-fx | 整套既有 Skill FX 回归 | 1 | 0 |

以上命令均实际退出 0；不把不同统计口径相加。16 个修改/新增 JavaScript 文件的 `node --check` 通过，`git diff --check` 通过。中途发现并修正旧布局检查的浏览器生命周期顺序、测试构筑负载预期、本地调试入口导致的桌面额外滚动。旧测试按新 UI 迁移，不以跳过或强制点击代替可达性检查。项目没有已有 lint/format script。

浏览器人工验收使用 CUA 操作实际本地页面：1440×900 桌面；390×844、320×700 手机模拟；四种模式组合、合法和空构筑、昵称、Join、中英文、高低画质、教程关闭焦点均检查。空构筑使用另一 loopback origin 验证，用户已有构筑保留，昵称编辑取消，语言/画质恢复原偏好。

保存 35 张 Lobby V2 专项截图，包含要求的七个命名文件；`artifacts/lobby-v2-20260911/review.html` 可并排查看，`verification-summary.json` 与各 `.log` 保存结果。

首轮边界（320×700 滚动问题已在上方追加调整中修复）：320px 英文技能大厅需要正常纵向滚动；长技能名使用省略并保留 title，完整说明在 Skill Lab；未量化帧率/耗电，未验证真实移动端软键盘与输入法表现。未进行真实手机实机验收。

未提交、未 push、未部署、未创建 PR。既有技能规则文档改动、原 artifacts 和 scripts/__pycache__ 保留。

## 修改文件职责

| 文件 | 职责 |
| --- | --- |
| public/index.html | 新大厅结构、两卡/开关/三个动作、导航/底栏及两个轻量弹窗 |
| public/client.js | state 投影、权威昵称、动作入口、构筑、Join、焦点及恢复适配 |
| public/lobby-v2.css | 新增仅针对大厅前景的布局、颜色层级、间距及响应式 |
| public/style.css | 删除旧大厅结构样式，保留共享控件和牌桌样式 |
| public/salon.css | 删除旧四卡/大面板规则，保留背景、Logo 与 Salon 身份 |
| public/lobby-feedback.js | 新模式卡 target、aria-checked 观察及新增弹窗反馈范围 |
| public/lobby-feedback.css | 新卡片选中与内部绘制层适配、旧卡片皮肤清理 |
| public/visual-quality.css | 移除旧 protocol-card 悬浮选择器；新模式卡由原生 button 策略覆盖 |
| public/i18n/catalog-zh-CN.js | 新大厅与昵称/Join 文案 |
| public/i18n/catalog-en-US.js | 新大厅英文及适用于单/多技能的就绪文案 |
| scripts/lobby-test-helpers.js | 新增真实指针选择/启动/编辑 helper 与滚动可达性、遮挡、裁切检查 |
| scripts/verify-lobby-v2.mjs | 新增状态组合、三类启动、非法构筑、昵称、Join/重连、键盘、触屏和截图专项 |
| scripts/verify-lobby-feedback.mjs | 迁移反馈目标，验证独立点击边界和昵称输入选择 |
| scripts/verify-ui-interactions.mjs | 迁移交互、构筑状态文案和教程 opener 断言 |
| scripts/verify-mobile-onescreen.js | 大厅改为实际可达性检查；保留牌桌/构筑屏验证，移除强制点击 |
| scripts/verify-ui-onescreen.mjs | 迁移大厅结构检查；保留桌面一屏要求与既有其他屏幕验证 |
| scripts/verify-i18n.mjs | 通过新模式选择和昵称入口执行既有国际化回归 |
| scripts/verify-skill-solo.js | 通过新中央动作启动技能人机冒烟流程 |
| scripts/verify-allin-direct.js | 通过新中央动作进入原 All In 验证流程 |
| scripts/capture-ui-review.mjs | 截图工具迁移到新入口 |
| scripts/capture-tutorial-en.mjs | 英文教程截图工具迁移入口；本轮未改写图片资产 |
| tests/frontendContract.test.js | DOM 契约由隐藏四组合结构改为两卡/开关/三个动作及无旧依赖 |
| package.json | 注册 verify:lobby-v2 |
| .github/workflows/ci.yml | 将新专项接入原 CI 验证序列 |
| docs/LOBBY_V2_PLAN.md | 审阅依赖图、决策、执行与验收记录 |
