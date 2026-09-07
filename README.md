# dsh-task-notice

DeepSeek Harness 插件:**代理任务完工通知 + 按 API Key 的 Token 消耗统计 + 安全启动**。

- **完工通知**:代理每完成一轮任务(或目标 goal 完成)时,在 Web 界面弹出通知,并**经浏览器 Web Notifications API 发送 Windows 系统通知**(桌面右下角横幅 + 操作中心;需页面授权,点击通知回到本页),展示本次任务消耗的 tokens(缓存输入 / 缓外输入 / 输出 / 合计)。
- **操作提醒**:对话需要你处理时同样提醒——代理发起**权限请求**(批准/拒绝)或**提问**(等待你回答)时,页内弹窗 + 系统通知(遵循系统通知开关与发送时机设置)。实现上订阅官方 UI 的待处理交互存储(`uiSession.pendingInteractions`)做纯观察,**不参与** `approval/request`、`user-questions/request` 的应答链,绝不干扰审批/提问对话框。
- **消耗统计**:每次模型调用结束后记录其 usage,并按请求实际使用的 API Key 归集。插件设置页支持 **1 年 / 6 个月 / 3 个月 / 1 个月 / 15 天 / 1 周 / 24 小时 / 自定义** 时间范围,查看所有 Key 的 tokens 消耗量(分「缓存输入 / 缓外输入 / 输出」),附带调用次数、按 Key 的按模型明细与**跨 Key 的按模型消耗总览**。
- **安全启动**:插件启动时先做安全检测——DSH 版本兼容性、冲突插件、重复挂载、服务命名空间占用。任一命中即**取消插件运行**(只保留健康查询供前端说明原因),DSH 照常启动,不会被插件拖垮。apply() 全程 try/catch,任何异常都只让本插件失效。

## 安装

**推荐:打包成 tarball 安装**(Windows 下 `dsh plugin add <路径>` 会被 pnpm 变成 `link:` 依赖,而 junction 的真实路径会破坏 Node 的模块解析——插件虽然做了导入级安全兜底不会让 DSH 挂掉,但功能无法启用):

```sh
# 1. 在插件源码目录执行,产出 tarball(文件名形如 dsh-task-notice-<版本>.tgz)
pnpm pack

# 2. 安装:把 <tarball 路径> 替换为上一步产出的文件的实际路径
#    (路径含空格时请加引号;要装到非默认 profile 时加 --profile <profile 名>)
dsh plugin add <tarball 路径>
```

> `dsh plugin add` 会先 `pnpm add` 安装依赖,再把声明了 `dsh.bundle.patch` 的包加入 `dsh.profile.bundles` 层栈。完成后重启 DSH(如 `dsh web`)生效——即使该 profile 的 `patchReload` 为 live,依赖变更也需要重启。
>
> 直接用 `dsh plugin add <目录>` 也可以安装(插件会安全降级为停用状态而不是拖垮 DSH),但要用完整功能请用上面的 tarball 方式。

卸载:

```sh
dsh plugin remove dsh-task-notice
# 装到了非默认 profile 时,加上对应参数,例如:
# dsh plugin --profile <profile 名> remove dsh-task-notice
```

## 使用

### 完工通知

- 每个**顶层会话**(非 subagent)完成一轮任务时,浏览器端收到通知帧后在 Web 界面右上角弹出 toast,**并按配置经 Web Notifications API 发送 Windows 系统通知**(桌面右下角横幅 + 操作中心);内容为本轮消耗(缓存输入 / 缓外输入 / 输出 / 合计)。
- 目标(goal)完成时同样触发系统通知与网页弹窗,显示该目标自创建以来的总消耗。
- 代理发起**权限请求**或**提问**(等待你回答)时,也会触发同样的页内弹窗 + 系统通知提醒你处理(通过观察官方 UI 的待处理交互存储实现,不影响对话框本身)。
- 系统通知由**浏览器 Web Notifications API**发出(不再依赖宿主 PowerShell):需先在插件设置页点击「授权并开启」(浏览器要求用户手势授权;GUI 需运行在 HTTPS 或 localhost 安全上下文)。开启后,Edge/Chrome 会调用 Windows Notification Platform API,把通知交给 Windows 操作中心统一管理与显示——桌面右下角弹出横幅、存入操作中心;**点击通知浏览器自动聚焦回本页面**。
- 发送时机可选:默认「仅页面后台时发送」(正在看本页时只显示页内弹窗,切走/最小化后才发系统通知);也可取消该选项,让每次完成都发系统通知。
- 网页弹窗自动消失(默认 15 秒,可配),也可手动关闭;页面隐藏期间弹窗挂起,回到页面后继续计时。

### 消耗统计

打开 **设置(Settings)→ 任务通知与消耗**,即可:

1. 选择时间范围:24小时 / 1周 / 15天 / 1个月 / 3个月 / 6个月 / 1年 / 自定义(自定义支持起止日期时间)。
2. 查看汇总卡片(总消耗、调用次数、缓存输入、缓外输入、输出)。
3. 查看**按 Key 的表**:每个 API Key 一行,列出调用次数、缓存输入、缓外输入、输出与合计;展开可看按模型明细。
4. 查看**按模型消耗总览**:跨全部 Key 聚合每个模型(提供商 · 型号)的调用次数与各类 tokens 消耗,一眼看出不同模型的用量。

> 口径:缓存输入 = `cacheReadTokens`(命中缓存);缓外输入 = `inputTokens`(未命中缓存);输出 = `outputTokens`。消耗按每次模型调用的 provider 上报 usage 记账,并按请求所用凭证(如 `DEEPSEEK_API_KEY`)归集。

### 插件配置

打开 **设置 → 任务通知与消耗** 页,底部即可调整:

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| 插件总开关 | 关闭后停止通知与记账 | 开 |
| 每轮任务弹窗 | 每完成一轮任务即弹窗 | 开 |
| 目标完成弹窗 | 目标(goal)完成时弹窗 | 开 |
| 权限请求提醒 | 代理请求权限时通知你处理 | 开 |
| 提问提醒 | 代理提问需要你回答时通知 | 开 |
| 弹窗时长(秒) | 弹窗自动消失秒数(3–120,滑块) | 15 |
| 浏览器系统通知 | 经 Web Notifications API 发送系统通知(需页面授权;Edge 横幅 + 操作中心) | 开 |
| 仅后台时发送 | 页面在前台时只显示页内弹窗,切到后台/最小化后才发系统通知 | 开 |
| 账本保留天数 | 消耗账本保留天数(1–3650,滑块) | 365 |

另可在 profile 的 loader 行(`cordis.patch.yml` 或市场安装补丁)通过 `config:` 提供安全启动参数:

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| requiredDshVersion | 安全启动要求的最低 DSH 版本 | >=0.1.0-rc.5 |
| conflictingPlugins | 视为冲突的插件名列表(命中即停用本插件) | [] |

## 安全启动

启动时依次检测,任一失败即**取消插件运行**(前端设置页会显示原因):

1. **版本兼容**:找不到 `@deepseek-ai/dsh` 宿主包,或版本不满足 `requiredDshVersion`(默认 `>=0.1.0-rc.5`)。
2. **冲突插件**:loader 条目中出现 `conflictingPlugins` 中声明的插件名。
3. **重复挂载**:`dsh-task-notice` 被挂载了多次(如同时出现在 `cordis.patch.yml` 与 `dsh.profile.bundles`)。
4. **命名空间占用**:其他插件已占用 `taskNotice` Typert 服务命名空间。

取消运行后插件只注册 `taskNotice.getHealth` 查询,不做任何计费/折叠/通知工作;DSH 正常启动。

## 数据存储

- 账本:`$DSH_HOME/storages/task-notice/usage.json`(追加式,原子写,按保留天数裁剪)。
- 配置覆盖:`$DSH_HOME/storages/task-notice/config.json`(由设置页写入)。

## 开发

```
lib/
  index.js        宿主插件入口(name / apply + 安全启动门,零顶层外部 import)
  safe-start.js   版本与冲突检测(findDshHostInfo / checkSafeStart)
  semver.js       内置最小 semver 范围匹配(无外部依赖)
  store.js        消耗账本(usage.json,原子写、保留裁剪)
  accounting.js   llm/stream 瀑布捕获(usage 块 → 记账)
  fold.js         会话日志折叠(turn/end、goal/change → 通知帧)
  notify.js       通知枢纽(推送队列 + 流订阅)
  keys.js         provider → 凭证引用(API Key)解析
  service.js      taskNotice RPC 服务(getHealth/getConfig/updateConfig/getUsageStats/subscribeNotifications)
  typert.host.js  手动注册的 Typert 清单工厂(zod v4 编解码,守卫式动态 import)
  client.js       浏览器端(完工弹窗 + 消耗统计/配置设置页)
cordis.patch.yml  本包的 profile 层补丁(挂载一行)
```

依赖纪律(安全启动的根基):宿主入口**零顶层外部 import**(只 import Node 内建模块与自身模块);运行期可用的服务(session/settings/credentials/typert/loader/llm)一律经 `ctx` 访问;唯一的外部包 `zod`(Typert 编解码强制要求)在 apply() 内用 try/catch 包裹的动态 import 加载。这样即使依赖解析失败(如 Windows `link:` 安装的 junction realpath 陷阱),也只让本插件停用,DSH 照常启动——从结构上杜绝了社区插件「不存在的命名导出在模块求值期抛 SyntaxError 导致整个 dsh 无法启动」的灾难。

## License

MIT