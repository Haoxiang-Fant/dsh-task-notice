/**
 * dsh-task-notice 浏览器端 bundle(单文件,经 __ModuleLoader__ 加载)。
 *
 * 提供两块界面:
 *  - 完工通知弹窗:常驻 sidebar.footer.action 插槽内的 fixed 浮层队列,消费
 *    remote.taskNotice.subscribeNotifications 流,展示任务完成与本次消耗的
 *    tokens(缓存输入 / 缓外输入 / 输出),自动消失时长可配。
 *  - 设置页 settings.section「任务通知与消耗」:按 1年/6个月/3个月/1个月/
 *    15天/1周/24小时/自定义 时间范围,按 API Key 汇总 Token 消耗
 *    (缓存输入 / 缓外输入 / 输出 + 调用次数),并展示安全启动状态。
 *
 * 数据通道:
 *  - remote.taskNotice.*(Typert RPC)→ 健康状态 / 配置 / 消耗统计 / 通知流。
 * 样式全部使用 --dsw-* / --dsh-* 主题变量,跟随全局亮暗主题。
 */

window.__ModuleLoader__.load({
  id: 'dsh-task-notice',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    // ── 样式 ────────────────────────────────────────────────────────────────

    const css = [
      '/* dsh-task-notice: 完工通知弹窗与消耗统计设置页 */',
      '.tn-popup-layer{position:fixed;top:16px;right:16px;z-index:2147483000;display:flex;flex-direction:column;gap:10px;width:340px;max-width:calc(100vw - 32px);pointer-events:none}',
      '.tn-popup{pointer-events:auto;position:relative;display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));background:var(--dsw-alias-bg-layer-2,var(--dsh-alias-bg-layer-2,#1f1f1f));box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:12px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));animation:tn-popup-in .22s cubic-bezier(.2,.8,.2,1)}',
      '.tn-popup.goal{border-left:3px solid var(--dsw-alias-state-business-primary,#4f8cff)}',
      '.tn-popup.turn{border-left:3px solid var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-popup-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.tn-popup-title{font-size:13px;font-weight:600;margin:0}',
      '.tn-popup-close{flex:none;border:none;background:none;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:6px}',
      '.tn-popup-close:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsh-alias-interactive-bg-hover,rgba(127,127,127,.18)))}',
      '.tn-popup-summary{color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));line-height:1.5;word-break:break-all}',
      '.tn-popup-tokens{display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb))}',
      '.tn-popup-token{display:inline-flex;align-items:center;gap:3px}',
      '.tn-popup-token b{color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));font-variant-numeric:tabular-nums}',
      '.tn-popup-key{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));word-break:break-all}',
      '.tn-popup-count{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))}',
      '@keyframes tn-popup-in{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}',
      // 设置页
      '.tn-section{display:flex;flex-direction:column;gap:16px;padding:4px 2px 24px;font-size:13px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-health{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:10px;border:1px solid var(--dsw-alias-state-error-primary,#e05b5b);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e05b5b) 10%,transparent)}',
      '.tn-health-title{font-size:13px;font-weight:600;color:var(--dsw-alias-state-error-primary,#e05b5b)}',
      '.tn-health-reason{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb))}',
      '.tn-health-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))}',
      '.tn-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}',
      '.tn-card{border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:12px;padding:12px 14px;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))}',
      '.tn-card-label{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));margin:0 0 6px}',
      '.tn-card-value{font-size:18px;line-height:24px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.tn-card-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));margin-top:2px}',
      '.tn-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.tn-chip{font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));background:transparent;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:999px;padding:4px 12px;cursor:pointer;white-space:nowrap}',
      '.tn-chip:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsh-alias-interactive-bg-hover,rgba(127,127,127,.14)))}',
      '.tn-chip.active{background:var(--dsw-alias-state-business-primary,#4f8cff);border-color:transparent;color:var(--dsw-alias-label-primary-inverted,var(--dsh-alias-label-primary-inverted,#fff));font-weight:600}',
      '.tn-custom{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-input{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));background:var(--dsw-alias-bg-base,var(--dsh-alias-bg-base,#141414));border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:8px;padding:4px 8px;outline:none}',
      '.tn-btn{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));background:var(--dsw-alias-button-elevated-fill,var(--dsh-alias-button-elevated-fill,#2a2a2a));border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:8px;padding:4px 12px;cursor:pointer}',
      '.tn-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsh-alias-interactive-bg-hover,rgba(127,127,127,.14)))}',
      '.tn-table-wrap{overflow:auto;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:10px}',
      '.tn-table{width:100%;border-collapse:collapse;font-size:12px}',
      '.tn-table th,.tn-table td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));white-space:nowrap}',
      '.tn-table th{color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));font-weight:500}',
      '.tn-table tr:last-child td{border-bottom:none}',
      '.tn-table td.num,.tn-table th.num{text-align:right;font-variant-numeric:tabular-nums}',
      '.tn-table .tn-row-total td{font-weight:600;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))}',
      '.tn-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));padding:14px 2px}',
      '.tn-note{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.6}',
      '.tn-subhead{margin:2px 0 6px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-retry{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));background:var(--dsw-alias-button-elevated-fill,var(--dsh-alias-button-elevated-fill,#2a2a2a));border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:8px;padding:3px 10px;margin-top:6px;cursor:pointer}',
      '.tn-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))}',
      '.tn-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#e05b5b)}',
      '.tn-check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));cursor:pointer}',
      '.tn-range-row{display:flex;align-items:center;gap:10px}',
      '.tn-range{flex:1;min-width:0;accent-color:var(--dsw-alias-state-business-primary,#4f8cff)}',
      '.tn-range-value{flex:none;min-width:44px;font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));text-align:right;font-variant-numeric:tabular-nums}',
      '.tn-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb))}',
      '.tn-model-row{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))}',
    ].join('\n')

    const CSS_ID = 'dsh-task-notice/client.css'
    // CSS_ID contains only [a-z0-9./-] — embed it directly. JSON.stringify would wrap it in
    // literal quotes and produce an invalid selector like style[data-plugin-css=""…""], which
    // makes querySelector throw and fails the whole client module.
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-task-notice'
      style.dataset.pluginCss = CSS_ID
      style.textContent = css
      document.head.appendChild(style)
    }

    // ── 多语言 ────────────────────────────────────────────────────────────────

    const MESSAGES = {
      zh: {
        sectionLabel: '任务通知与消耗',
        popupTitle: '任务完成',
        goalTitle: '目标完成',
        turnSummary: '第 {turn} 轮任务已完成,本次消耗 {total} tokens',
        goalSummary: '目标「{objective}」已完成,共消耗 {total} tokens',
        cacheIn: '缓存输入',
        cacheOut: '缓外输入',
        output: '输出',
        cacheWrite: '缓存写入',
        reasoning: '推理',
        total: '合计',
        calls: '调用次数',
        key: 'Key',
        provider: '提供商',
        model: '模型',
        range24h: '24小时',
        range7d: '1周',
        range15d: '15天',
        range1m: '1个月',
        range3m: '3个月',
        range6m: '6个月',
        range1y: '1年',
        rangeCustom: '自定义',
        customFrom: '开始',
        customTo: '结束',
        query: '查询',
        loading: '加载中…',
        empty: '该时间范围内暂无消耗记录。',
        error: '查询失败:{error}',
        statCalls: '调用次数',
        statTokens: '总消耗',
        disabledTitle: '插件已停用',
        disabledReasons: '安全启动检测到以下问题,插件已取消运行(DSH 正常工作):',
        healthOk: '安全启动检查通过,插件运行正常。',
        versionInfo: 'DSH {dsh} · 插件 {plugin} · Node {node}',
        modelsTitle: '按模型明细',
        note: '「缓存输入」= 命中缓存输入(cacheRead);「缓外输入」= 未命中缓存输入;「输出」= 生成输出。消耗按每次模型调用实际 usage 记账,并按请求使用的 API Key 归集。',
        notifyTurn: '每轮任务弹窗',
        notifyTurnDesc: '每完成一轮任务即弹窗提示',
        notifyGoal: '目标完成弹窗',
        notifyGoalDesc: '目标(goal)完成时弹窗提示',
        popupSeconds: '弹窗时长(秒)',
        storeDays: '账本保留天数',
        pluginEnabled: '插件总开关',
        pluginEnabledDesc: '关闭后停止通知与记账',
        close: '关闭',
        configHint: '通知开关、弹窗时长、保留天数等可在 设置 → 插件 → 插件配置 中调整。',
        goal: '目标',
        turn: '任务',
        webNotify: '系统通知(Web Notifications)',
        webNotifyDesc: '任务/目标完成时,经浏览器 Web Notifications API 发送系统通知:桌面右下角横幅 + Windows 操作中心;点击通知回到本页面。',
        webNotifyHint: '授权后,即使页面最小化或切到后台,也能在桌面收到横幅;关闭本开关则只保留页内弹窗。',
        permGranted: '已授权',
        permDefault: '尚未授权 — 点击「授权并开启」,浏览器将询问是否允许通知。',
        permDenied: '浏览器已拒绝通知权限,请在地址栏站点权限中允许后重试。',
        permUnsupported: '当前环境不支持 Web Notifications(需要 HTTPS 或 localhost 安全上下文)。',
        grantAction: '授权并开启',
        backgroundOnly: '仅页面后台时发送',
        backgroundOnlyDesc: '勾选:正在查看本页时只显示页内弹窗,切到其他窗口或标签页后台时才发系统通知;取消勾选:每次完成都发系统通知(前台时会与页内弹窗同时出现)。',
        modelUsageTitle: '按模型消耗',
        modelColumn: '模型',
        retry: '重试',
        connError: '无法连接插件服务:{error}',
      },
      en: {
        sectionLabel: 'Task & Usage',
        popupTitle: 'Task complete',
        goalTitle: 'Goal complete',
        turnSummary: 'Turn {turn} completed · {total} tokens used',
        goalSummary: 'Goal "{objective}" completed · {total} tokens used',
        cacheIn: 'Cached input',
        cacheOut: 'Uncached input',
        output: 'Output',
        cacheWrite: 'Cache write',
        reasoning: 'Reasoning',
        total: 'Total',
        calls: 'Calls',
        key: 'Key',
        provider: 'Provider',
        model: 'Model',
        range24h: '24h',
        range7d: '7 days',
        range15d: '15 days',
        range1m: '1 month',
        range3m: '3 months',
        range6m: '6 months',
        range1y: '1 year',
        rangeCustom: 'Custom',
        customFrom: 'From',
        customTo: 'To',
        query: 'Query',
        loading: 'Loading…',
        empty: 'No usage records in this range.',
        error: 'Query failed: {error}',
        statCalls: 'Calls',
        statTokens: 'Total tokens',
        disabledTitle: 'Plugin disabled',
        disabledReasons: 'Safe-start detected the following issues and cancelled the plugin (DSH keeps running):',
        healthOk: 'Safe-start passed, plugin running normally.',
        versionInfo: 'DSH {dsh} · plugin {plugin} · Node {node}',
        modelsTitle: 'Per-model breakdown',
        note: '"Cached input" = cache-hit input (cacheRead); "Uncached input" = cache-miss input; "Output" = generated output. Usage is captured per model call and attributed to the API key used by the request.',
        notifyTurn: 'Turn notifications',
        notifyTurnDesc: 'Popup on every completed turn',
        notifyGoal: 'Goal notifications',
        notifyGoalDesc: 'Popup when a goal completes',
        popupSeconds: 'Popup duration (s)',
        storeDays: 'Retention days',
        pluginEnabled: 'Plugin enabled',
        pluginEnabledDesc: 'Disable stops notifications and accounting',
        close: 'Close',
        configHint: 'Notification toggles, popup duration and retention days are configurable under Settings → Plugins → Plugin configuration.',
        goal: 'Goal',
        turn: 'Turn',
        webNotify: 'System notification (Web Notifications)',
        webNotifyDesc: 'When a turn or goal completes, send a system notification through the Web Notifications API: a desktop banner bottom-right plus the Windows Action Center; clicking it returns to this page.',
        webNotifyHint: 'Once granted, banners appear on the desktop even when the page is minimized or backgrounded. Turn this off to keep only in-page popups.',
        permGranted: 'Granted',
        permDefault: 'Not granted yet — click “Grant & enable” and the browser will ask for permission.',
        permDenied: 'Notification permission was blocked. Allow it for this site in the address bar, then retry.',
        permUnsupported: 'Web Notifications is unavailable here (requires a secure context such as HTTPS or localhost).',
        grantAction: 'Grant & enable',
        backgroundOnly: 'Only while the page is in the background',
        backgroundOnlyDesc: 'On: in-page popups are shown while you view this page; system notifications fire only after you switch away or minimize. Off: every completion also fires a system notification (alongside the in-page popup when foregrounded).',
        modelUsageTitle: 'Usage by model',
        modelColumn: 'Model',
        retry: 'Retry',
        connError: 'Cannot reach the plugin service: {error}',
      },
    }

    function detectLang() {
      try {
        const lang = (navigator.language || 'en').toLowerCase()
        return lang.startsWith('zh') ? 'zh' : 'en'
      } catch {
        return 'en'
      }
    }
    const LANG = detectLang()
    const t = (key, vars) => {
      let text = (MESSAGES[LANG] && MESSAGES[LANG][key]) ?? MESSAGES.en[key] ?? key
      if (vars) {
        for (const k of Object.keys(vars)) {
          text = text.split('{' + k + '}').join(String(vars[k]))
        }
      }
      return text
    }

    function fmt(n) {
      return typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? 0)
    }

    // ── 系统通知(Web Notifications API)───────────────────────────────────
    // 替代旧版「宿主 PowerShell WinRT toast」通道:改由页面直接经 Web
    // Notifications API 发送。浏览器(Edge/Chrome)会把通知交给 Windows
    // Notification Platform,显示为桌面右下角横幅并存入操作中心;点击通知
    // 回到本页面(浏览器自动聚焦标签页,这里再补一次 window.focus())。
    // 权限必须由用户手势触发(设置页的「授权并开启」按钮)。
    const NATIVE_NOTIFY = (() => {
      try { return typeof window !== 'undefined' && 'Notification' in window && typeof window.Notification === 'function' } catch { return false }
    })()

    function notifyState() {
      if (!NATIVE_NOTIFY) return 'unsupported'
      try { return String(window.Notification.permission) } catch { return 'unsupported' }
    }

    function notifyGranted() {
      return notifyState() === 'granted'
    }

    /** 只能在用户手势(按钮点击)里调用;旧式回调 API 包一层 Promise 防抛错。 */
    async function requestNotifyPermission() {
      if (!NATIVE_NOTIFY) return 'unsupported'
      try {
        const permission = await Promise.resolve(window.Notification.requestPermission())
        return String(permission)
      } catch { return 'denied' }
    }

    function nativeNotifyBody(frame) {
      const b = frame.tokens || {}
      const parts = []
      parts.push(t('cacheIn') + ' ' + fmt(b.cacheIn))
      parts.push(t('cacheOut') + ' ' + fmt(b.cacheOut))
      parts.push(t('output') + ' ' + fmt(b.output))
      if (b.cacheWrite > 0) parts.push(t('cacheWrite') + ' ' + fmt(b.cacheWrite))
      if (b.reasoning > 0) parts.push(t('reasoning') + ' ' + fmt(b.reasoning))
      return (frame.summary || '') + '\n' + parts.join(' · ') + '\n' + t('total') + ' ' + fmt(frame.total)
    }

    /** 通知帧到达时按配置发送系统通知;任何失败静默,绝不影响主流程。 */
    function showNativeNotify(frame, cfg) {
      if (!NATIVE_NOTIFY) return
      if (!frame || (frame.type !== 'turn' && frame.type !== 'goal')) return
      if (!cfg) return
      if (cfg.webNotify === false) return
      if (frame.type === 'turn' && cfg.notifyOnTurn === false) return
      if (frame.type === 'goal' && cfg.notifyOnGoal === false) return
      if (!notifyGranted()) return
      // webNotifyBackgroundOnly:页面在前台时由页内弹窗负责,避免双份打扰
      if (cfg.webNotifyBackgroundOnly !== false) {
        let visible = true
        try { visible = document.visibilityState === 'visible' } catch { /* ignore */ }
        if (visible) return
      }
      // 跨标签页去重:hub 会向每个打开的标签页推送同一帧,避免操作中心重复
      try {
        const key = 'dsh-task-notice:notified:' + String(frame.id ?? '')
        const last = Number(window.localStorage.getItem(key) || 0)
        const now = Date.now()
        if (now - last < 30000) return
        window.localStorage.setItem(key, String(now))
      } catch { /* localStorage 不可用时跳过跨页去重 */ }
      const title = frame.type === 'goal' ? t('goalTitle') : t('popupTitle')
      const body = nativeNotifyBody(frame)
      try {
        const notification = new window.Notification(title, {
          body,
          tag: 'dsh-task-notice-' + String(frame.id ?? Date.now()),
          silent: false,
        })
        // 点击系统通知 → 聚焦本标签页
        notification.onclick = () => {
          try { window.focus() } catch { /* ignore */ }
          try { notification.close() } catch { /* ignore */ }
        }
      } catch { /* 权限被收回或系统拒绝时静默 */ }
    }

    // ── RPC 贡献(与服务端 ./typert 清单一一对应) ───────────────────────────

    function codecOf(parse, typeSymbol) {
      return { mode: 'strict', typeSymbol, schema: { parse } }
    }
    const objCodec = (symbol) => codecOf((v) => {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error(symbol + ': expected object')
      return v
    }, symbol)
    const numCodec = codecOf((v) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('expected number')
      return v
    }, 'dsh-task-notice#Number')

    const CONTRIBUTION = {
      package: 'dsh-task-notice',
      descriptors: [
        {
          id: 'dsh-task-notice#taskNotice/getHealth', service: 'taskNotice', namespace: 'taskNotice', method: 'getHealth',
          invocation: { kind: 'direct' }, parameters: [],
          result: objCodec('dsh-task-notice#HealthState'),
        },
        {
          id: 'dsh-task-notice#taskNotice/getConfig', service: 'taskNotice', namespace: 'taskNotice', method: 'getConfig',
          invocation: { kind: 'direct' }, parameters: [],
          result: objCodec('dsh-task-notice#ConfigState'),
        },
        {
          id: 'dsh-task-notice#taskNotice/updateConfig', service: 'taskNotice', namespace: 'taskNotice', method: 'updateConfig',
          invocation: { kind: 'direct' },
          parameters: [{ name: 'patch', wire: 'patch', source: 'json', codec: objCodec('dsh-task-notice#ConfigPatch') }],
          result: objCodec('dsh-task-notice#ConfigState'),
        },
        {
          id: 'dsh-task-notice#taskNotice/getUsageStats', service: 'taskNotice', namespace: 'taskNotice', method: 'getUsageStats',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageStats'),
        },
        {
          id: 'dsh-task-notice#taskNotice/subscribeNotifications', service: 'taskNotice', namespace: 'taskNotice', method: 'subscribeNotifications',
          invocation: { kind: 'direct' }, mode: 'stream', parameters: [], cancellation: { parameter: 'signal' },
          result: objCodec('dsh-task-notice#NotificationFrame'),
        },
      ],
    }

    // ── 微型 observable store ────────────────────────────────────────────────

    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set: (next) => {
          state = next
          for (const listener of [...listeners]) {
            try { listener() } catch { /* ignore */ }
          }
        },
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
    }

    function useStore(store) {
      const [snap, setSnap] = React.useState(store.get())
      React.useEffect(() => store.subscribe(() => setSnap(store.get())), [store])
      return snap
    }

    // ── 完工通知弹窗 ────────────────────────────────────────────────────────

    function useVisibility() {
      const [visible, setVisible] = React.useState(() => {
        try { return document.visibilityState === 'visible' } catch { return true }
      })
      React.useEffect(() => {
        const onChange = () => {
          try { setVisible(document.visibilityState === 'visible') } catch { setVisible(true) }
        }
        document.addEventListener('visibilitychange', onChange)
        return () => document.removeEventListener('visibilitychange', onChange)
      }, [])
      return visible
    }

    function PopupItem({ frame, seconds, onClose }) {
      const visible = useVisibility()
      const [left, setLeft] = React.useState(Math.max(3, seconds))
      React.useEffect(() => {
        if (!visible) return
        if (left <= 0) {
          onClose(frame.id)
          return
        }
        const timer = setTimeout(() => setLeft((v) => v - 1), 1000)
        return () => clearTimeout(timer)
      }, [visible, left])
      const tokens = frame.tokens || {}
      const el = React.createElement
      return el('div', { className: 'tn-popup ' + (frame.type === 'goal' ? 'goal' : 'turn') },
        el('div', { className: 'tn-popup-head' },
          el('div', { className: 'tn-popup-title' }, frame.type === 'goal' ? t('goalTitle') : t('popupTitle')),
          el('div', { className: 'tn-popup-count' }, fmt(left) + 's'),
          el('button', { className: 'tn-popup-close', onClick: () => onClose(frame.id), 'aria-label': t('close') }, '×')),
        el('div', { className: 'tn-popup-summary' }, frame.summary || ''),
        el('div', { className: 'tn-popup-tokens' },
          el('span', { className: 'tn-popup-token' }, t('cacheIn'), el('b', null, fmt(tokens.cacheIn))),
          el('span', { className: 'tn-popup-token' }, t('cacheOut'), el('b', null, fmt(tokens.cacheOut))),
          el('span', { className: 'tn-popup-token' }, t('output'), el('b', null, fmt(tokens.output))),
          el('span', { className: 'tn-popup-token' }, t('total'), el('b', null, fmt(frame.total)))),
        frame.key ? el('div', { className: 'tn-popup-key' }, t('key') + ': ' + frame.key) : null)
    }

    function PopupHost(props) {
      const store = props.hooks.taskNotice
      const snap = useStore(store)
      const notifications = snap.notifications || []
      const seconds = (snap.config && typeof snap.config.popupSeconds === 'number') ? snap.config.popupSeconds : 15
      const dismiss = (id) => {
        const cur = store.get()
        store.set({ ...cur, notifications: (cur.notifications || []).filter((n) => n.id !== id) })
      }
      if (notifications.length === 0) return null
      return React.createElement('div', { className: 'tn-popup-layer' },
        notifications.map((frame) => React.createElement(PopupItem, { key: frame.id, frame, seconds, onClose: dismiss })))
    }

    // ── 消耗统计设置页 ─────────────────────────────────────────────────────

    const RANGES = [
      { id: '24h', key: 'range24h', ms: 24 * 60 * 60 * 1000 },
      { id: '7d', key: 'range7d', ms: 7 * 24 * 60 * 60 * 1000 },
      { id: '15d', key: 'range15d', ms: 15 * 24 * 60 * 60 * 1000 },
      { id: '1m', key: 'range1m', ms: 30 * 24 * 60 * 60 * 1000 },
      { id: '3m', key: 'range3m', ms: 90 * 24 * 60 * 60 * 1000 },
      { id: '6m', key: 'range6m', ms: 180 * 24 * 60 * 60 * 1000 },
      { id: '1y', key: 'range1y', ms: 365 * 24 * 60 * 60 * 1000 },
      { id: 'custom', key: 'rangeCustom', ms: 0 },
    ]

    function localInputValue(date) {
      const pad = (n) => String(n).padStart(2, '0')
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes())
    }

    function StatsSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [rangeId, setRangeId] = React.useState('1m')
      const now = new Date()
      const [customFrom, setCustomFrom] = React.useState(localInputValue(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
      const [customTo, setCustomTo] = React.useState(localInputValue(now))
      const [data, setData] = React.useState({ status: 'idle', stats: null, error: null })
      const [perm, setPerm] = React.useState(notifyState)

      // 授权并开启浏览器系统通知(必须由点击按钮这一用户手势触发)
      const onGrantNotify = React.useCallback(async () => {
        const state = await requestNotifyPermission()
        setPerm(state)
        if (state === 'granted') {
          try { await api.updateConfig({ webNotify: true }) } catch { /* 失败保持现状 */ }
        }
      }, [api])

      const computeRange = (id) => {
        const end = Date.now()
        if (id === 'custom') {
          const from = new Date(customFrom).getTime()
          const to = new Date(customTo).getTime()
          return { fromMs: Number.isFinite(from) ? from : end - 30 * 24 * 60 * 60 * 1000, toMs: Number.isFinite(to) ? Math.max(to, from) : end }
        }
        const range = RANGES.find((r) => r.id === id)
        return { fromMs: end - (range ? range.ms : 30 * 24 * 60 * 60 * 1000), toMs: end }
      }

      const load = React.useCallback(async (id) => {
        const { fromMs, toMs } = computeRange(id)
        setData({ status: 'loading', stats: null, error: null })
        try {
          const result = await api.getUsageStats(fromMs, toMs)
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed')
          }
          setData({ status: 'ready', stats: result.value, error: null })
        } catch (error) {
          setData({ status: 'error', stats: null, error: String(error && error.message ? error.message : error) })
        }
      }, [customFrom, customTo])

      React.useEffect(() => {
        void load(rangeId)
      }, [rangeId, load])

      const health = snap.health
      const stats = data.stats
      const rows = (stats && Array.isArray(stats.keys)) ? stats.keys : []
      // 跨 Key 的按模型总览:把每个 Key 行内的 models 明细聚合为「模型 → 消耗」
      const modelMap = new Map()
      for (const row of rows) {
        const models = Array.isArray(row.models) ? row.models : []
        for (const m of models) {
          const label = (m.provider && m.provider !== '' ? m.provider : '?') + ' · ' + m.model
          let agg = modelMap.get(label)
          if (agg === undefined) {
            agg = { label, provider: m.provider || '', model: m.model, calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 }
            modelMap.set(label, agg)
          }
          agg.calls += m.calls
          agg.cacheIn += m.cacheIn
          agg.cacheOut += m.cacheOut
          agg.output += m.output
          agg.cacheWrite += m.cacheWrite
          agg.reasoning += m.reasoning
        }
      }
      const modelRows = [...modelMap.values()].sort((a, b) =>
        (b.cacheIn + b.cacheOut + b.output + b.cacheWrite + b.reasoning) - (a.cacheIn + a.cacheOut + a.output + a.cacheWrite + a.reasoning))

      return el('div', { className: 'tn-section' },
        // 安全启动状态
        (health && health.enabled === false)
          ? el('div', { className: 'tn-health' },
            el('div', { className: 'tn-health-title' }, t('disabledTitle')),
            el('div', { className: 'tn-health-reason' }, t('disabledReasons')),
            (Array.isArray(health.reasons) ? health.reasons : []).map((r, i) =>
              el('div', { className: 'tn-health-reason', key: i }, '· ' + (r.message || r.code))),
            el('div', { className: 'tn-health-meta' }, t('versionInfo', { dsh: health.dshVersion, plugin: health.pluginVersion, node: health.nodeVersion })))
          : null,
        (health && health.enabled !== false)
          ? el('div', { className: 'tn-hint' }, t('healthOk'))
          : null,
        snap.status === 'error' && snap.error
          ? el('div', { className: 'tn-health' },
            el('div', { className: 'tn-health-title' }, t('connError', { error: String(snap.error) })),
            el('button', { className: 'tn-retry', onClick: () => { void api.reload() } }, t('retry')))
          : null,

        // 汇总卡片
        el('div', { className: 'tn-cards' },
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('statTokens')),
            el('div', { className: 'tn-card-value' }, stats ? fmt(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('statCalls')),
            el('div', { className: 'tn-card-value' }, stats ? fmt(stats.calls) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('cacheIn')),
            el('div', { className: 'tn-card-value' }, stats ? fmt(stats.totals.cacheIn) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('cacheOut')),
            el('div', { className: 'tn-card-value' }, stats ? fmt(stats.totals.cacheOut) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('output')),
            el('div', { className: 'tn-card-value' }, stats ? fmt(stats.totals.output) : '—'))),

        // 时间范围
        el('div', { className: 'tn-toolbar' },
          RANGES.map((range) =>
            el('button', {
              className: 'tn-chip' + (rangeId === range.id ? ' active' : ''),
              key: range.id,
              onClick: () => setRangeId(range.id),
            }, t(range.key))),
          el('button', { className: 'tn-btn', onClick: () => void load(rangeId) }, t('query'))),
        rangeId === 'custom'
          ? el('div', { className: 'tn-custom' },
            el('label', { className: 'tn-hint' }, t('customFrom')),
            el('input', { className: 'tn-input', type: 'datetime-local', value: customFrom, onChange: (e) => setCustomFrom(e.target.value) }),
            el('label', { className: 'tn-hint' }, t('customTo')),
            el('input', { className: 'tn-input', type: 'datetime-local', value: customTo, onChange: (e) => setCustomTo(e.target.value) }))
          : null,

        // 结果
        data.status === 'loading' ? el('div', { className: 'tn-empty' }, t('loading')) : null,
        data.status === 'error' ? el('div', { className: 'tn-err' }, t('error', { error: data.error })) : null,
        data.status === 'ready' && rows.length === 0 ? el('div', { className: 'tn-empty' }, t('empty')) : null,
        data.status === 'ready' && rows.length > 0
          ? el('div', { className: 'tn-table-wrap' },
            el('table', { className: 'tn-table' },
              el('thead', null,
                el('tr', null,
                  el('th', null, t('key')),
                  el('th', null, t('provider')),
                  el('th', { className: 'num' }, t('calls')),
                  el('th', { className: 'num' }, t('cacheIn')),
                  el('th', { className: 'num' }, t('cacheOut')),
                  el('th', { className: 'num' }, t('output')),
                  el('th', { className: 'num' }, t('total')))),
              el('tbody', null,
                rows.map((row) => {
                  const total = row.cacheIn + row.cacheOut + row.output + row.cacheWrite + row.reasoning
                  return el('tr', { key: row.key },
                    el('td', null,
                      row.key,
                      el('details', null,
                        el('summary', null, t('modelsTitle')),
                        (Array.isArray(row.models) ? row.models : []).map((m) =>
                          el('div', { className: 'tn-model-row', key: m.model }, m.model + ': ' + fmt(m.calls) + ' ' + t('calls') + ' · ' + t('cacheIn') + ' ' + fmt(m.cacheIn) + ' · ' + t('cacheOut') + ' ' + fmt(m.cacheOut) + ' · ' + t('output') + ' ' + fmt(m.output))))),
                    el('td', null, row.provider || '—'),
                    el('td', { className: 'num' }, fmt(row.calls)),
                    el('td', { className: 'num' }, fmt(row.cacheIn)),
                    el('td', { className: 'num' }, fmt(row.cacheOut)),
                    el('td', { className: 'num' }, fmt(row.output)),
                    el('td', { className: 'num' }, fmt(total)))
                }),
                el('tr', { className: 'tn-row-total' },
                  el('td', null, t('total')),
                  el('td', null, ''),
                  el('td', { className: 'num' }, fmt(stats.calls)),
                  el('td', { className: 'num' }, fmt(stats.totals.cacheIn)),
                  el('td', { className: 'num' }, fmt(stats.totals.cacheOut)),
                  el('td', { className: 'num' }, fmt(stats.totals.output)),
                  el('td', { className: 'num' }, fmt(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning))))))
          : null,
        // 按模型消耗总览(跨 Key 聚合)
        data.status === 'ready' && modelRows.length > 0
          ? el('div', { className: 'tn-table-wrap', style: { marginTop: '6px' } },
            el('div', { className: 'tn-subhead' }, t('modelUsageTitle')),
            el('table', { className: 'tn-table' },
              el('thead', null,
                el('tr', null,
                  el('th', null, t('modelColumn')),
                  el('th', { className: 'num' }, t('calls')),
                  el('th', { className: 'num' }, t('cacheIn')),
                  el('th', { className: 'num' }, t('cacheOut')),
                  el('th', { className: 'num' }, t('output')),
                  el('th', { className: 'num' }, t('total')))),
              el('tbody', null,
                modelRows.map((m) => el('tr', { key: m.label },
                  el('td', null, m.label),
                  el('td', { className: 'num' }, fmt(m.calls)),
                  el('td', { className: 'num' }, fmt(m.cacheIn)),
                  el('td', { className: 'num' }, fmt(m.cacheOut)),
                  el('td', { className: 'num' }, fmt(m.output)),
                  el('td', { className: 'num' }, fmt(m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning)))),
                el('tr', { className: 'tn-row-total' },
                  el('td', null, t('total')),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.calls, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.cacheIn, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.cacheOut, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.output, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning, 0)))))))
          : null,
        // 通知与统计配置(经 updateConfig 持久化)
        el('div', { className: 'tn-cards' },
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('notifyTurn')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: snap.config ? snap.config.notifyOnTurn : true, onChange: (e) => { void api.updateConfig({ notifyOnTurn: e.target.checked }).catch((err) => setData({ status: 'error', stats: data.stats, error: String(err && err.message ? err.message : err) })) } }),
              t('notifyTurnDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('notifyGoal')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: snap.config ? snap.config.notifyOnGoal : true, onChange: (e) => { void api.updateConfig({ notifyOnGoal: e.target.checked }).catch((err) => setData({ status: 'error', stats: data.stats, error: String(err && err.message ? err.message : err) })) } }),
              t('notifyGoalDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('popupSeconds')),
            el('div', { className: 'tn-range-row' },
              el('input', { className: 'tn-range', type: 'range', min: 3, max: 120, step: 1, value: snap.config ? snap.config.popupSeconds : 15, onChange: (e) => { void api.updateConfig({ popupSeconds: Number(e.target.value) }).catch(() => {}) } }),
              el('span', { className: 'tn-range-value' }, fmt(snap.config ? snap.config.popupSeconds : 15) + 's'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('storeDays')),
            el('div', { className: 'tn-range-row' },
              el('input', { className: 'tn-range', type: 'range', min: 1, max: 3650, step: 1, value: snap.config ? snap.config.storeDays : 365, onChange: (e) => { void api.updateConfig({ storeDays: Number(e.target.value) }).catch(() => {}) } }),
              el('span', { className: 'tn-range-value' }, fmt(snap.config ? snap.config.storeDays : 365) + 'd'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('pluginEnabled')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: snap.config ? snap.config.enabled : true, onChange: (e) => { void api.updateConfig({ enabled: e.target.checked }).catch((err) => setData({ status: 'error', stats: data.stats, error: String(err && err.message ? err.message : err) })) } }),
              t('pluginEnabledDesc')))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('webNotify')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: snap.config ? snap.config.webNotify !== false : true, disabled: perm === 'unsupported' || perm === 'denied', onChange: (e) => { void api.updateConfig({ webNotify: e.target.checked }).catch((err) => setData({ status: 'error', stats: data.stats, error: String(err && err.message ? err.message : err) })) } }),
              t('webNotifyDesc')),
            perm === 'unsupported'
              ? el('p', { className: 'tn-err' }, t('permUnsupported'))
              : null,
            perm === 'denied'
              ? el('p', { className: 'tn-err' }, t('permDenied'))
              : null,
            perm === 'default'
              ? el('div', { className: 'tn-custom' },
                el('span', { className: 'tn-hint' }, t('permDefault')),
                el('button', { className: 'tn-btn', onClick: () => { void onGrantNotify() } }, t('grantAction')))
              : null,
            perm === 'granted'
              ? el('p', { className: 'tn-hint' }, t('permGranted') + ' · ' + t('webNotifyHint'))
              : null),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('backgroundOnly')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: snap.config ? snap.config.webNotifyBackgroundOnly !== false : true, disabled: perm === 'unsupported' || !(snap.config ? snap.config.webNotify !== false : true), onChange: (e) => { void api.updateConfig({ webNotifyBackgroundOnly: e.target.checked }).catch((err) => setData({ status: 'error', stats: data.stats, error: String(err && err.message ? err.message : err) })) } }),
              t('backgroundOnlyDesc'))),
        el('p', { className: 'tn-note' }, t('note')),
        el('p', { className: 'tn-note' }, t('configHint')))
    }

    // ── 错误边界:设置分节渲染异常时显示原因而不是整页空白 ─────────────────
    // 设置面板若在渲染期抛错且宿主无错误边界,分节会呈现为空白且无任何反馈;
    // 此边界把异常转成可见的错误卡(含重载),保证「页空白」永不再发生。
    const BOUNDARY_CSS = '.tn-boundary{border:1px solid var(--dsw-alias-state-error-primary,#e05b5b);border-radius:10px;padding:14px 16px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e05b5b) 10%,transparent)}' +
      '.tn-boundary-title{font-size:13px;font-weight:600;color:var(--dsw-alias-state-error-primary,#e05b5b);margin:0 0 8px}' +
      '.tn-boundary-msg{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));word-break:break-all;margin:0 0 10px}'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-task-notice/boundary.css"]') === null) {
      const st = document.createElement('style')
      st.dataset.pluginCss = 'dsh-task-notice/boundary.css'
      st.textContent = BOUNDARY_CSS
      document.head.appendChild(st)
    }

    class SectionBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error, info) {
        try {
          console.error('[dsh-task-notice] 设置分节渲染失败: ' + String(error && error.message ? error.message : error), info)
        } catch { /* ignore */ }
      }
      render() {
        if (this.state.error !== null) {
          return React.createElement('div', { className: 'tn-boundary' },
            React.createElement('p', { className: 'tn-boundary-title' }, t('disabledTitle')),
            React.createElement('p', { className: 'tn-boundary-msg' }, t('error', { error: String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error) })),
            React.createElement('button', { className: 'tn-retry', onClick: () => { this.setState({ error: null }) } }, t('retry')))
        }
        return this.props.children
      }
    }

    function boundaryWrap(Component) {
      return (props) => React.createElement(SectionBoundary, null, React.createElement(Component, props))
    }

    // ── 插件主体 ────────────────────────────────────────────────────────────

    const inject = ['remote']

    async function apply(ctx) {
      const remote = ctx.remote
      if (remote === undefined || typeof remote.$mount !== 'function') return
      let unmount
      try {
        unmount = await remote.$mount(CONTRIBUTION)
      } catch (error) {
        console.warn('[dsh-task-notice] 远程服务挂载失败,插件前端未启用: ' + String(error && error.message ? error.message : error))
        return
      }
      // 注意:cordis 的 ctx.effect(fn) 会立即执行 fn,只有 fn 返回的函数才会在
      // ctx 销毁时作为清理回调被调用。写成 () => { unmount() } 会在 apply 刚把
      // remote.taskNotice 挂载完成后立刻卸载它(namespace 方法随后被删除),
      // 之后设置页的 taskNotice.getUsageStats / taskNotice[method] 全部报
      // "is not a function"。必须返回清理函数,和 dsh-cost-meter 一致。
      ctx.effect(() => () => { unmount() }, 'dsh-task-notice: remote contribution')

      const taskNotice = ctx.get('remote.taskNotice')
      if (taskNotice === undefined) return

      const store = createStore({ status: 'loading', health: null, config: null, error: null, notifications: [] })

      const call = async (method, args) => {
        const result = await taskNotice[method](...(args || []))
        if (result === null || typeof result !== 'object' || result.ok !== true) {
          throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed: ' + method)
        }
        return result.value
      }

      let reloading = false
      const reload = async () => {
        if (reloading) return
        reloading = true
        const prev = store.get()
        try {
          const [health, config] = await Promise.all([call('getHealth'), call('getConfig')])
          store.set({ status: 'ready', health, config, error: null, notifications: prev.notifications || [] })
        } catch (error) {
          store.set({ status: 'error', health: prev.health, config: prev.config, error: String(error && error.message ? error.message : error), notifications: prev.notifications || [] })
        } finally {
          reloading = false
        }
      }
      void reload()
      ctx.effect(() => ctx.on('connection/reset', () => { void reload() }), 'dsh-task-notice: reconnect reload')

      // 通知流:任务完成帧推入 store,由弹窗浮层渲染。
      const controller = new AbortController()
      const pump = async () => {
        try {
          for await (const frame of taskNotice.subscribeNotifications(controller.signal)) {
            if (frame === null || typeof frame !== 'object') continue
            const cur = store.get()
            store.set({ ...cur, notifications: [...(cur.notifications || []), frame].slice(-20) })
            // 系统通知(Web Notifications):config 尚未就绪时按默认值处理
            showNativeNotify(frame, cur.config || { webNotify: true, webNotifyBackgroundOnly: true, notifyOnTurn: true, notifyOnGoal: true })
          }
        } catch (error) {
          console.warn('[dsh-task-notice] 通知流结束: ' + String(error && error.message ? error.message : error))
        }
      }
      void pump()
      ctx.effect(() => () => controller.abort(), 'dsh-task-notice: notify stream')

      const api = {
        reload,
        getUsageStats: (fromMs, toMs) => taskNotice.getUsageStats(fromMs, toMs),
        getHealth: () => taskNotice.getHealth(),
        getConfig: () => taskNotice.getConfig(),
        updateConfig: async (patch) => {
          const result = await taskNotice.updateConfig(patch)
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed: updateConfig')
          }
          const cur = store.get()
          store.set({ ...cur, config: result.value })
          return result.value
        },
      }
      // 组件数据不再依赖框架的 inject-face 注入(props.hooks 可能缺失),
      // 直接在 apply 作用域内把 store/api 合并进组件 props,契约自持。
      const withRuntime = (Component) => (props) => {
        try {
          return React.createElement(Component, Object.assign({}, props || {}, { hooks: { taskNotice: store }, api }))
        } catch (error) {
          console.error('[dsh-task-notice] 组件渲染失败: ' + String(error && error.message ? error.message : error))
          return React.createElement('div', { className: 'tn-boundary' },
            React.createElement('p', { className: 'tn-boundary-title' }, 'dsh-task-notice'),
            React.createElement('p', { className: 'tn-boundary-msg' }, t('error', { error: String(error && error.message ? error.message : error) })))
        }
      }

      const slots = ctx.get('slots')
      if (slots === undefined) return

      // 常驻弹窗浮层(sidebar.footer.action 在所有页面均渲染,弹窗本身是 fixed 定位)
      try {
        slots.inject('sidebar.footer.action', () => {
          const dispose = slots.register(
            { name: 'sidebar.footer.action', id: 'task-notice-popup', order: 1000 },
            withRuntime(PopupHost),
          )
          return dispose
        })
      } catch (error) {
        console.warn('[dsh-task-notice] 弹窗插槽注册失败: ' + String(error && error.message ? error.message : error))
      }

      // 设置页分节
      try {
        slots.inject('settings.section', () => {
          const dispose = slots.register(
            { name: 'settings.section', id: 'task-notice', order: 40, label: t('sectionLabel') },
            withRuntime(boundaryWrap(StatsSection)),
          )
          return dispose
        })
      } catch (error) {
        console.warn('[dsh-task-notice] 设置分节注册失败: ' + String(error && error.message ? error.message : error))
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
