/**
 * dsh-task-notice 浏览器端 bundle(单文件,经 __ModuleLoader__ 加载)。
 *
 * 提供四块界面:
 *  - 完工通知弹窗:常驻 sidebar.footer.action 插槽内的 fixed 浮层队列,消费
 *    remote.taskNotice.subscribeNotifications 流,展示任务完成与本次消耗的
 *    tokens(缓存输入 / 缓外输入 / 输出)与金额,自动消失时长可配。
 *  - 顶部提示横幅(0.3.6):常驻 shell.overlay 帧级浮层,页面顶部居中——
 *    系统通知权限未授权时提示一键授权(点击横幅即请求);「当前使用的模型」
 *    没有规定价格时提示设置价格(点击横幅直接弹出该模型的价格编辑弹窗,
 *    「保存并确定」即写入配置并立即生效)。
 *  - 设置页 settings.section「任务通知与消耗」:按 1年/6个月/3个月/1个月/
 *    15天/1周/24小时/自定义 时间范围,按 API Key 汇总 Token 消耗
 *    (缓存输入 / 缓外输入 / 输出 + 调用次数)与金额。
 *  - 设置页 settings.section「任务通知与消耗」顶部导航栏(0.3.1):在原来
 *    的页面内通过顶部导航切换「消耗统计 / 价格编辑 / 使用分析」;价格编辑视图里
 *    模型价格跨 Key 合并,同一模型只有一行价格;未激活自定义的模型默认按官方价
 *    计费,激活后解锁编辑(含峰谷子档);支持「添加模型」;保存后立即生效并重算
 *    金额。使用分析视图按时间范围展示:模型消耗金额占比饼图(悬停看明细)+ 各
 *    Key 消耗额度表;Token Plan 回本提示卡片(含计费周期、每 Credit 对应 tokens
 *    与「重置当前周期」按钮);性价比计算(1 元能换多少 tokens,同品牌模型分组,
 *    Token Plan 的 Key 优先用上一轮计费周期);每日费用消耗表(微型日历颜色深度
 *    + 按日期堆叠的各模型消耗,一次显示 6 天,滚轮查看更多)。
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
      '.tn-popup.approval{border-left:3px solid var(--dsw-alias-state-warn-primary,#d9a13b)}',
      '.tn-popup.question{border-left:3px solid var(--dsw-alias-state-business-primary,#4f8cff)}',
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
      '.tn-check>span{flex:1 1 auto;min-width:0;line-height:1.55}',
      '.tn-card .tn-check + .tn-check{margin-top:8px}',
      '.tn-range-row{display:flex;align-items:center;gap:10px}',
      '.tn-range{flex:1;min-width:0;accent-color:var(--dsw-alias-state-business-primary,#4f8cff)}',
      '.tn-range-value{flex:none;min-width:44px;font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));text-align:right;font-variant-numeric:tabular-nums}',
      '.tn-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb))}',
      '.tn-model-row{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))}',
      // 价格与套餐(0.3)
      '.tn-price-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px 8px}',
      '.tn-price-field{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))}',
      '.tn-num-input{width:100%;box-sizing:border-box}',
      '.tn-plan-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-plan-badge{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#333);white-space:nowrap}',
      '.tn-plan-badge.ok{color:var(--dsw-alias-state-ok-primary,#3ba272);border-color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-plan-badge.warn{color:var(--dsw-alias-state-warn-primary,#d9a13b);border-color:var(--dsw-alias-state-warn-primary,#d9a13b)}',
      '.tn-plan-bar{flex:1;min-width:120px;height:6px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));overflow:hidden}',
      '.tn-plan-fill{height:100%;border-radius:3px;background:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-plan-fill.over{background:var(--dsw-alias-state-error-primary,#e05b5b)}',
      '.tn-save-row{display:flex;align-items:center;gap:10px}',
      '.tn-saved{font-size:12px;color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-price-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.5}',
      '.tn-tier-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}',
      '.tn-tier-cell{flex:1;min-width:230px}',
      '.tn-tier-badge{display:inline-block;margin-bottom:4px;font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#333);white-space:nowrap}',
      '.tn-tier-badge.peak{color:#ff9800;border-color:#ff9800}',
      '.tn-tier-badge.off{color:var(--dsw-alias-state-info-primary,#3b82f6);border-color:var(--dsw-alias-state-info-primary,#3b82f6)}',
      '.tn-official-btn{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-button-elevated-fill,#2a2a2a);border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;padding:2px 10px;cursor:pointer}',
      '.tn-official-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      // 价格编辑页(0.3.1)
      '.tn-price-page{display:flex;flex-direction:column;gap:16px;padding:4px 2px 24px;font-size:13px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-price-note{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.6}',
      '.tn-legacy-note{border:1px solid var(--dsw-alias-state-warn-primary,#d9a13b);border-radius:10px;padding:8px 12px;font-size:12px;color:var(--dsw-alias-state-warn-primary,#d9a13b);line-height:1.6}',
      '.tn-model-row2{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))}',
      // 价格编辑页重设(0.3.5):模型卡片 / Provider 子卡片 / 峰谷规则页
      '.tn-card2{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))}',
      '.tn-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer;user-select:none}',
      '.tn-expand-mark{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));width:12px;flex:none}',
      '.tn-card-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}',
      '.tn-prov-list{display:flex;flex-direction:column;gap:8px;margin-top:4px}',
      '.tn-prov-card{display:flex;flex-direction:column;gap:6px;border:1px dashed var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-layer-0,var(--dsh-alias-bg-layer-0,transparent))}',
      '.tn-prov-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-prov-actions{margin-left:auto;display:flex;gap:8px}',
      '.tn-rule-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;border-top:1px dashed var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));padding-top:8px;margin-top:8px}',
      '.tn-rule-idx{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));padding-bottom:6px}',
      '.tn-rule-mult{max-width:110px}',
      '.tn-badge.peakv{color:#ff9800;border-color:#ff9800}',
      '.tn-peak-topbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px}',
      '.tn-model-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-model-name{font-weight:600;font-size:13px;word-break:break-all}',
      '.tn-model-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.tn-badge{display:inline-block;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#333);white-space:nowrap}',
      '.tn-badge.official{color:var(--dsw-alias-state-info-primary,#3b82f6);border-color:var(--dsw-alias-state-info-primary,#3b82f6)}',
      '.tn-badge.custom{color:var(--dsw-alias-state-ok-primary,#3ba272);border-color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-badge.legacy{color:var(--dsw-alias-state-warn-primary,#d9a13b);border-color:var(--dsw-alias-state-warn-primary,#d9a13b)}',
      '.tn-toggle{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-button-elevated-fill,#2a2a2a);border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;padding:2px 10px;cursor:pointer;white-space:nowrap}',
      '.tn-toggle.on{color:#fff;background:var(--dsw-alias-state-ok-primary,#3ba272);border-color:transparent}',
      '.tn-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      '.tn-toggle.on:hover{background:#2f8f60}',
      '.tn-official-summary{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.6;word-break:break-all}',
      '.tn-add-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      // 顶部导航栏(0.3.1:消耗统计 ⇄ 价格编辑;0.3.3:sticky 常驻页面顶部)
      '.tn-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));padding-bottom:8px;flex-wrap:wrap;position:sticky;top:0;z-index:20;background:var(--dsw-alias-bg-base,var(--dsh-alias-bg-base,#141414))}',
      // 回到顶部按钮(0.3.3:滚动超过阈值后出现在右侧)
      '.tn-top-btn{position:fixed;right:18px;bottom:26px;z-index:2147482000;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));background:var(--dsw-alias-button-elevated-fill,var(--dsh-alias-button-elevated-fill,#2a2a2a));color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));box-shadow:0 6px 18px rgba(0,0,0,.3);transition:opacity .2s,transform .2s}',
      '.tn-top-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsh-alias-interactive-bg-hover,rgba(127,127,127,.18)))}',
      '.tn-top-btn svg{width:18px;height:18px}',
      // 悬浮保存按钮(0.3.8:设置页有未保存更改时浮现,贴着设置页内容区左缘、随滚动跟随)
      '.tn-save-fab{position:fixed;z-index:2147482000;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid transparent;background:var(--dsw-alias-state-business-primary,#4f8cff);color:var(--dsw-alias-label-primary-inverted,#fff);box-shadow:0 8px 22px rgba(0,0,0,.35);transition:filter .15s;animation:tn-fab-in .18s cubic-bezier(.2,.8,.2,1)}',
      '.tn-save-fab:hover{filter:brightness(1.12)}',
      '.tn-save-fab svg{width:26px;height:26px}',
      '@keyframes tn-fab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
      // 退出设置页确认浮层(0.3.8:带着未保存更改退出 → 是否保留;超时默认保留)
      '.tn-exit-veil{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}',
      '.tn-exit-card{background:var(--dsw-alias-bg-layer-2,var(--dsh-alias-bg-layer-2,#1f1f1f));border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:12px;padding:16px 18px;max-width:340px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));display:flex;flex-direction:column;gap:10px}',
      '.tn-exit-title{font-weight:600;font-size:14px}',
      '.tn-exit-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.6}',
      '.tn-exit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}',
      '.tn-tab{font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));background:transparent;border:1px solid transparent;border-radius:8px;padding:5px 14px;cursor:pointer;white-space:nowrap}',
      '.tn-tab:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsh-alias-interactive-bg-hover,rgba(127,127,127,.14)))}',
      '.tn-tab.active{color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));background:var(--dsw-alias-button-elevated-fill,var(--dsh-alias-button-elevated-fill,#2a2a2a));border-color:var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));font-weight:600}',
      '.tn-stats-body{display:flex;flex-direction:column;gap:16px}',
      // 使用分析页(0.3.1:模型金额占比 / Key 额度 / Token Plan 回本 / 性价比 / 每日消耗)
      '.tn-analysis{display:flex;flex-direction:column;gap:16px;padding:4px 2px 24px;font-size:13px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-block-title{margin:2px 0 6px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-block-note{font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.6;margin-bottom:6px}',
      '.tn-pie-wrap{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}',
      '.tn-pie-box{position:relative;flex:none}',
      '.tn-pie-tip{position:absolute;z-index:20;pointer-events:none;background:var(--dsw-alias-bg-layer-3,var(--dsh-alias-bg-layer-3,#262626));border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:8px;padding:8px 10px;font-size:11px;line-height:1.55;max-width:250px;box-shadow:0 8px 24px rgba(0,0,0,.35);color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-legend{display:flex;flex-direction:column;gap:4px;flex:1 1 220px;min-width:220px;font-size:12px}',
      '.tn-legend-grid{display:grid;gap:4px 18px;font-size:12px;margin-top:8px}',
      '.tn-legend-item{display:flex;align-items:center;gap:7px;font-size:12px}',
      '.tn-legend-dot{width:9px;height:9px;border-radius:50%;flex:none}',
      '.tn-legend-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb))}',
      '.tn-legend-val{color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.tn-plan-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}',
      '.tn-plan-card{border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:12px;padding:12px 14px;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818));display:flex;flex-direction:column;gap:7px}',
      '.tn-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.tn-plan-key{font-weight:600;font-size:13px;word-break:break-all}',
      '.tn-plan-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));line-height:1.6}',
      '.tn-plan-model{font-size:11px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));display:flex;gap:6px 12px;flex-wrap:wrap;line-height:1.6}',
      '.tn-plan-model b{color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));font-variant-numeric:tabular-nums}',
      '.tn-plan-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.tn-brand-head{font-size:12px;font-weight:600;margin:10px 0 4px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-brand-head:first-child{margin-top:0}',
      '.tn-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;max-width:430px}',
      '.tn-cal-head{font-size:10px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));text-align:center;padding:2px 0}',
      '.tn-cal-cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:10px;border-radius:5px;border:1px solid transparent;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));cursor:default}',
      '.tn-cal-cell.out{opacity:.22}',
      '.tn-cal-cell.today{border-color:var(--dsw-alias-state-business-primary,#4f8cff);color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-daily-scroll{max-height:430px;overflow-y:auto;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:10px}',
      '.tn-daily-day{border-bottom:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333))}',
      '.tn-daily-day:last-child{border-bottom:none}',
      '.tn-daily-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))}',
      '.tn-daily-date{font-weight:600;font-size:12px}',
      '.tn-daily-total{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));font-variant-numeric:tabular-nums}',
      '.tn-daily-stack{display:flex;gap:2px;height:6px;border-radius:3px;overflow:hidden;margin:0 10px 6px}',
      '.tn-daily-seg{height:100%}',
      '.tn-daily-model{display:flex;align-items:center;gap:8px;padding:2px 10px 6px;font-size:11px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb))}',
      '.tn-daily-dot{flex:none;width:9px;height:9px;border-radius:3px}', // 0.3.3:每日模型图例色块(与堆叠色一致)
      '.tn-daily-model-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tn-daily-model b{color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));font-variant-numeric:tabular-nums}',
      '.tn-badge.weighted{color:#ff9800;border-color:#ff9800}',
      '.tn-badge.collecting{color:var(--dsw-alias-state-info-primary,#3b82f6);border-color:var(--dsw-alias-state-info-primary,#3b82f6)}',
      '.tn-btn:disabled{opacity:.5;cursor:not-allowed}',
      // 设置页:清除记录数据(0.3.1)
      '.tn-settings-section{display:flex;flex-direction:column;gap:16px}',
      // 设置页每个选项(插件配置项 / Token Plan Key 卡片)独占一行,从上往下堆叠
      '.tn-settings-section .tn-cards{display:flex;flex-direction:column;align-items:stretch}',
      '.tn-clear-panel{border:1px solid var(--dsw-alias-state-error-primary,#e05b5b);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e05b5b) 6%,transparent)}',
      '.tn-clear-title{font-size:13px;font-weight:600;color:var(--dsw-alias-state-error-primary,#e05b5b)}',
      '.tn-clear-steps{font-size:12px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));line-height:1.8;margin:0}',
      '.tn-clear-code{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:20px;letter-spacing:5px;font-weight:700;color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-bg-base,#141414);border:1px dashed var(--dsw-alias-border-l1,#333);border-radius:8px;padding:6px 12px;user-select:all;display:inline-block}',
      '.tn-danger-btn{font:inherit;font-size:12px;color:#fff;background:var(--dsw-alias-state-error-primary,#e05b5b);border:1px solid transparent;border-radius:8px;padding:5px 14px;cursor:pointer}',
      '.tn-danger-btn:hover{filter:brightness(1.1)}',
      '.tn-danger-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.tn-clear-ok{font-size:12px;color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-clear-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#e05b5b)}',
      // 图形验证码拖动滑块(清除数据)
      '.tn-captcha{position:relative;height:40px;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:10px;background:var(--dsw-alias-bg-base,var(--dsh-alias-bg-base,#141414));overflow:hidden;cursor:pointer;user-select:none;touch-action:none;max-width:340px;min-width:200px;flex:1}',
      '.tn-captcha.disabled{opacity:.45;cursor:not-allowed}',
      '.tn-captcha-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:color-mix(in srgb,var(--dsw-alias-state-info-primary,#3b82f6) 16%,transparent);pointer-events:none}',
      '.tn-captcha-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999));pointer-events:none;white-space:nowrap}',
      '.tn-captcha-knob{position:absolute;top:0;bottom:0;left:0;width:46px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-button-elevated-fill,var(--dsh-alias-button-elevated-fill,#2a2a2a));border-left:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));font-size:16px;cursor:grab;touch-action:none}',
      '.tn-captcha-knob:active{cursor:grabbing}',
      '.tn-captcha.done{border-color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-captcha.done .tn-captcha-fill{background:color-mix(in srgb,var(--dsw-alias-state-ok-primary,#3ba272) 22%,transparent);width:100% !important}',
      '.tn-captcha.done .tn-captcha-knob{background:var(--dsw-alias-state-ok-primary,#3ba272);border-left-color:transparent;color:#fff;cursor:default}',
      '.tn-captcha.done .tn-captcha-hint{color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-captcha-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      // 设置页管理块(0.3.2)
      '.tn-settings-block{border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));border-radius:12px;padding:12px 14px;background:var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818));display:flex;flex-direction:column;gap:10px}',
      // 0.3.4:Token Plan 提示弹窗 / 待确认横幅 / 历史周期列表
      '.tn-plan-popup{display:flex;flex-direction:column;gap:8px}',
      '.tn-plan-popup-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-pending{border:1px solid var(--dsw-alias-state-warn-primary,#d9a13b);border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.6;color:var(--dsw-alias-state-warn-primary,#d9a13b);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d9a13b) 8%,transparent);display:flex;flex-direction:column;gap:8px}',
      '.tn-pending-flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-hist-toggle{cursor:pointer;color:var(--dsw-alias-state-info-primary,#3b82f6)}',
      '.tn-hist-list{display:flex;flex-direction:column;gap:6px;margin-top:2px}',
      '.tn-hist-row{font-size:11px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));line-height:1.6}',
      '.tn-hist-row b{color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));font-variant-numeric:tabular-nums}',
      '.tn-badge.pending{color:var(--dsw-alias-state-warn-primary,#d9a13b);border-color:var(--dsw-alias-state-warn-primary,#d9a13b)}',
      // 重置/撤回/续费流程(0.3.3 卡片 + 0.3.4 弹窗共用)
      '.tn-reset-flow{display:flex;flex-direction:column;gap:6px}',
      '.tn-reset-flow-hint{font-size:12px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));line-height:1.6}',
      '.tn-reset-flow-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.tn-reset-code{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:14px;letter-spacing:2px;font-weight:700;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-reset-cancel{margin-left:auto}',
      // 顶部提示横幅 + 价格编辑弹窗(0.3.6)
      // host 容器必须压回 pointer-events:none:shell.overlay 层会给其直接子元素
      // pointer-events:auto,而样式注入顺序不保证在我们的样式之后;由横幅/弹窗自身恢复可点击。
      '.tn-banner-host{position:absolute;top:0;left:0;right:0;z-index:30;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 12px 0;pointer-events:none !important}',
      '.tn-banner{pointer-events:auto;display:flex;align-items:center;gap:12px;max-width:min(860px,100%);padding:10px 16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));background:var(--dsw-alias-bg-layer-2,var(--dsh-alias-bg-layer-2,#1f1f1f));box-shadow:0 8px 22px rgba(0,0,0,.28);font-size:13px;font-weight:500;color:var(--tn-banner-fg,var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee)));cursor:pointer;animation:tn-banner-in .25s cubic-bezier(.2,.8,.2,1)}',
      '.tn-banner.perm{border-color:var(--dsw-alias-state-business-primary,#4f8cff);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4f8cff) 12%,var(--dsh-alias-bg-layer-2,#1f1f1f))}',
      '.tn-banner.perm.denied{border-color:var(--dsw-alias-state-warn-primary,#d9a13b);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d9a13b) 12%,var(--dsh-alias-bg-layer-2,#1f1f1f))}',
      '.tn-banner.price{border-color:var(--dsw-alias-state-warn-primary,#d9a13b);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d9a13b) 12%,var(--dsh-alias-bg-layer-2,#1f1f1f))}',
      '.tn-banner:hover{filter:brightness(1.08)}',
      '.tn-banner-icon{flex:none;font-size:17px;line-height:1}',
      '.tn-banner-text{min-width:0;line-height:1.55;word-break:break-all}',
      '.tn-banner-close{flex:none;border:none;background:none;color:var(--tn-banner-fg,var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999)));cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;border-radius:6px;opacity:.8}',
      '.tn-banner-close:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsh-alias-interactive-bg-hover,rgba(127,127,127,.18)))}',
      '@keyframes tn-banner-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}',
      '.tn-modal-mask{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:16px;pointer-events:auto}',
      '.tn-modal{width:min(460px,100%);border-radius:12px;border:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));background:var(--dsw-alias-bg-layer-2,var(--dsh-alias-bg-layer-2,#1f1f1f));padding:14px 16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 18px 50px rgba(0,0,0,.4);font-size:12px;color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))}',
      '.tn-modal-title{font-size:13px;font-weight:600;word-break:break-all}',
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
        notifyApproval: '权限请求提醒',
        notifyApprovalDesc: '代理请求权限(如执行命令/越权操作)时通知',
        notifyQuestion: '提问提醒',
        notifyQuestionDesc: '代理提问需要你回答时通知',
        approvalTitle: '需要授权',
        approvalSummary: '工具「{toolName}」请求执行,请批准或拒绝。',
        questionTitle: '需要你回答',
        questionMore: '共 {count} 个问题',
        interactionRemind: '操作提醒(权限 / 提问)',
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
        modelOverviewNote: '同一模型跨 Key / 提供商合并为一行(按模型名归纳);不同版本(不同模型名)各占一行,价格互不影响。',
        modelColumn: '模型',
        retry: '重试',
        connError: '无法连接插件服务:{error}',
        money: '金额',
        costChip: '花费',
        priceUnitNote: '单价按「每 1M tokens」计;金额 = 各类 tokens × 单价 ÷ 1M。未填的字段继承全局默认价;未激活自定义的模型默认按官方价计费。',
        priceGlobal: '全局默认价格',

        currencyLabel: '币种',
        savePricing: '保存价格与套餐',
        savePlans: '保存 Token Plan 设置',
        savedOk: '已保存',
        saveFab: '保存更改',
        exitPromptTitle: '有未保存的更改',
        exitPromptText: '你已退出「任务通知与消耗」设置页,但仍有尚未保存的更改。是否保留这些更改?',
        exitPromptKeep: '保留更改',
        exitPromptDiscard: '放弃更改',
        exitPromptAuto: '{s} 秒内未选择将自动保留更改',
        planToggle: 'Token Plan 订阅',
        planToggleDesc: '此 Key 使用订阅套餐计费,按消耗金额与订阅费对比判断是否回本',
        planFee: '订阅费',
        planCredits: '套餐包含 Credit',
        breakevenTitle: '回本判断',
        brokenEven: '已回本',
        notBrokenEven: '未回本',
        planProgress: '已用 {used} / 订阅费 {fee}',
        planConvert: '换算 1 Credit = ? Tokens',
        convertResult: '1 Credit ≈ {tokens} tokens',
        convertHint: '当前范围共用 {tokens} tokens ÷ {credits} Credits',
        inheritPlaceholder: '继承',
        peakTitle: '峰谷计价',
        peakTitleDesc: '按时段计价的模型(如 DeepSeek)按每次调用的时刻取「峰时 / 谷时」价;没有峰谷档的模型始终用基础价。',
        peakEnabled: '启用峰谷计价',
        peakEnabledDesc: '关闭后一律按基础价计费',
        peakWindows: '峰时段(UTC 小时)',
        peakWindowsPlaceholder: '如:1-4,6-10',
        peakWeekdaysOnly: '仅工作日(周一至周五,北京时间)计峰',
        peakNote: '默认窗口即 DeepSeek 官方规则:北京时间周一至周五 9:00-12:00、14:00-18:00(对应 UTC 01-04、06-10),其余时间为谷时;2026-08-16 16:00 UTC 之前的调用按基础价。',

        tierBase: '基础价',
        tierOffPeak: '谷时(空闲时段)',
        tierPeak: '峰时(高峰时段)',
        // 价格编辑页(0.3.1)
        usageStatsTab: '消耗统计',
        pricePageTitle: '价格编辑',
        pricePageHint: '模型价格跨 Key 合并:不同 Key 使用同一模型的调用都按该模型的价格计费。未激活自定义的模型默认按官方价计费;保存后立即生效并重新计算全部金额。',
        priceModelRows: '模型价格(跨 Key 合并)',
        modelMergedNote: '以下模型来自全部 Key 的消耗记录;同一模型只保留一行,修改价格即对所有使用该模型的 Key 生效。',
        activateCustom: '激活自定义',
        deactivateCustom: '使用官方价',
        activeBadge: '已激活',
        officialBadge: '官方价',
        addModel: '添加模型',
        addModelPlaceholder: '输入模型名称后添加',
        modelExists: '该模型已存在',
        noOfficialPrice: '未收录官方价,未激活时按全局默认价计费',
        officialColon: '官方价',
        legacyPriceNote: '0.1/0.2 版本记录的旧消耗默认按低谷价计费(旧数据没有峰谷语义);0.3 起记录的消耗按每次调用时刻的峰/谷档计费。',
        priceSaveNow: '保存后立即生效:汇总卡片、按 Key 表、按模型表与完工通知金额立即按新价格重算。',
        modelUsageInKeys: '使用 Key',
        planSectionTitle: 'Token Plan 订阅(按 Key)',
        planMovedToSettings: 'Token Plan 设置已移至 设置 → Token Plan Key 管理(本页仅保存价格;套餐保持现状不受影响)。',
        // 价格编辑页重设(0.3.5):模型卡片 + Provider ID 子卡片 + 主体峰谷规则页
        customPrice: '自定义价格',
        useCollective: '使用集体价格',
        collectiveLabel: '集体价格',
        providerSubLabel: 'Provider ID',
        noProvidersHint: '该模型暂无 Provider ID(来自 Provider 目录与消耗记录)。',
        saveCard: '保存',
        peakSettings: '设置',
        peakOnBadge: '峰谷',
        rulesSummaryLabel: '峰谷规则',
        weekdaysShort: '仅工作日',
        peakSubjectTitle: '峰谷计价规则',
        peakBackSave: '返回(保存)',
        peakSubjectHint: '为主体(模型集体价格,或 模型 × Provider ID)管理峰谷计价规则;退出本页时自动保存此页的一切更改。',
        subjectPeakEnabled: '对此主体启用峰谷计价',
        subjectPeakEnabledDesc: '启用后按规则列表取档;关闭后始终按基础价计费',
        ruleMultiplier: '峰时倍率',
        addRule: '添加规则',
        deleteRule: '删除',
        rulePriorityNote: '规则自上而下逐条判定,首个命中调用时刻的规则生效(工作日/每天/自定义按生效日判定,峰时价格按倍率或自定义价),无命中按基础价(类似条件格式的优先级)。',
        noRulesHint: '尚无规则:请至少添加一条,否则始终按基础价计费。',
        providerPeakNote: '该 Provider 的峰谷规则优先于集体规则,仅作用于该 Provider 对此模型的调用;专属价需在卡片上取消「使用集体价格」后编辑。',
        // 0.3.7:峰谷规则 v2(生效日 / 时区 / 峰时价格方式)+ 自定义倍率 + 显示名
        dayScopeLabel: '生效日',
        dayScopeWeekday: '工作日',
        dayScopeEveryday: '每天',
        dayScopeCustom: '自定义',
        peakTzLabel: '时区(UTC 偏移小时)',
        peakTzHint: '峰谷的时刻与星期按该时区判定,默认 8 = UTC+8(北京时间)。',
        peakModeLabel: '峰时价格',
        peakModeMultiplier: '倍率',
        peakModeCustom: '自定义',
        peakCustomHint: '峰时自定义价:仅填写需要覆盖的字段,留空字段按原价计费。',
        priceModeLabel: '自定义方式',
        priceModeCustom: '自定义',
        priceModeMultiplier: '倍率',
        multiplierLabel: '倍率',
        multiplierHint: '实际价 = 该模型默认价(官方价,未收录用全局默认价)× 倍率;下方为按当前倍率计算的实际单价(只读)。',
        provMultiplierLabel: '价格倍率',
        provMultiplierHint: '对该 Provider ID 使用此模型的价格整体 × 倍率(默认 1,与倍率模式叠加生效)。',
        ruleDayCustomHint: '勾选本条规则生效的星期(0 = 周日)。',
        // 使用分析页(0.3.1)
        analysisTab: '使用分析',
        // 设置页(0.3.1):顶部导航「设置」,含插件配置 + 清除记录数据
        settingsTab: '设置',
        settingsSectionTitle: '插件配置',
        // 0.3.2:设置页新增 Token Plan Key 管理 + Provider ID 管理
        tokenPlanKeyManageTitle: 'Token Plan Key 管理',
        tokenPlanKeyManageHint: 'Key 身份 = Provider ID(全局模型设置路由);环境变量名只作辅助展示。可管理所有 Key 的 Token Plan 设置,或删除该 Key 原有的 Token plan 属性。',
        tokenPlanKeyManageScope: '所有 Key(Provider 目录 + 消耗记录 + 已有计划)',
        noKeysHint: '暂无可管理的 Key:既没有已配置 Provider,也没有消耗记录。',
        planAttrDelete: '删除该 Key 的 Token plan 属性',
        planAttrDeleteConfirm: '确定删除「{key}」的 Token plan 属性?删除后该 Key 不再按订阅计费,但其消耗记录与金额保留。',
        planAttrDeleted: '已删除「{key}」的 Token plan 属性。',
        providerIdManageTitle: 'Provider ID 管理',
        providerIdManageHint: 'Provider ID = 全局模型设置里的 Provider(路由),目录行含显示名与所含模型;可重置(重新抓取全局设置 + 账本观测),也可手动删除失效的 Provider ID(删除同时移除其 Token Plan)。',
        providerReset: '重置 Provider ID 管理',
        providerResetting: '重置中…',
        providerResetOk: '已重置 Provider 目录({count} 个)。',
        providerDelete: '删除 Provider',
        providerDeleteConfirm: '确定删除失效 Provider「{id}」?该 Provider 将从目录移除(重扫不再复活),其 Token Plan 一并删除;历史消耗账目保留。',
        providerDeleted: '已删除 Provider「{id}」。',
        providerEmpty: 'Provider 目录为空。首次启动 / 无数据时会在设置页抓取全局模型设置中已配置的 Provider(显示名 + 所含模型)。',
        providerIdLabel: 'Provider ID',
        providerNameColumn: '显示名',
        providerModelsColumn: '所含模型',
        providerKeyEnvColumn: '环境变量',
        providerSource: '来源',
        modelsNone: '未配置模型',
        providerFirstRun: '首次启动 / 无数据:自动抓取全局模型设置中的 Provider ID / 显示名 / 所含模型,保存后在此列出。',
        clearDataTitle: '清除记录数据',
        clearDataDesc: '删除全部 Token 消耗统计账本(usage.json)。此操作不可撤销:清除后「消耗统计」「使用分析」与完工通知金额全部归零,价格、套餐与峰谷配置不受影响。',
        clearStep1: '① 按住右侧滑块,拖动到最右端完成验证',
        clearStep2: '② 输入右侧随机验证码(8 位英文数字,区分大小写)',
        clearStep3: '③ 连续点击两次「确认清除」',
        clearCodeLabel: '验证码',
        clearCodeRefresh: '换一个',
        clearCodeHint: '请先完成上方滑块验证',
        clearCodePlaceholder: '输入上方 8 位验证码',
        clearCodeMismatch: '验证码不正确,请重新输入。',
        clearSlideFirst: '请先将滑条拖到最右端。',
        clearSlideHint: '按住滑块,向右拖动到最右端',
        clearSlideDone: '✓ 验证通过 — 请输入验证码',
        clearHostUnavailable: '宿主服务尚未加载「清除数据」功能(clearUsage),请重启 DSH 后重试。',
        clearConfirm1: '确认清除',
        clearConfirm2: '再次确认清除(不可撤销)',
        clearing: '清除中…',
        clearedOk: '已清除 {count} 条记录,统计已重置。',
        clearError: '清除失败:{error}',
        clearDoneHint: '清除完成后请回到「消耗统计 / 使用分析」查看(已自动刷新)。',
        analysisHint: '分析规定时间范围内各大模型的使用资金状况。',
        pieTitle: '模型消耗金额占比',
        pieHint: '鼠标悬停饼状图块可查看该模型的具体使用情况。',
        keyQuotaTitle: '各 Key 消耗额度',
        planBreakTitle: 'Token Plan 回本提示',
        planBreakHint: '回本 = 当前计费周期内按模型价计算的消耗金额 ≥ 订阅费。「重置当前周期」会把当前周期归档为上一轮、从现在开始新的周期:之前的消耗不再计入现在的回本计算,不影响消耗总额统计。',
        // 今日消耗(0.3.3)
        todayTab: '今日消耗',
        todayTitle: '今日消耗',
        todayHint: '今日({date})各模型的 Token 消耗与消费情况。',
        todayPieTitle: '今日模型消耗金额占比',
        todayModelTokensTitle: '今日各模型 tokens 消耗量',
        todayEntriesTitle: '今日消耗明细(每次调用)',
        todayEntriesHint: '每次模型调用产生消耗的单次记录,按时间倒序排列。',
        pagerPrev: '上一页',
        pagerNext: '下一页',
        pagerInfo: '第 {page} / {pages} 页 · 共 {n} 条',
        timeColumn: '时间',
        backToTop: '回到顶部',
        // Token Plan 重置保护(0.3.3)
        resetCycleHint: '重置将把当前计费周期归档为上一轮,并验证码确认后执行。',
        undoCycleHint: '撤回将恢复重置前的周期边界,重置期间产生的消耗并入当前周期。',
        undoCycle: '撤回重置',
        undoing: '撤回中…',
        resetCodeLabel: '验证码',
        resetCodePlaceholder: '输入 4 位数字验证码',
        resetConfirmA: '确认(1/2)',
        resetConfirmB: '再次确认执行(2/2)',
        undoConfirmB: '再次确认撤回(2/2)',
        resetCancel: '取消',
        undoHostUnavailable: '宿主服务尚未加载「撤回重置」功能(undoPlanCycle),请重启 DSH 后重试。',
        resetCycle: '重置当前周期',
        resetting: '重置中…',
        cycleRange: '当前周期',
        prevCycleLabel: '上一轮',
        resetModeDays: '每 {days} 天',
        resetModeMonthly: '每月 1 号(UTC+0)自动重置',
        planEffectiveAt: '套餐起效',
        planExpireAt: '周期结束',
        tokensPerCreditLabel: '每 Credit ≈',
        planModelCostTitle: '名下各模型消耗(当前周期)',
        noPlan: '暂无设置为 Token Plan 的 Key(可在「设置 → Token Plan Key 管理」配置)。',
        ratioTitle: '性价比计算',
        ratioHint: '1 元(CNY)能兑换多少 tokens = 该模型调用量 ÷ 加权后的使用金额;所有模型的 (Key · 模型) 一起排名比较。Token Plan 的模型按「订阅费 × 该模型按模型价金额占比」加权摊薄订阅费(0.3.7 修复:同计划下各模型性价比可区分,不再全部相同),统计当前生效计费周期;尚无周期数据时用展示范围消耗并标注「正在统计」。',
        rankColumn: '排名',
        keyModelColumn: 'Key · 模型',
        ratioScopeColumn: '统计口径',
        collecting: '正在统计',
        collectingHint: '尚无上一轮计费周期数据,暂按当前周期消耗 ÷ 金额计算;自动轮换或手动重置后将改用上一轮订阅费。',
        dailyTitle: '每日费用消耗表',
        dailyHint: '微型日历中代表一天的正方形的填充颜色深度表示当天用量的多少;下方列出每个日期的各模型消耗金额(Token Plan 的模型按加权平均计算:订阅费 ÷ 周期总 tokens × 当天 tokens),每个日期的数据默认堆叠。',
        dailyScrollHint: '表格一次显示最近 6 天记录,其余需滚动查看。',
        dailyTotalLabel: '合计',
        weightedBadge: '加权',
        tokensUnit: 'tokens',
        modelColumn: '模型',
        tokensPerCny: 'tokens/元',
        spend: '金额',
        dayOfWeekHeaders: ['一', '二', '三', '四', '五', '六', '日'],
        planStartAtLabel: '套餐起效时间',
        planValidityLabel: '有效期(天)',
        planResetModeLabel: '自动重置',
        planResetModeDays: '按天数(默认 31 天)',
        planResetModeMonthly: '每月 1 号(UTC+0)',
        // 0.3.4:Token Plan 提示重置(402/429)+ TID 历史
        planResetTitle: 'Token Plan 需要重置?',
        planResetSummary: '该 Provider 的模型调用返回 402/429(Token Plan 错误码),可能需要重置 Token Plan。',
        planRenewTitle: 'Token Plan 续费确认',
        planRenewSummary: '检测到该 Provider 的 Token Plan 可能已耗尽,是否已续费?',
        planRenewYes: '是,已续费',
        planRenewNo: '否,没续费',
        planRenewConfirm: '确认重置周期(2/2)',
        planNoRenewConfirm: '确定不重置(2/2)',
        planChangedTitle: '是否更改了本次套餐?',
        planChangedSummary: '已确认续费并重置周期。若本次套餐(订阅费 / Credit / 有效期 / 自动重置)有变化,请进入套餐订阅修改。',
        planChangedYes: '是,更改了套餐',
        planChangedNo: '否,没更改',
        planEditHint: '请在 设置 → Token Plan Key 管理 中修改套餐(已为你切换到此页)。',
        planResetNow: '重置 Token Plan',
        planLater: '稍后',
        planPendingBanner: '检测到 402/429(Token Plan 错误码),等待确认是否续费。临时账本(之后产生的消耗,回应后并入原周期):',
        planRenew: '已续费',
        planNotRenew: '没续费',
        planHistory: '历史',
        planHistoryTitle: '历史周期(旧 TID 数据,已冻结)',
        planHistEmpty: '暂无历史周期。',
        planHistRow: '{start} ~ {end} · 订阅费 {fee} · {tokens} tokens · {cost}',
        pendingBadge: '待确认',
        cyclePeriodLabel: '周期',
        // 顶部提示横幅 + 价格编辑弹窗(0.3.6)
        bannerPermText: '系统通知权限尚未开启 — 点击此处授权,获得完整能力体验(桌面横幅 + Windows 操作中心,页面切到后台也能收到提醒)。',
        bannerPermDeniedText: '浏览器已拒绝通知权限 — 请在地址栏站点权限中允许通知后刷新页面。',
        bannerPermGrantedTitle: '系统通知已开启',
        bannerPermGrantedBody: '通知权限授权成功;任务完成 / 权限请求 / 提问提醒现在会以系统通知发送(桌面横幅 + Windows 操作中心)。',
        bannerPermRequesting: '正在请求浏览器授权…请在浏览器地址栏处弹出的询问中选择「允许」。',
        bannerPermDismissed: '授权窗口被关闭且未做选择,通知仍未开启 — 请再次点击本横幅并选择「允许」;若浏览器不再弹出询问,说明已被静默拦截,请在地址栏站点设置中把通知改为「允许」。',
        bannerPriceText: '模型「{model}」没有规定价格,金额按全局默认价计算 — 点击设置自定义价格。',
        bannerPriceEditTitle: '设置「{model}」的价格',
        bannerPriceModalHint: '单价按「每 1M tokens」计({currency});输入框已预填全局默认价,留空字段继续继承全局默认价。保存后立即生效,消耗统计 / 使用分析与通知金额都按此价格计算。',
        bannerPriceSave: '保存并确定',
        cancel: '取消',
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
        notifyApproval: 'Approval reminders',
        notifyApprovalDesc: 'Notify when the agent requests permission (e.g. running a command)',
        notifyQuestion: 'Question reminders',
        notifyQuestionDesc: 'Notify when the agent asks you to answer',
        approvalTitle: 'Permission required',
        approvalSummary: 'Tool "{toolName}" requests permission — approve or deny.',
        questionTitle: 'Answer needed',
        questionMore: '{count} questions in total',
        interactionRemind: 'Action reminders (approval / question)',
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
        modelOverviewNote: 'Rows are merged per model name across keys/providers (grouped by name); different model versions (different names) keep separate rows with independent prices.',
        modelColumn: 'Model',
        retry: 'Retry',
        connError: 'Cannot reach the plugin service: {error}',
        money: 'Cost',
        costChip: 'Spent',
        priceUnitNote: 'Prices are per 1M tokens; cost = tokens × unit price ÷ 1M. Empty fields inherit the global default; models without a custom price bill at the official price.',
        priceGlobal: 'Global default price',

        currencyLabel: 'Currency',
        savePricing: 'Save pricing & plans',
        savePlans: 'Save Token Plan settings',
        savedOk: 'Saved',
        saveFab: 'Save changes',
        exitPromptTitle: 'Unsaved changes',
        exitPromptText: 'You left the "Task & Usage" settings page with unsaved changes. Keep them?',
        exitPromptKeep: 'Keep changes',
        exitPromptDiscard: 'Discard',
        exitPromptAuto: 'Changes are kept automatically in {s}s if no choice is made',
        planToggle: 'Token Plan subscription',
        planToggleDesc: 'This key uses a subscription plan; break-even is judged by comparing the consumed amount with the subscription fee',
        planFee: 'Subscription fee',
        planCredits: 'Credits in plan',
        breakevenTitle: 'Break-even',
        brokenEven: 'Broken even',
        notBrokenEven: 'Not yet',
        planProgress: 'Used {used} / fee {fee}',
        planConvert: 'Convert 1 Credit = ? Tokens',
        convertResult: '1 Credit ≈ {tokens} tokens',
        convertHint: 'Range total {tokens} tokens ÷ {credits} credits',
        inheritPlaceholder: 'inherit',
        peakTitle: 'Peak/off-peak pricing',
        peakTitleDesc: "Models billed by time of day (e.g. DeepSeek) use the peak/off-peak price matching each call's time; models without a peak tier always use the base price.",
        peakEnabled: 'Enable peak/off-peak',
        peakEnabledDesc: 'When off, everything bills at the base price',
        peakWindows: 'Peak hours (UTC)',
        peakWindowsPlaceholder: 'e.g. 1-4,6-10',
        peakWeekdaysOnly: 'Peak applies on weekdays only (Mon–Fri, Beijing time)',
        peakNote: 'The default windows follow DeepSeek official: Beijing Mon–Fri 09:00–12:00 & 14:00–18:00 (UTC 01–04, 06–10); everything else is off-peak. Calls before 2026-08-16 16:00 UTC bill at the base price.',

        tierBase: 'Base price',
        tierOffPeak: 'Off-peak',
        tierPeak: 'Peak',
        // Price editor page (0.3.1)
        usageStatsTab: 'Usage',
        pricePageTitle: 'Price editor',
        pricePageHint: 'Model prices are merged across keys: every call to the same model, no matter which key, bills at that model\'s price. Models without a custom price default to the official price; saving applies immediately and recomputes all amounts.',
        priceModelRows: 'Model prices (merged across keys)',
        modelMergedNote: 'Models below come from the usage records of all keys; each model has a single row, and editing its price affects every key using it.',
        activateCustom: 'Customize',
        deactivateCustom: 'Use official',
        activeBadge: 'Custom',
        officialBadge: 'Official',
        addModel: 'Add model',
        addModelPlaceholder: 'Type a model name to add',
        modelExists: 'Model already exists',
        noOfficialPrice: 'No official price found; bills at the global default while not customized',
        officialColon: 'Official',
        legacyPriceNote: 'Usage recorded by v0.1/v0.2 defaults to the off-peak price (legacy entries carry no peak semantics); usage recorded since v0.3 bills by the peak/off-peak tier at each call\'s time.',
        priceSaveNow: 'Saving applies immediately: summary cards, per-key table, per-model table and completion-notification amounts are recomputed at the new prices.',
        modelUsageInKeys: 'Keys',
        planSectionTitle: 'Token Plan subscriptions (per key)',
        planMovedToSettings: 'Token Plan settings now live under Settings → Token Plan Key management (this page only saves prices; plans stay untouched).',
        // Price editor redesign (0.3.5): model cards + Provider ID sub-cards + subject peak rules page
        customPrice: 'Custom price',
        useCollective: 'Use collective price',
        collectiveLabel: 'Collective price',
        providerSubLabel: 'Provider ID',
        noProvidersHint: 'No Provider IDs for this model yet (from the provider directory and usage records).',
        saveCard: 'Save',
        peakSettings: 'Settings',
        peakOnBadge: 'Peak',
        rulesSummaryLabel: 'Peak rules',
        weekdaysShort: 'weekdays only',
        peakSubjectTitle: 'Peak/off-peak rules',
        peakBackSave: 'Back (saves)',
        peakSubjectHint: 'Manage peak/off-peak rules for a subject (model collective price, or model × Provider ID); every change on this page is saved when you leave it.',
        subjectPeakEnabled: 'Enable peak/off-peak for this subject',
        subjectPeakEnabledDesc: 'When on, the rules below pick the tier; when off, everything bills at the base price',
        ruleMultiplier: 'Peak multiplier',
        addRule: 'Add rule',
        deleteRule: 'Delete',
        rulePriorityNote: 'Rules are evaluated top-down; the first rule matching the call time applies (active days picked per rule, peak price applied as a multiplier or custom prices), no match → base price (like conditional formatting priority).',
        noRulesHint: 'No rules yet: add at least one, otherwise everything bills at the base price.',
        providerPeakNote: 'This provider\'s rules take priority over the collective ones and apply only to this provider\'s calls of this model; uncheck “Use collective price” on the card to edit a dedicated price.',
        // 0.3.7: peak rule v2 (active days / timezone / peak price mode) + multiplier modes + display names
        dayScopeLabel: 'Active days',
        dayScopeWeekday: 'Weekdays',
        dayScopeEveryday: 'Every day',
        dayScopeCustom: 'Custom',
        peakTzLabel: 'Timezone (UTC offset hours)',
        peakTzHint: 'Peak hours and weekdays are judged in this timezone; default 8 = UTC+8 (Beijing).',
        peakModeLabel: 'Peak price',
        peakModeMultiplier: 'Multiplier',
        peakModeCustom: 'Custom',
        peakCustomHint: 'Custom peak prices: only fill the fields to override; empty fields bill at the base price.',
        priceModeLabel: 'Custom mode',
        priceModeCustom: 'Custom fields',
        priceModeMultiplier: 'Multiplier',
        multiplierLabel: 'Multiplier',
        multiplierHint: 'Actual price = the model\'s default (official, or global default when not listed) × multiplier; the read-only grid below shows the effective unit prices.',
        provMultiplierLabel: 'Price multiplier',
        provMultiplierHint: 'Scales this model\'s final price under this Provider ID (default 1; stacks with multiplier mode).',
        ruleDayCustomHint: 'Pick the weekdays this rule applies to (0 = Sunday).',
        // Usage analysis page (0.3.1)
        analysisTab: 'Analysis',
        settingsTab: 'Settings',
        settingsSectionTitle: 'Plugin settings',
        tokenPlanKeyManageTitle: 'Token Plan Key management',
        tokenPlanKeyManageHint: 'Key identity = Provider ID (route from global model settings); the env-var name is shown for reference only. Manage every Key\'s Token Plan here, or delete the original Token plan attribute of a Key.',
        tokenPlanKeyManageScope: 'All Keys (provider directory + usage records + existing plans)',
        noKeysHint: 'No manageable Keys yet: neither configured providers nor usage records.',
        planAttrDelete: 'Delete this Key\'s Token plan attribute',
        planAttrDeleteConfirm: 'Delete the Token plan attribute of “{key}”? The Key will no longer bill as a subscription, while its usage records and amounts stay.',
        planAttrDeleted: 'Deleted “{key}” Token plan attribute.',
        providerIdManageTitle: 'Provider ID management',
        providerIdManageHint: 'Provider ID = provider (route) in global model settings; each directory row carries the display name and contained models. Reset re-fetches from the global model settings + ledger; you can also manually delete invalid Provider IDs (their Token Plan is removed too).',
        providerReset: 'Reset Provider ID management',
        providerResetting: 'Resetting…',
        providerResetOk: 'Provider directory reset ({count} rows).',
        providerDelete: 'Delete provider',
        providerDeleteConfirm: 'Delete invalid Provider “{id}”? It is removed from the directory (a later rescan will not resurrect it) and its Token Plan is deleted; historical usage stays.',
        providerDeleted: 'Deleted Provider “{id}”.',
        providerEmpty: 'The provider directory is empty. On first launch / with no data the plugin fetches configured providers from the global model settings (display names + contained models).',
        providerIdLabel: 'Provider ID',
        providerNameColumn: 'Display name',
        providerModelsColumn: 'Models',
        providerKeyEnvColumn: 'Env var',
        providerSource: 'Source',
        modelsNone: 'No models configured',
        providerFirstRun: 'First launch / no data: provider IDs, display names and contained models are fetched from the global model settings and listed here.',
        clearDataTitle: 'Clear usage records',
        clearDataDesc: 'Deletes the entire token-usage ledger (usage.json). This cannot be undone: after clearing, Usage, Analysis and completion-notification costs all reset to zero. Prices, plans and peak/off-peak config are kept.',
        clearStep1: '① Hold the slider and drag it all the way to the right',
        clearStep2: '② Type the random 8-character code (letters & digits, case-sensitive)',
        clearStep3: '③ Click “Confirm clear” twice',
        clearCodeLabel: 'Code',
        clearCodeRefresh: 'Regenerate',
        clearCodeHint: 'Complete the slider verification above first',
        clearCodePlaceholder: 'Enter the 8-character code above',
        clearCodeMismatch: 'Incorrect code — please re-enter.',
        clearSlideFirst: 'Drag the slider all the way to the right first.',
        clearSlideHint: 'Hold and drag the slider to the right end',
        clearSlideDone: '✓ Verified — enter the code',
        clearHostUnavailable: 'The host service does not expose clearUsage yet — restart DSH and retry.',
        clearConfirm1: 'Confirm clear',
        clearConfirm2: 'Confirm again (irreversible)',
        clearing: 'Clearing…',
        clearedOk: 'Cleared {count} records; statistics reset.',
        clearError: 'Clear failed: {error}',
        clearDoneHint: 'Head back to Usage / Analysis afterwards (already refreshed).',
        analysisHint: 'Money spent by each large model within the selected time range.',
        pieTitle: 'Cost share by model',
        pieHint: 'Hover a pie slice to see that model\'s usage details.',
        keyQuotaTitle: 'Per-key cost quota',
        planBreakTitle: 'Token Plan break-even',
        planBreakHint: 'Break-even = current billing-cycle cost (at model prices) ≥ subscription fee. “Reset current cycle” archives the current cycle as the previous one and starts a new cycle now: past consumption no longer counts toward break-even, while total-cost statistics are unaffected.',
        resetCycle: 'Reset current cycle',
        undoing: 'Undoing…',
        undoCycle: 'Undo reset',
        undoCycleHint: 'Undo restores the pre-reset cycle boundary; usage recorded since the reset merges into the restored cycle.',
        resetCycleHint: 'Reset archives the current billing cycle as the previous one and starts a new cycle now.',
        resetCodeLabel: 'Code',
        resetCodePlaceholder: 'Enter the 4-digit code',
        resetConfirmA: 'Confirm (1/2)',
        resetConfirmB: 'Confirm & execute (2/2)',
        undoConfirmB: 'Confirm & undo (2/2)',
        resetCancel: 'Cancel',
        undoHostUnavailable: 'The host service does not expose undoPlanCycle yet — restart DSH and retry.',
        todayTab: 'Today',
        todayTitle: 'Today\'s usage',
        todayHint: 'Today ({date}): per-model token usage and spend.',
        todayPieTitle: 'Today\'s cost share by model',
        todayModelTokensTitle: 'Today\'s token usage by model',
        todayEntriesTitle: 'Today\'s usage detail (per call)',
        todayEntriesHint: 'Each model call that produced usage, newest first.',
        pagerPrev: 'Prev',
        pagerNext: 'Next',
        pagerInfo: 'Page {page} / {pages} · {n} records',
        timeColumn: 'Time',
        backToTop: 'Back to top',
        resetting: 'Resetting…',
        cycleRange: 'Current cycle',
        prevCycleLabel: 'Previous',
        resetModeDays: 'Every {days} days',
        resetModeMonthly: 'Auto-reset on the 1st (UTC+0)',
        planEffectiveAt: 'Plan start',
        planExpireAt: 'Cycle ends',
        tokensPerCreditLabel: '1 Credit ≈',
        planModelCostTitle: 'Per-model cost (current cycle)',
        noPlan: 'No key is set as Token Plan yet (configure it under Settings → Token Plan Key management).',
        ratioTitle: 'Cost-performance',
        ratioHint: 'Tokens per 1 CNY = the model\'s tokens ÷ its weighted spend; all models (key · model) are ranked together. Token Plan models allocate the subscription fee weighted by each model\'s price-based spend share (0.3.7 fix: models under the same plan are now distinguishable instead of identical), counted over the current billing cycle; without cycle data the display range is used and marked “collecting”.',
        rankColumn: 'Rank',
        keyModelColumn: 'Key · Model',
        ratioScopeColumn: 'Scope',
        collecting: 'Collecting',
        collectingHint: 'No previous billing-cycle data yet; using current-cycle consumption ÷ amount. After auto-rotation or a manual reset, the previous subscription fee will be used.',
        dailyTitle: 'Daily cost table',
        dailyHint: 'The fill depth of each day\'s square in the mini calendar shows how much that day cost. Below: each date\'s per-model amounts (Token Plan models use a weighted average: subscription fee ÷ cycle tokens × that day\'s tokens); each date\'s data is stacked by default.',
        dailyScrollHint: 'The table shows the latest 6 days at once; scroll for more.',
        dailyTotalLabel: 'Total',
        weightedBadge: 'weighted',
        tokensUnit: 'tokens',
        modelColumn: 'Model',
        tokensPerCny: 'tokens/CNY',
        spend: 'Spent',
        dayOfWeekHeaders: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        planStartAtLabel: 'Plan start time',
        planValidityLabel: 'Validity (days)',
        planResetModeLabel: 'Auto reset',
        planResetModeDays: 'By days (default 31)',
        planResetModeMonthly: '1st of month (UTC+0)',
        planResetTitle: 'Reset Token Plan?',
        planResetSummary: 'This provider\'s model call returned 402/429 (Token Plan error code) — the Token Plan may need a reset.',
        planRenewTitle: 'Token Plan renewal',
        planRenewSummary: 'This provider\'s Token Plan may be exhausted — have you renewed it?',
        planRenewYes: 'Yes, renewed',
        planRenewNo: 'No, not yet',
        planRenewConfirm: 'Confirm cycle reset (2/2)',
        planNoRenewConfirm: 'Confirm no reset (2/2)',
        planChangedTitle: 'Did the plan change this time?',
        planChangedSummary: 'Renewal confirmed and the cycle was reset. If the plan (fee / credits / validity / auto-reset) changed, edit the subscription now.',
        planChangedYes: 'Yes, changed',
        planChangedNo: 'No, same plan',
        planEditHint: 'Edit the plan under Settings → Token Plan Key management (switched there for you).',
        planResetNow: 'Reset Token Plan',
        planLater: 'Later',
        planPendingBanner: 'A 402/429 (Token Plan error code) was detected; waiting for your renewal answer. Temporary ledger (usage since then, merged into the original cycle after your answer):',
        planRenew: 'Renewed',
        planNotRenew: 'Not renewed',
        planHistory: 'History',
        planHistoryTitle: 'Past cycles (old TID data, frozen)',
        planHistEmpty: 'No past cycles yet.',
        planHistRow: '{start} ~ {end} · fee {fee} · {tokens} tokens · {cost}',
        pendingBadge: 'pending',
        cyclePeriodLabel: 'Cycle',
        // Top banners + price-edit modal (0.3.6)
        bannerPermText: 'System-notification permission is not granted — click here to grant it for the full experience (desktop banner + Windows Action Center, reminders even while the page is backgrounded).',
        bannerPermDeniedText: 'Notification permission was blocked — allow it for this site in the address bar, then reload.',
        bannerPermGrantedTitle: 'System notifications enabled',
        bannerPermGrantedBody: 'Permission granted — completion, approval and question reminders now arrive as system notifications (desktop banner + Windows Action Center).',
        bannerPermRequesting: 'Asking the browser… choose "Allow" in the prompt near the address bar.',
        bannerPermDismissed: 'The prompt was dismissed without a choice and notifications are still off — click again and pick "Allow"; if the prompt no longer appears the browser silently blocked it, allow notifications via the address-bar site settings.',
        bannerPriceText: 'Model "{model}" has no defined price; costs fall back to the global default — click to set a custom price.',
        bannerPriceEditTitle: 'Set price for "{model}"',
        bannerPriceModalHint: 'Prices are per 1M tokens ({currency}); inputs are prefilled with the global default and empty fields keep inheriting it. Saving applies immediately to usage stats, analysis and notification amounts.',
        bannerPriceSave: 'Save & apply',
        cancel: 'Cancel',
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

    // ── 退出设置页确认浮层(0.3.8)───────────────────────────────────────────
    // 带着未保存更改直接退出设置页时弹出「是否保留更改」;长时间未回复默认保留
    // (自动保存)。纯 DOM 浮层挂在 body 上,不依赖已卸载的 React 树。
    function confirmKeepChanges(onKeep, seconds = 10) {
      let left = seconds
      let timer = null
      let done = false
      const veil = document.createElement('div')
      veil.className = 'tn-exit-veil'
      const card = document.createElement('div')
      card.className = 'tn-exit-card'
      const title = document.createElement('div')
      title.className = 'tn-exit-title'
      title.textContent = t('exitPromptTitle')
      const text = document.createElement('div')
      text.className = 'tn-exit-hint'
      text.textContent = t('exitPromptText')
      const auto = document.createElement('div')
      auto.className = 'tn-exit-hint'
      auto.textContent = t('exitPromptAuto', { s: left })
      const actions = document.createElement('div')
      actions.className = 'tn-exit-actions'
      const close = () => {
        if (done) return
        done = true
        if (timer !== null) window.clearInterval(timer)
        try { veil.remove() } catch { /* ignore */ }
      }
      const keep = document.createElement('button')
      keep.className = 'tn-btn'
      keep.textContent = t('exitPromptKeep')
      keep.onclick = () => { close(); try { onKeep() } catch { /* ignore */ } }
      const discard = document.createElement('button')
      discard.className = 'tn-danger-btn'
      discard.textContent = t('exitPromptDiscard')
      discard.onclick = close
      actions.appendChild(discard)
      actions.appendChild(keep)
      card.appendChild(title)
      card.appendChild(text)
      card.appendChild(auto)
      card.appendChild(actions)
      veil.appendChild(card)
      document.body.appendChild(veil)
      // 长时间未回复 → 默认保留更改(自动保存)
      timer = window.setInterval(() => {
        if (done) { window.clearInterval(timer); return }
        left -= 1
        if (left <= 0) keep.click()
        else auto.textContent = t('exitPromptAuto', { s: left })
      }, 1000)
    }

    /**
     * 数据进制规则(0.3.2):0-99,999 无单位;≥100,000 用 4 位数字 + K/M/B/T
     * 单位(千/百万/十亿/千亿),超出部分四舍五入,优先小单位(9999K → 10.00M)。
     * 仅显示层使用;后台计算仍是精确数据。
     */
    function fmt(n) {
      const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
      if (Math.abs(v) < 1e5) return v.toLocaleString('en-US')
      const units = [['K', 1e3], ['M', 1e6], ['B', 1e9], ['T', 1e11]]
      let u = 0
      const a = Math.abs(v)
      while (u < units.length - 1 && a / units[u][1] >= 1e4) u++
      let r = sig4(a / units[u][1])
      if (r >= 1e4 && u < units.length - 1) { u++; r = sig4(a / units[u][1]) }
      const text = r >= 1000 ? r.toFixed(0) : r >= 100 ? r.toFixed(1) : r >= 10 ? r.toFixed(2) : r.toFixed(3)
      return (v < 0 ? '-' : '') + text + units[u][0]
    }

    /** 4 位有效数字舍入(整数级运算,规避浮点噪声,如 120.05 → 120.1)。 */
    function sig4(x) {
      if (!(x > 0)) return 0
      const f = Math.pow(10, 3 - Math.floor(Math.log10(x)))
      return Math.round(x * f) / f
    }

    /** 精确值(悬停 title 用)。 */
    function fmtExact(n) {
      const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
      return v.toLocaleString('en-US', { maximumFractionDigits: 6 })
    }

    /** 金额显示:币种 + (≥10 万按 K/M/B/T 规则,<10 万按 4 位有效数字)。 */
    function fmtMoney(value, currency) {
      const cur = currency === '$' ? '$' : '¥'
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
      if (Math.abs(n) >= 1e5) return cur + fmt(n)
      try {
        return cur + new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format(n)
      } catch {
        return cur + n.toFixed(4)
      }
    }

    /** 数字展示元素:悬停 title 显示精确值。 */
    function num(n) {
      const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
      return React.createElement('span', { title: fmtExact(v) }, fmt(v))
    }

    /** 金额展示元素:悬停 title 显示精确值。 */
    function money(v, currency) {
      const cur = currency === '$' ? '$' : '¥'
      const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
      return React.createElement('span', { title: cur + fmtExact(n) }, fmtMoney(n, cur))
    }

    /**
     * Key 行显示(0.3.2):身份 = Provider ID(路由);显示名 = Provider 显示名;
     * 环境变量名(keyEnv)只作辅助展示。返回 { title, sub }(sub 可为空)。
     */
    function providerRowLabel(row, providerList) {
      const key = (row && typeof row.key === 'string') ? row.key : ''
      const id = (row && typeof row.provider === 'string' && row.provider !== '') ? row.provider : ''
      const name = (row && typeof row.providerName === 'string' && row.providerName !== '') ? row.providerName : ''
      const env = (row && typeof row.keyEnv === 'string' && row.keyEnv !== '') ? row.keyEnv : ''
      // 无 providerName 时按目录兜底
      let resolved = name
      if (resolved === '' && Array.isArray(providerList)) {
        const hit = providerList.find((p) => p && (p.id === key || (id !== '' && p.id === id)))
        if (hit && typeof hit.displayName === 'string' && hit.displayName !== '') resolved = hit.displayName
      }
      const main = resolved || key || id || 'unknown'
      const bits = []
      if (resolved !== '' && key !== '' && key !== resolved && key !== id) bits.push(key)
      if (env !== '' && env !== key && env !== resolved && bits.indexOf(env) === -1) bits.push(env)
      return { main, sub: bits.join(' · ') }
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

    /** 系统通知文案:turn/goal 带 token 明细;approval/question 只带摘要。 */
    function nativeNotifyBody(frame) {
      if (frame.type === 'approval' || frame.type === 'question') {
        return (frame.summary || '').replace(/\s+/g, ' ').trim()
      }
      const b = frame.tokens || {}
      const parts = []
      parts.push(t('cacheIn') + ' ' + fmt(b.cacheIn))
      parts.push(t('cacheOut') + ' ' + fmt(b.cacheOut))
      parts.push(t('output') + ' ' + fmt(b.output))
      if (b.cacheWrite > 0) parts.push(t('cacheWrite') + ' ' + fmt(b.cacheWrite))
      if (b.reasoning > 0) parts.push(t('reasoning') + ' ' + fmt(b.reasoning))
      if (typeof frame.cost === 'number' && frame.cost > 0) parts.push(t('money') + ' ' + fmtMoney(frame.cost, frame.currency || '¥'))
      return (frame.summary || '') + '\n' + parts.join(' · ') + '\n' + t('total') + ' ' + fmt(frame.total)
    }

    const NATIVE_TYPE_TITLE = { turn: 'popupTitle', goal: 'goalTitle', approval: 'approvalTitle', question: 'questionTitle' }

    /** 通知帧到达时按配置发送系统通知;任何失败静默,绝不影响主流程。 */
    function showNativeNotify(frame, cfg) {
      if (!NATIVE_NOTIFY) return
      if (!frame || !Object.prototype.hasOwnProperty.call(NATIVE_TYPE_TITLE, frame.type)) return
      if (!cfg) return
      if (cfg.webNotify === false) return
      if (frame.type === 'turn' && cfg.notifyOnTurn === false) return
      if (frame.type === 'goal' && cfg.notifyOnGoal === false) return
      if (frame.type === 'approval' && cfg.notifyOnApproval === false) return
      if (frame.type === 'question' && cfg.notifyOnQuestion === false) return
      if (!notifyGranted()) return
      // webNotifyBackgroundOnly:页面在前台时由页内弹窗负责,避免双份打扰
      if (cfg.webNotifyBackgroundOnly !== false) {
        let visible = true
        try { visible = document.visibilityState === 'visible' } catch { /* ignore */ }
        if (visible) return
      }
      // 跨标签页去重:hub 会向每个打开的标签页推送同一帧,避免操作中心重复。
      // 0.3.5:键取 frame.dedupeKey(操作提醒 = 跨标签页稳定的内容签名),
      // 无该字段的帧(turn/goal/plan,宿主广播、id 跨页一致)回退 frame.id。
      try {
        const key = 'dsh-task-notice:notified:' + String(frame.dedupeKey ?? frame.id ?? '')
        const last = Number(window.localStorage.getItem(key) || 0)
        const now = Date.now()
        if (now - last < 30000) return
        window.localStorage.setItem(key, String(now))
      } catch { /* localStorage 不可用时跳过跨页去重 */ }
      // 0.3:turn/goal 帧的 title 已由宿主带上金额(如「任务完成 · ¥0.12」)
      const title = frame.title || t(NATIVE_TYPE_TITLE[frame.type])
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
    const strCodec = codecOf((v) => {
      if (typeof v !== 'string') throw new Error('expected string')
      return v
    }, 'dsh-task-notice#String')
    const boolCodec = codecOf((v) => {
      if (typeof v !== 'boolean') throw new Error('expected boolean')
      return v
    }, 'dsh-task-notice#Flag')

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
          id: 'dsh-task-notice#taskNotice/getUsageEntries', service: 'taskNotice', namespace: 'taskNotice', method: 'getUsageEntries',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageEntries'),
        },
        {
          id: 'dsh-task-notice#taskNotice/subscribeNotifications', service: 'taskNotice', namespace: 'taskNotice', method: 'subscribeNotifications',
          invocation: { kind: 'direct' }, mode: 'stream', parameters: [], cancellation: { parameter: 'signal' },
          result: objCodec('dsh-task-notice#NotificationFrame'),
        },
        {
          id: 'dsh-task-notice#taskNotice/getPriceCatalog', service: 'taskNotice', namespace: 'taskNotice', method: 'getPriceCatalog',
          invocation: { kind: 'direct' }, parameters: [],
          result: objCodec('dsh-task-notice#PriceCatalog'),
        },
        {
          id: 'dsh-task-notice#taskNotice/getUsageAnalysis', service: 'taskNotice', namespace: 'taskNotice', method: 'getUsageAnalysis',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageAnalysis'),
        },
        {
          id: 'dsh-task-notice#taskNotice/resetPlanCycle', service: 'taskNotice', namespace: 'taskNotice', method: 'resetPlanCycle',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'key', wire: 'key', source: 'json', codec: strCodec },
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageAnalysis'),
        },
        {
          id: 'dsh-task-notice#taskNotice/undoPlanCycle', service: 'taskNotice', namespace: 'taskNotice', method: 'undoPlanCycle',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'key', wire: 'key', source: 'json', codec: strCodec },
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageAnalysis'),
        },
        {
          id: 'dsh-task-notice#taskNotice/renewPlanCycle', service: 'taskNotice', namespace: 'taskNotice', method: 'renewPlanCycle',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'key', wire: 'key', source: 'json', codec: strCodec },
            { name: 'planChanged', wire: 'planChanged', source: 'json', codec: boolCodec },
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageAnalysis'),
        },
        {
          id: 'dsh-task-notice#taskNotice/dismissPlanPending', service: 'taskNotice', namespace: 'taskNotice', method: 'dismissPlanPending',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'key', wire: 'key', source: 'json', codec: strCodec },
            { name: 'fromMs', wire: 'fromMs', source: 'json', codec: numCodec },
            { name: 'toMs', wire: 'toMs', source: 'json', codec: numCodec },
          ],
          result: objCodec('dsh-task-notice#UsageAnalysis'),
        },
        {
          id: 'dsh-task-notice#taskNotice/clearUsage', service: 'taskNotice', namespace: 'taskNotice', method: 'clearUsage',
          invocation: { kind: 'direct' }, parameters: [],
          result: objCodec('dsh-task-notice#ClearResult'),
        },
        {
          id: 'dsh-task-notice#taskNotice/getProviderDirectory', service: 'taskNotice', namespace: 'taskNotice', method: 'getProviderDirectory',
          invocation: { kind: 'direct' }, parameters: [],
          result: objCodec('dsh-task-notice#ProviderDirectory'),
        },
        {
          id: 'dsh-task-notice#taskNotice/refreshProviderDirectory', service: 'taskNotice', namespace: 'taskNotice', method: 'refreshProviderDirectory',
          invocation: { kind: 'direct' }, parameters: [],
          result: objCodec('dsh-task-notice#ProviderDirectory'),
        },
        {
          id: 'dsh-task-notice#taskNotice/deleteProviderId', service: 'taskNotice', namespace: 'taskNotice', method: 'deleteProviderId',
          invocation: { kind: 'direct' },
          parameters: [{ name: 'id', wire: 'id', source: 'json', codec: strCodec }],
          result: objCodec('dsh-task-notice#ProviderDirectory'),
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

    /** 本地随机 4 位数字验证码(重置保护)。 */
    function gen4() {
      return String(Math.floor(1000 + Math.random() * 9000))
    }

    /** 本地通知帧 id。 */
    function localFrameId() {
      return 'c' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    }

    /** 通知设置页视图切换(设置页已挂载时生效;未挂载时用户按提示手动进入)。 */
    function openPluginView(view, key) {
      try {
        window.dispatchEvent(new CustomEvent('dsh-task-notice:open-view', { detail: { view, key } }))
      } catch { /* 跨窗口事件不可用时忽略 */ }
    }

    // 0.3.4:Token Plan 提示弹窗(402/429 提示重置 / 续费确认 / 套餐变更确认)。
    // reset 弹窗内嵌重置流程(4 位验证码 + 两次确认),即「点击弹窗进入重置页」;
    // renew 弹窗「是 + 确认」重置(续费)、「否 + 确定」不重置;renew 确认后再弹
    // 「是否更改了本次套餐?」,选择「是」切换到 设置 → Token Plan Key 管理。
    function PlanPopup(props) {
      const el = React.createElement
      const { frame, api, providers, pushLocal, onClose } = props
      const meta = (frame && frame.plan && typeof frame.plan === 'object') ? frame.plan : null
      const action = (meta && meta.action) ? meta.action : 'reset'
      const key = (meta && typeof meta.key === 'string') ? meta.key : (frame && typeof frame.key === 'string' ? frame.key : '')
      const provider = (meta && meta.provider) || (frame && frame.provider) || ''
      const providerList = Array.isArray(providers) ? providers : []
      const label = providerRowLabel({ key, provider, providerName: providerDisplayOf(providerList, key) }, providerList)
      // 重置流程(仅 reset):{ code, input, stage };renew/dismiss 为两段确认(stage 0→1)
      const [flow, setFlow] = React.useState(null)
      const [stage, setStage] = React.useState(0)
      const [busy, setBusy] = React.useState(false)
      const [err, setErr] = React.useState(null)

      const run = async (fn) => {
        setErr(null)
        setBusy(true)
        try {
          const result = await fn()
          if (result !== null && typeof result === 'object' && result.ok === true) {
            try { await api.reload() } catch { /* 配置刷新失败不影响 */ }
            return true
          }
          setErr(t('error', { error: (result && result.error && result.error.message) ? result.error.message : 'RPC failed' }))
          return false
        } catch (error) {
          setErr(String(error && error.message ? error.message : error))
          return false
        } finally {
          setBusy(false)
        }
      }

      if (action === 'renew') {
        // 续费确认:「是 + 确认」→ 续费重置(renewPlanCycle)后追问套餐是否变更
        const onYes = async () => {
          if (stage === 0) { setStage(1); return }
          const ok = await run(() => api.renewPlanCycle(key, false, 0, Date.now()))
          if (!ok) { setStage(0); return }
          pushLocal({
            id: localFrameId(),
            type: 'plan',
            atMs: Date.now(),
            sessionId: '',
            title: t('planChangedTitle'),
            summary: t('planChangedSummary'),
            tokens: { cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0 },
            total: 0, cost: 0, currency: '¥',
            key, provider: provider || null, model: (meta && meta.model) || null, goal: null,
            plan: { action: 'changed', key, provider: provider || null, model: (meta && meta.model) || null, atMs: Date.now() },
          })
          onClose(frame.id)
        }
        const onNo = async () => {
          if (stage === 0) { setStage(1); return }
          const ok = await run(() => api.dismissPlanPending(key, 0, Date.now()))
          if (!ok) { setStage(0); return }
          onClose(frame.id)
        }
        return el('div', { className: 'tn-plan-popup' },
          el('div', { className: 'tn-plan-meta' }, label.main, label.sub ? ' · ' + label.sub : ''),
          stage === 0
            ? el('div', { className: 'tn-plan-popup-actions' },
              el('button', { className: 'tn-btn', disabled: busy, onClick: () => { void onYes() } }, t('planRenewYes')),
              el('button', { className: 'tn-btn', disabled: busy, onClick: () => { void onNo() } }, t('planRenewNo')))
            : el('div', { className: 'tn-plan-popup-actions' },
              el('button', { className: 'tn-danger-btn', disabled: busy, onClick: () => { void onYes() } }, busy ? t('resetting') : t('planRenewConfirm')),
              el('button', { className: 'tn-btn', disabled: busy, onClick: () => { void onNo() } }, busy ? t('resetting') : t('planNoRenewConfirm'))),
          err ? el('div', { className: 'tn-err' }, err) : null)
      }
      if (action === 'changed') {
        // 套餐是否变更:是 → 设置 → Token Plan Key 管理(套餐订阅修改的地方)
        const onYes = () => {
          openPluginView('settings', key)
          onClose(frame.id)
        }
        return el('div', { className: 'tn-plan-popup' },
          el('div', { className: 'tn-plan-meta' }, label.main, label.sub ? ' · ' + label.sub : ''),
          el('div', { className: 'tn-plan-popup-actions' },
            el('button', { className: 'tn-btn', onClick: onYes }, t('planChangedYes')),
            el('button', { className: 'tn-btn', onClick: () => onClose(frame.id) }, t('planChangedNo'))),
          el('div', { className: 'tn-hint' }, t('planEditHint')))
      }
      // reset:需要重置 Token Plan 吗?→ 重置流程(验证码 + 两次确认)
      const startFlow = () => setFlow({ code: gen4(), input: '', stage: 0 })
      const confirmCode = () => {
        if (flow === null || flow.input !== flow.code) return
        setFlow({ ...flow, stage: 1 })
      }
      const doReset = async () => {
        const ok = await run(() => api.resetPlanCycle(key, 0, Date.now()))
        if (!ok) { setFlow({ ...flow, stage: 0 }); return }
        openPluginView('analysis', key)
        onClose(frame.id)
      }
      return el('div', { className: 'tn-plan-popup' },
        el('div', { className: 'tn-plan-meta' }, label.main, label.sub ? ' · ' + label.sub : ''),
        flow === null
          ? el('div', { className: 'tn-plan-popup-actions' },
            el('button', { className: 'tn-danger-btn', onClick: startFlow }, t('planResetNow')),
            el('button', { className: 'tn-btn', onClick: () => onClose(frame.id) }, t('planLater')))
          : el('div', { className: 'tn-plan-popup-actions' },
            el('span', { className: 'tn-hint' }, t('resetCycleHint'), ' ' + t('resetCodeLabel') + ': ', el('b', { className: 'tn-reset-code' }, flow.code)),
            el('input', {
              className: 'tn-input tn-num-input',
              type: 'number', min: 0, max: 9999, step: 1,
              placeholder: t('resetCodePlaceholder'),
              value: flow.input,
              onChange: (e) => { const v = e.target.value; setFlow((f) => (f === null ? f : { ...f, input: v.length > 4 ? v.slice(0, 4) : v })) },
            }),
            flow.stage === 0
              ? el('button', { className: 'tn-btn', disabled: flow.input !== flow.code, onClick: confirmCode }, t('resetConfirmA'))
              : el('button', { className: 'tn-danger-btn', disabled: busy, onClick: () => { void doReset() } }, busy ? t('resetting') : t('resetConfirmB')),
            flow.stage === 0
              ? el('button', { className: 'tn-btn', onClick: () => onClose(frame.id) }, t('resetCancel'))
              : null),
        err ? el('div', { className: 'tn-err' }, err) : null)
    }

    function PopupItem(props) {
      const { frame, seconds, onClose, api, providers, pushLocal } = props
      // 0.3.4:Token Plan 提示帧走独立交互弹窗
      if (frame.type === 'plan') {
        return React.createElement('div', { className: 'tn-popup plan' },
          React.createElement('div', { className: 'tn-popup-head' },
            React.createElement('div', { className: 'tn-popup-title' }, frame.title || ''),
            React.createElement('button', { className: 'tn-popup-close', onClick: () => onClose(frame.id), 'aria-label': t('close') }, '×')),
          React.createElement(PlanPopup, { frame, api, providers, pushLocal, onClose: () => onClose(frame.id) }))
      }
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
      const POPUP_KIND = { goal: 'goal', approval: 'approval', question: 'question' }
      const POPUP_TITLE = { goal: 'goalTitle', approval: 'approvalTitle', question: 'questionTitle' }
      const kind = POPUP_KIND[frame.type] || 'turn'
      // 0.3:turn/goal 帧的 title 由宿主带上金额;approval/question 回退到多语言标题
      const title = frame.title || t(POPUP_TITLE[frame.type] || 'popupTitle')
      // 只有 turn/goal 帧带 token 明细与 Key;approval/question 只显示摘要提醒。
      const usageFrame = frame.type === 'turn' || frame.type === 'goal'
      return el('div', { className: 'tn-popup ' + kind },
        el('div', { className: 'tn-popup-head' },
          el('div', { className: 'tn-popup-title' }, title),
          el('div', { className: 'tn-popup-count' }, fmt(left) + 's'),
          el('button', { className: 'tn-popup-close', onClick: () => onClose(frame.id), 'aria-label': t('close') }, '×')),
        el('div', { className: 'tn-popup-summary' }, frame.summary || ''),
        usageFrame
          ? el('div', { className: 'tn-popup-tokens' },
            el('span', { className: 'tn-popup-token' }, t('cacheIn'), el('b', { title: fmtExact(tokens.cacheIn) }, fmt(tokens.cacheIn))),
            el('span', { className: 'tn-popup-token' }, t('cacheOut'), el('b', { title: fmtExact(tokens.cacheOut) }, fmt(tokens.cacheOut))),
            el('span', { className: 'tn-popup-token' }, t('output'), el('b', { title: fmtExact(tokens.output) }, fmt(tokens.output))),
            el('span', { className: 'tn-popup-token' }, t('total'), el('b', { title: fmtExact(frame.total) }, fmt(frame.total))),
            typeof frame.cost === 'number' && frame.cost > 0
              ? el('span', { className: 'tn-popup-token' }, t('money'), el('b', { title: fmtExact(frame.cost) }, fmtMoney(frame.cost, frame.currency || '¥')))
              : null)
          : null,
        // 0.3.7 修复:显示该 Provider 的显示名(全局模型设置的自定义名称),而不是原始 env 标签
        usageFrame && (frame.provider || frame.key)
          ? el('div', { className: 'tn-popup-key' }, t('key') + ': ' + (providerDisplayOf(providers, frame.provider || frame.key) || frame.key))
          : null)
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
      const pushLocal = (frame) => {
        const cur = store.get()
        store.set({ ...cur, notifications: [...(cur.notifications || []), frame].slice(-20) })
      }
      const providers = (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : []
      if (notifications.length === 0) return null
      return React.createElement('div', { className: 'tn-popup-layer' },
        notifications.map((frame) => React.createElement(PopupItem, {
          key: frame.id, frame, seconds, onClose: dismiss,
          api: props.api, providers, pushLocal,
        })))
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

    /** 找最近的滚动容器(设置页内容区);找不到回退到窗口滚动元素。 */
    function findScroller(el) {
      let node = el && el.parentElement
      while (node && node !== document.body && node !== document.documentElement) {
        try {
          const oy = getComputedStyle(node).overflowY
          if (/(auto|scroll|overlay)/.test(oy) && node.scrollHeight > node.clientHeight + 40) return node
        } catch { /* ignore */ }
        node = node.parentElement
      }
      return document.scrollingElement || document.documentElement
    }

    // ── 价格工具(0.3.6 提升):价格编辑页与顶部横幅价格弹窗共用 ──────────────
    const PRICE_KEY_LIST = ['cacheIn', 'cacheOut', 'output', 'cacheWrite', 'reasoning']

    /** 提取合法价格字段(输入框字符串可入;空/非法值丢弃)。 */
    function cleanPrice(p) {
      const o = {}
      for (const k of PRICE_KEY_LIST) {
        const v = p && p[k]
        if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0) o[k] = Number(v)
      }
      return o
    }

    /** 官方价目录查询(与宿主 pricing-catalog.js 同逻辑)。 */
    function lookupClientModel(model, cat) {
      if (!model || typeof model !== 'string' || !cat) return null
      const m = model.trim().toLowerCase()
      for (const id of Object.keys(cat)) {
        const e = cat[id]
        if (id.toLowerCase() === m) return e
        if (Array.isArray(e.match) && e.match.some((a) => String(a).toLowerCase() === m)) return e
      }
      if (m.length >= 5) {
        for (const id of Object.keys(cat)) {
          if (id.length >= 5 && m.includes(id.toLowerCase())) return cat[id]
        }
      }
      return null
    }

    /** 取目录项在指定币种下的基础价(cny / usd)。 */
    function officialBaseOf(catEntry, currency) {
      if (catEntry === null || catEntry === undefined) return null
      return currency === '$' ? catEntry.usd : catEntry.cny
    }

    /**
     * 模型显示名索引(0.3.7 修复):来自全局模型设置的 Provider → 模型显示名,
     * 即目录条目 models[{ id, name }] 里的 name(用户在全局模型设置里给该模型
     * 配的显示名)。byProvider 精确到 (Provider ID, 模型 ID),byModel 为跨 Provider 兜底。
     */
    function modelNameIndexOf(providers) {
      const byProvider = new Map()
      const byModel = new Map()
      const list = Array.isArray(providers) ? providers : []
      for (const p of list) {
        if (p === null || typeof p !== 'object' || typeof p.id !== 'string' || p.id === '') continue
        const models = Array.isArray(p.models) ? p.models : []
        for (const m of models) {
          const id = typeof m === 'string' ? m : (m !== null && typeof m === 'object' && typeof m.id === 'string' ? m.id : '')
          const name = (m !== null && typeof m === 'object' && typeof m.name === 'string') ? m.name.trim() : ''
          if (id === '' || name === '') continue
          const key = p.id + '\u0000' + id
          if (!byProvider.has(key)) byProvider.set(key, name)
          if (!byModel.has(id)) byModel.set(id, name)
        }
      }
      return { byProvider, byModel }
    }

    /**
     * 模型显示名(0.3.7):全局模型设置里该 (Provider ID, 模型 ID) 的自定义显示名 →
     * 同一模型在别的 Provider 下的显示名 → 官方价格目录显示名 → 模型 ID 本身。
     */
    function modelDisplayName(model, catalog, names, providerId) {
      const id = typeof model === 'string' && model !== '' ? model : ''
      if (id !== '' && names !== null && names !== undefined) {
        const scoped = (typeof providerId === 'string' && providerId !== '')
          ? names.byProvider.get(providerId + '\u0000' + id)
          : undefined
        const hit = (typeof scoped === 'string' && scoped !== '') ? scoped : names.byModel.get(id)
        if (typeof hit === 'string' && hit !== '') return hit
      }
      const entry = (id !== '' && catalog) ? lookupClientModel(id, catalog) : null
      return (entry !== null && entry !== undefined && typeof entry.name === 'string' && entry.name !== '') ? entry.name : (id || 'unknown')
    }

    /** 已保存模型行查找(0.3.7 价格表不区分大小写):先精确键,再按小写匹配。 */
    function savedModelRow(pricing, model) {
      const models = (pricing !== null && pricing !== undefined && typeof pricing.models === 'object' && pricing.models !== null) ? pricing.models : null
      if (models === null || typeof model !== 'string' || model === '') return undefined
      if (models[model] !== undefined) return models[model]
      const target = model.toLowerCase()
      for (const k of Object.keys(models)) {
        if (typeof k === 'string' && k.toLowerCase() === target) return models[k]
      }
      return undefined
    }

    /** 价格输入网格:5 个价格字段(留空 = 继承上一层价格;disabled = 只读展示)。 */
    function PriceFields({ values, onChange, disabled }) {
      const el = React.createElement
      const FIELDS = [['cacheIn', 'cacheIn'], ['cacheOut', 'cacheOut'], ['output', 'output'], ['cacheWrite', 'cacheWrite'], ['reasoning', 'reasoning']]
      return el('div', { className: 'tn-price-grid' },
        FIELDS.map(([k, labelKey]) => el('label', { className: 'tn-price-field', key: k },
          el('span', null, t(labelKey)),
          el('input', {
            className: 'tn-input tn-num-input',
            type: 'number', min: 0, step: 'any',
            disabled: disabled === true,
            value: values && values[k] !== undefined && values[k] !== null ? String(values[k]) : '',
            placeholder: t('inheritPlaceholder'),
            onChange: (e) => onChange(k, e.target.value),
          }))))
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
      // 0.3.1:顶部导航栏切换「消耗统计 / 价格编辑 / 使用分析 / 设置」
      const [view, setView] = React.useState('stats')
      // 0.3.4:Token Plan 提示弹窗「进入重置页 / 修改套餐」→ 跨组件视图切换
      const [external, setExternal] = React.useState(null)
      // 0.3.8 保存机制:设置页草稿登记表(子视图经 onDirty(id, dirty, save) 注册)。
      // ① 有未保存更改 → 贴设置页内容区左缘浮现大号圆形保存按钮;② 切换选项卡自动保存;
      // ③ 带着更改直接退出设置页 → 询问是否保留,超时默认保留(自动保存)。
      const saveCtl = React.useRef(new Map())
      const [, bumpDirtyTick] = React.useReducer((v) => v + 1, 0)
      const onChildDirty = React.useCallback((id, dirty, save) => {
        const map = saveCtl.current
        const prev = map.get(id)
        if (prev) {
          prev.save = save
          if (prev.dirty === !!dirty) return
          prev.dirty = !!dirty
        } else {
          map.set(id, { dirty: !!dirty, save })
        }
        bumpDirtyTick()
      }, [])
      const hasDirtyDrafts = () => {
        for (const s of saveCtl.current.values()) if (s.dirty) return true
        return false
      }
      const saveAllDrafts = () => {
        for (const s of saveCtl.current.values()) {
          if (!s.dirty || typeof s.save !== 'function') continue
          Promise.resolve().then(s.save).catch((err) =>
            console.error('[dsh-task-notice] 自动保存失败: ' + String(err && err.message ? err.message : err)))
        }
      }
      // 切换选项卡:自动保存本页做出的设置变更(子视图草稿保存成功后自行清除标记)
      const switchView = (next) => {
        if (hasDirtyDrafts()) {
          saveAllDrafts()
          saveCtl.current.clear()
          bumpDirtyTick()
        }
        setView(next)
      }
      // 直接退出设置页(整节卸载):仍有未保存更改 → 询问是否保留,超时默认保留
      React.useEffect(() => {
        return () => {
          if (hasDirtyDrafts()) confirmKeepChanges(() => saveAllDrafts())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      React.useEffect(() => {
        const onOpen = (e) => {
          const detail = e && e.detail
          if (detail === null || typeof detail !== 'object' || typeof detail.view !== 'string') return
          switchView(detail.view)
          if (typeof detail.key === 'string' && detail.key !== '') setExternal({ key: detail.key, nonce: Date.now() })
        }
        window.addEventListener('dsh-task-notice:open-view', onOpen)
        return () => window.removeEventListener('dsh-task-notice:open-view', onOpen)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      // 清除账本后 +1,驱动统计 / 分析 / 价格编辑视图自动刷新
      const [clearVersion, setClearVersion] = React.useState(0)
      // 0.3.3:顶部导航 sticky 常驻页面顶部;往下滚动超过阈值后右侧出现回到顶部按钮
      const sectionRef = React.useRef(null)
      const [showTop, setShowTop] = React.useState(false)
      React.useEffect(() => {
        const root = sectionRef.current
        if (root === null) return
        const scroller = findScroller(root)
        const onScroll = () => {
          let top = 0
          try { top = scroller.scrollTop } catch { top = 0 }
          setShowTop(typeof top === 'number' ? top > 240 : false)
        }
        onScroll()
        scroller.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
          scroller.removeEventListener('scroll', onScroll)
          window.removeEventListener('scroll', onScroll)
        }
      }, [])
      // 0.3.8:悬浮保存按钮位置——贴着设置页内容区(卡片范围)左缘,随滚动/窗口变化跟随
      const [fabPos, setFabPos] = React.useState(null)
      React.useEffect(() => {
        const measure = () => {
          const root = sectionRef.current
          if (root === null || typeof root.getBoundingClientRect !== 'function') return
          try {
            const r = root.getBoundingClientRect()
            const vh = (typeof window !== 'undefined' && Number.isFinite(window.innerHeight)) ? window.innerHeight : 800
            setFabPos({
              left: Math.max(10, r.left - 66),
              top: Math.max(64, Math.min(r.top + 96, vh - 84)),
            })
          } catch { /* ignore */ }
        }
        measure()
        let fabScroller = null
        try { fabScroller = findScroller(sectionRef.current) } catch { fabScroller = null }
        if (fabScroller) fabScroller.addEventListener('scroll', measure, { passive: true })
        window.addEventListener('scroll', measure, { passive: true })
        window.addEventListener('resize', measure)
        return () => {
          if (fabScroller) fabScroller.removeEventListener('scroll', measure)
          window.removeEventListener('scroll', measure)
          window.removeEventListener('resize', measure)
        }
      }, [])
      const scrollToTop = () => {
        const root = sectionRef.current
        if (root === null) return
        try { findScroller(root).scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ignore */ }
      }


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

      // 清除记录数据后(设置页)自动重查统计
      React.useEffect(() => {
        if (clearVersion > 0) void load(rangeId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [clearVersion])

      // 价格/套餐/峰谷配置变化后(价格编辑页保存)立即按新价格重算金额
      const priceSignature = snap.config
        ? JSON.stringify([snap.config.pricing, snap.config.plans, snap.config.peak])
        : ''
      React.useEffect(() => {
        if (data.status === 'ready' && priceSignature !== '') void load(rangeId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [priceSignature])

      const health = snap.health
      const stats = data.stats
      const rows = (stats && Array.isArray(stats.keys)) ? stats.keys : []
      const catalog = snap.catalog // 0.3.7:模型显示名来源(全局模型设置优先,官方目录兜底)
      const modelNames = modelNameIndexOf(snap.config && snap.config.providers)
      // 跨 Key 的按模型总览:把每个 Key 行内的 models 明细按「模型名」聚合为一行,
      // 与价格编辑页「同一模型只有一行价格」、使用分析饼图的口径保持一致:
      // 同一模型名无论出现在哪个 Key / 提供商下都合并展示,不同版本(不同模型名)
      // 各占一行(价格互不影响)。按 Key 表仍严格按 Key 归集该 Key 自己的模型明细。
      const modelMap = new Map()
      for (const row of rows) {
        const models = Array.isArray(row.models) ? row.models : []
        for (const m of models) {
          const name = (m && typeof m.model === 'string' && m.model !== '') ? m.model : 'unknown'
          let agg = modelMap.get(name)
          if (agg === undefined) {
            agg = { label: name, model: name, calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, cost: 0 }
            modelMap.set(name, agg)
          }
          agg.calls += m.calls
          agg.cacheIn += m.cacheIn
          agg.cacheOut += m.cacheOut
          agg.output += m.output
          agg.cacheWrite += m.cacheWrite
          agg.reasoning += m.reasoning
          agg.cost += m.cost || 0
        }
      }
      const modelRows = [...modelMap.values()].sort((a, b) =>
        (b.cacheIn + b.cacheOut + b.output + b.cacheWrite + b.reasoning) - (a.cacheIn + a.cacheOut + a.output + a.cacheWrite + a.reasoning))

      const currency = (snap.config && snap.config.pricing && snap.config.pricing.currency) === '$' ? '$' : '¥'

      return el('div', { className: 'tn-section', ref: sectionRef },
        // 顶部导航栏(0.3.3 顺序):今日消耗 ⇄ 消耗统计 ⇄ 使用分析 ⇄ 价格编辑 ⇄ 设置
        el('div', { className: 'tn-tabs' },
          el('button', { className: 'tn-tab' + (view === 'today' ? ' active' : ''), onClick: () => switchView('today') }, t('todayTab')),
          el('button', { className: 'tn-tab' + (view === 'stats' ? ' active' : ''), onClick: () => switchView('stats') }, t('usageStatsTab')),
          el('button', { className: 'tn-tab' + (view === 'analysis' ? ' active' : ''), onClick: () => switchView('analysis') }, t('analysisTab')),
          el('button', { className: 'tn-tab' + (view === 'pricing' ? ' active' : ''), onClick: () => switchView('pricing') }, t('pricePageTitle')),
          el('button', { className: 'tn-tab' + (view === 'settings' ? ' active' : ''), onClick: () => switchView('settings') }, t('settingsTab'))),
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

        // 0.3.8:悬浮保存按钮 —— 有未保存更改时贴设置页内容区左缘浮现(保存图标)
        hasDirtyDrafts() && fabPos
          ? el('button', { className: 'tn-save-fab', style: { left: fabPos.left + 'px', top: fabPos.top + 'px' }, title: t('saveFab'), 'aria-label': t('saveFab'), onClick: () => { saveAllDrafts() } },
            el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
              el('path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z' }),
              el('polyline', { points: '17 21 17 13 7 13 7 21' }),
              el('polyline', { points: '7 3 7 8 15 8' })))
          : null,

        view === 'today'
          ? el(TodaySection, { hooks: props.hooks, api, clearVersion })
          : view === 'pricing'
            ? el(PricingSection, { hooks: props.hooks, api, clearVersion, onDirty: onChildDirty })
            : view === 'analysis'
              ? el(AnalysisSection, { hooks: props.hooks, api, clearVersion, externalReset: external })
              : view === 'settings'
              ? el(SettingsSection, { hooks: props.hooks, api, onCleared: () => setClearVersion((v) => v + 1), onDirty: onChildDirty })
              : el('div', { className: 'tn-stats-body' },
        // 汇总卡片
        el('div', { className: 'tn-cards' },
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('statTokens')),
            el('div', { className: 'tn-card-value' }, stats ? num(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('statCalls')),
            el('div', { className: 'tn-card-value' }, stats ? num(stats.calls) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('cacheIn')),
            el('div', { className: 'tn-card-value' }, stats ? num(stats.totals.cacheIn) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('cacheOut')),
            el('div', { className: 'tn-card-value' }, stats ? num(stats.totals.cacheOut) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('output')),
            el('div', { className: 'tn-card-value' }, stats ? num(stats.totals.output) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('costChip')),
            el('div', { className: 'tn-card-value' }, stats ? money(stats.totals.cost, currency) : '—'))),

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
                  el('th', { className: 'num' }, t('total')),
                  el('th', { className: 'num' }, t('money')))),
              el('tbody', null,
                rows.map((row) => {
                  const total = row.cacheIn + row.cacheOut + row.output + row.cacheWrite + row.reasoning
                  const label = providerRowLabel(row, (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : [])
                  return el('tr', { key: row.key },
                    el('td', null,
                      el('div', null, label.main),
                      label.sub ? el('div', { className: 'tn-model-row' }, label.sub) : null,
                      el('details', null,
                        el('summary', null, t('modelsTitle')),
                        (Array.isArray(row.models) ? row.models : []).map((m) =>
                          el('div', { className: 'tn-model-row', key: m.model }, el('span', { title: m.model }, modelDisplayName(m.model, catalog, modelNames, m.provider || row.key)), ': ' + fmt(m.calls) + ' ' + t('calls') + ' · ' + t('cacheIn') + ' ' + fmt(m.cacheIn) + ' · ' + t('cacheOut') + ' ' + fmt(m.cacheOut) + ' · ' + t('output') + ' ' + fmt(m.output))))),
                    el('td', null, row.keyEnv || row.provider || '—'),
                    el('td', { className: 'num', title: fmtExact(row.calls) }, fmt(row.calls)),
                    el('td', { className: 'num', title: fmtExact(row.cacheIn) }, fmt(row.cacheIn)),
                    el('td', { className: 'num', title: fmtExact(row.cacheOut) }, fmt(row.cacheOut)),
                    el('td', { className: 'num', title: fmtExact(row.output) }, fmt(row.output)),
                    el('td', { className: 'num', title: fmtExact(total) }, fmt(total)),
                    el('td', { className: 'num', title: fmtExact(row.cost) }, fmtMoney(row.cost, currency)))
                }),
                el('tr', { className: 'tn-row-total' },
                  el('td', null, t('total')),
                  el('td', null, ''),
                  el('td', { className: 'num', title: fmtExact(stats.calls) }, fmt(stats.calls)),
                  el('td', { className: 'num', title: fmtExact(stats.totals.cacheIn) }, fmt(stats.totals.cacheIn)),
                  el('td', { className: 'num', title: fmtExact(stats.totals.cacheOut) }, fmt(stats.totals.cacheOut)),
                  el('td', { className: 'num', title: fmtExact(stats.totals.output) }, fmt(stats.totals.output)),
                  el('td', { className: 'num', title: fmtExact(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning) }, fmt(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning)),
                  el('td', { className: 'num', title: fmtExact(stats.totals.cost) }, fmtMoney(stats.totals.cost, currency))))))
          : null,
        // 按模型消耗总览(跨 Key 聚合)
        data.status === 'ready' && modelRows.length > 0
          ? el('div', { className: 'tn-table-wrap', style: { marginTop: '6px' } },
            el('div', { className: 'tn-subhead' }, t('modelUsageTitle')),
            el('p', { className: 'tn-price-note' }, t('modelOverviewNote')),
            el('table', { className: 'tn-table' },
              el('thead', null,
                el('tr', null,
                  el('th', null, t('modelColumn')),
                  el('th', { className: 'num' }, t('calls')),
                  el('th', { className: 'num' }, t('cacheIn')),
                  el('th', { className: 'num' }, t('cacheOut')),
                  el('th', { className: 'num' }, t('output')),
                  el('th', { className: 'num' }, t('total')),
                  el('th', { className: 'num' }, t('money')))),
              el('tbody', null,
                modelRows.map((m) => el('tr', { key: m.label },
                  el('td', null, el('span', { title: m.model }, modelDisplayName(m.model, catalog, modelNames))),
                  el('td', { className: 'num', title: fmtExact(m.calls) }, fmt(m.calls)),
                  el('td', { className: 'num', title: fmtExact(m.cacheIn) }, fmt(m.cacheIn)),
                  el('td', { className: 'num', title: fmtExact(m.cacheOut) }, fmt(m.cacheOut)),
                  el('td', { className: 'num', title: fmtExact(m.output) }, fmt(m.output)),
                  el('td', { className: 'num', title: fmtExact(m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning) }, fmt(m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning)),
                  el('td', { className: 'num', title: fmtExact(m.cost) }, fmtMoney(m.cost, currency)))),
                el('tr', { className: 'tn-row-total' },
                  el('td', null, t('total')),
                  el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.calls, 0)) }, fmt(modelRows.reduce((a, m) => a + m.calls, 0))),
                  el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.cacheIn, 0)) }, fmt(modelRows.reduce((a, m) => a + m.cacheIn, 0))),
                  el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.cacheOut, 0)) }, fmt(modelRows.reduce((a, m) => a + m.cacheOut, 0))),
                  el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.output, 0)) }, fmt(modelRows.reduce((a, m) => a + m.output, 0))),
                  el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning, 0)) }, fmt(modelRows.reduce((a, m) => a + m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning, 0))),
                  el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + (m.cost || 0), 0)) }, fmtMoney(modelRows.reduce((a, m) => a + (m.cost || 0), 0), currency))))))
          : null,
        el('p', { className: 'tn-note' }, t('note')),
        showTop
          ? el('button', { className: 'tn-top-btn', onClick: () => scrollToTop(), title: t('backToTop'), 'aria-label': t('backToTop') },
            el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
              el('path', { d: 'M12 19V5' }),
              el('path', { d: 'M5 12l7-7 7 7' })))
          : null)
        )
    }

    // ── 设置视图(0.3.1):顶部导航「设置」选项卡 ─────────────────────────────
    // 原「消耗统计」视图中的插件配置项移至此处;另含「清除记录数据」:
    // 滑条拖到底 → 输入随机 8 位验证码 → 连续点击两次确认,才真正清空账本。
    // 0.3.2:设置页新增 Token Plan Key 管理(取代价格编辑-Token订阅)+ Provider ID 管理。

    // 从 snap.config.providers 提取 provider 显示名(目录兜底)
    function providerDisplayOf(providers, key) {
      const list = Array.isArray(providers) ? providers : []
      const hit = list.find((p) => p && p.id === key && typeof p.displayName === 'string' && p.displayName !== '')
      return hit ? hit.displayName : (key || '')
    }

    // 归一化 plans 为可保存结构(周期字段保留,与服务端 normalizePlans 一致)
    function sanitizePlansWire(plans) {
      const out = {}
      for (const k of Object.keys(plans || {})) {
        const v = plans[k]
        if (!v || typeof v !== 'object') continue
        const prev = (v.prevCycle && typeof v.prevCycle === 'object')
          ? {
            start: Number(v.prevCycle.start) > 0 ? Number(v.prevCycle.start) : 0,
            end: Number(v.prevCycle.end) > 0 ? Number(v.prevCycle.end) : 0,
            fee: Number(v.prevCycle.fee) > 0 ? Number(v.prevCycle.fee) : 0,
            tokens: Number(v.prevCycle.tokens) > 0 ? Number(v.prevCycle.tokens) : 0,
            cost: Number(v.prevCycle.cost) > 0 ? Number(v.prevCycle.cost) : 0,
          }
          : null
        const periodDays = Number(v.periodDays)
        out[k] = {
          enabled: v.enabled === true,
          fee: Number(v.fee) > 0 ? Number(v.fee) : 0,
          credits: Number(v.credits) > 0 ? Number(v.credits) : 0,
          startAt: Number(v.startAt) > 0 ? Number(v.startAt) : 0,
          periodDays: Number.isFinite(periodDays) && periodDays > 0 ? Math.min(3650, Math.round(periodDays)) : 31,
          resetMode: v.resetMode === 'monthly' ? 'monthly' : 'days',
          cycleStart: Number(v.cycleStart) > 0 ? Number(v.cycleStart) : 0,
          cycleEnd: Number(v.cycleEnd) > 0 ? Number(v.cycleEnd) : 0,
          prevCycle: prev,
        }
        // 0.3.4:周期 TID / 冻结历史 / 待确认 / 撤回快照原样保留(内部身份不向用户显示)
        if (typeof v.tid === 'string' && v.tid !== '') out[k].tid = v.tid
        if (v.cycles && typeof v.cycles === 'object' && !Array.isArray(v.cycles)) {
          const cycles = {}
          for (const tid of Object.keys(v.cycles)) {
            const c = v.cycles[tid]
            if (!c || typeof c !== 'object') continue
            cycles[tid] = {
              start: Number(c.start) > 0 ? Number(c.start) : 0,
              end: Number(c.end) > 0 ? Number(c.end) : 0,
              fee: Number(c.fee) > 0 ? Number(c.fee) : 0,
              tokens: Number(c.tokens) > 0 ? Number(c.tokens) : 0,
              cost: Number(c.cost) > 0 ? Number(c.cost) : 0,
            }
          }
          if (Object.keys(cycles).length > 0) out[k].cycles = cycles
        }
        if (v.pending && typeof v.pending === 'object' && Number(v.pending.at) > 0) out[k].pending = { at: Number(v.pending.at) }
        if (v._undo && typeof v._undo === 'object') {
          const undo = {
            cycleStart: Number(v._undo.cycleStart) > 0 ? Number(v._undo.cycleStart) : 0,
            cycleEnd: Number(v._undo.cycleEnd) > 0 ? Number(v._undo.cycleEnd) : 0,
            prevCycle: null,
          }
          if (v._undo.prevCycle && typeof v._undo.prevCycle === 'object') {
            undo.prevCycle = {
              start: Number(v._undo.prevCycle.start) > 0 ? Number(v._undo.prevCycle.start) : 0,
              end: Number(v._undo.prevCycle.end) > 0 ? Number(v._undo.prevCycle.end) : 0,
              fee: Number(v._undo.prevCycle.fee) > 0 ? Number(v._undo.prevCycle.fee) : 0,
              tokens: Number(v._undo.prevCycle.tokens) > 0 ? Number(v._undo.prevCycle.tokens) : 0,
              cost: Number(v._undo.prevCycle.cost) > 0 ? Number(v._undo.prevCycle.cost) : 0,
            }
          }
          if (typeof v._undo.tid === 'string' && v._undo.tid !== '') undo.tid = v._undo.tid
          out[k]._undo = undo
        }
      }
      return out
    }

    /** 深度拷贝 plans / providers 的纯净对象 */
    function deepClone(v) {
      try { return JSON.parse(JSON.stringify(v === undefined ? null : v)) } catch { return (v === undefined ? null : v) }
    }

    // Token Plan Key 管理(0.3.2):管理所有 Key(Provider)的 Token Plan 设置,
    // 删除该 Key 原有的 Token plan 属性;取代原「价格编辑-Token订阅」。
    function TokenPlanKeyManageSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [draft, setDraft] = React.useState(null) // { plans }
      const [enumData, setEnumData] = React.useState(null) // 全量消耗(进度/换算)
      const [dir, setDir] = React.useState(null) // Provider 目录
      const [savedMsg, setSavedMsg] = React.useState(false)
      const [convertResult, setConvertResult] = React.useState({})

      const load = React.useCallback(() => {
        let alive = true
        api.getUsageStats(0, Date.now()).then((res) => {
          if (!alive) return
          if (res && typeof res === 'object' && res.ok === true && res.value) setEnumData(res.value)
        }).catch(() => { /* 账目不可用仅影响进度显示 */ })
        if (typeof api.hasProviderDirectory === 'function' && api.hasProviderDirectory()) {
          api.getProviderDirectory().then((value) => {
            if (!alive) return
            if (value && Array.isArray(value.list)) setDir(value.list)
          }).catch(() => { /* 目录不可用时回退 config.providers */ })
        }
        return () => { alive = false }
      }, [api, props.refreshKey || 0])
      React.useEffect(load, [load])

      const cfgPlans = (snap.config && snap.config.plans) || {}
      const planDraft = draft ? draft.plans : cfgPlans
      const basePlans = snap.config && snap.config.plans
      const patchPlans = (mutate) => {
        setDraft((prev) => {
          const base = prev ? { plans: deepClone(prev.plans) } : { plans: deepClone(basePlans || {}) }
          mutate(base)
          return base
        })
      }

      // Key 行身份 = Provider ID(目录 ∪ 消耗记录 ∪ 已有计划键)
      const providersCfg = (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : []
      const dirList = dir || providersCfg
      const keySet = new Set()
      for (const p of dirList) if (p && typeof p.id === 'string' && p.id !== '') keySet.add(p.id)
      for (const row of (Array.isArray(enumData && enumData.keys) ? enumData.keys : [])) if (row && typeof row.key === 'string' && row.key !== '') keySet.add(row.key)
      for (const k of Object.keys(cfgPlans)) if (k !== '') keySet.add(k)
      const keys = [...keySet].sort((a, b) => {
        const na = providerDisplayOf(dirList, a)
        const nb = providerDisplayOf(dirList, b)
        return na.localeCompare(nb) || a.localeCompare(b)
      })
      const usageRowOf = new Map((Array.isArray(enumData && enumData.keys) ? enumData.keys : []).map((r) => [r.key, r]))
      const currency = (snap.config && snap.config.pricing && snap.config.pricing.currency) === '$' ? '$' : '¥'

      const onSavePlans = async () => {
        try {
          await api.updateConfig({ plans: sanitizePlansWire(planDraft) })
          setDraft(null)
          setSavedMsg(true)
          window.setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
          console.error('[dsh-task-notice] Token Plan 保存失败: ' + String(err && err.message ? err.message : err))
        }
      }
      // 0.3.8:向设置页容器登记 Token Plan 草稿(悬浮保存按钮 / 切换选项卡 / 退出确认共用)
      React.useEffect(() => {
        if (typeof props.onDirty === 'function') props.onDirty('plans', draft !== null, onSavePlans)
      })
      const onDeletePlanAttr = async (key) => {
        const label = providerDisplayOf(dirList, key)
        if (!window.confirm(t('planAttrDeleteConfirm', { key: label }))) return
        try {
          const next = { ...cfgPlans }
          delete next[key]
          await api.updateConfig({ plans: sanitizePlansWire(next) })
          setDraft(null)
          setSavedMsg(true)
          window.setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
          console.error('[dsh-task-notice] Token Plan 属性删除失败: ' + String(err && err.message ? err.message : err))
        }
      }
      const onConvert = (key) => {
        const plan = planDraft && planDraft[key]
        const credits = plan ? Number(plan.credits) : 0
        const row = usageRowOf.get(key)
        if (!row || !(credits > 0)) return
        const tokens = row.cacheIn + row.cacheOut + row.output + row.cacheWrite + row.reasoning
        setConvertResult((prev) => ({ ...prev, [key]: Math.round(tokens / credits) }))
      }

      return el('div', { className: 'tn-settings-block' },
        el('div', { className: 'tn-subhead' }, t('tokenPlanKeyManageTitle')),
        el('p', { className: 'tn-price-note' }, t('tokenPlanKeyManageHint')),
        keys.length === 0
          ? el('p', { className: 'tn-empty' }, t('noKeysHint'))
          : el('div', { className: 'tn-cards' },
            keys.map((key) => {
              const plan = planDraft[key]
              const fee = plan ? Number(plan.fee) : 0
              const credits = plan ? Number(plan.credits) : 0
              const usage = usageRowOf.get(key)
              const cost = usage ? usage.cost : 0
              const brokenEven = !!(plan && plan.enabled && fee > 0 && cost >= fee)
              const pct = (plan && plan.enabled && fee > 0) ? Math.min(100, Math.max(0, (cost / fee) * 100)) : 0
              const dirHit = (Array.isArray(dirList) ? dirList : []).find((p) => p && p.id === key)
              const label = providerRowLabel({ key, provider: key, providerName: providerDisplayOf(dirList, key), keyEnv: dirHit && dirHit.keyEnv ? dirHit.keyEnv : '' }, dirList)
              return el('div', { className: 'tn-card', key },
                el('div', { className: 'tn-plan-head' },
                  el('span', { className: 'tn-plan-key' }, label.main),
                  label.sub ? el('span', { className: 'tn-plan-meta' }, label.sub) : null),
                el('div', { className: 'tn-plan-row', style: { marginTop: '4px' } },
                  el('label', { className: 'tn-check' },
                    el('input', { type: 'checkbox', checked: !!(plan && plan.enabled), onChange: (e) => patchPlans((b) => {
                      if (!b.plans[key]) b.plans[key] = { enabled: false, fee: 0, credits: 0, startAt: 0, periodDays: 31, resetMode: 'days' }
                      const target = b.plans[key]
                      target.enabled = e.target.checked
                      if (e.target.checked && !(target.startAt > 0)) target.startAt = Date.now()
                      if (e.target.checked && !(target.periodDays > 0)) target.periodDays = 31
                      if (e.target.checked && target.resetMode !== 'monthly') target.resetMode = 'days'
                    }) }),
                    el('span', null, t('planToggle') + ' — ' + t('planToggleDesc')))),
                plan && plan.enabled
                  ? el('div', null,
                    el('div', { className: 'tn-plan-row' },
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planFee')),
                        el('input', { className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any', value: plan.fee !== undefined && plan.fee !== null && plan.fee !== '' ? String(plan.fee) : '', placeholder: '0', onChange: (e) => patchPlans((b) => { b.plans[key].fee = e.target.value }) })),
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planCredits')),
                        el('input', { className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any', value: plan.credits !== undefined && plan.credits !== null && plan.credits !== '' ? String(plan.credits) : '', placeholder: '0', onChange: (e) => patchPlans((b) => { b.plans[key].credits = e.target.value }) }))),
                    el('div', { className: 'tn-plan-row', style: { marginTop: '6px' } },
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planStartAtLabel')),
                        el('input', {
                          className: 'tn-input tn-num-input',
                          type: 'datetime-local',
                          value: plan.startAt > 0 ? localInputValue(new Date(plan.startAt)) : localInputValue(new Date()),
                          onChange: (e) => patchPlans((b) => {
                            const v = new Date(e.target.value).getTime()
                            b.plans[key].startAt = Number.isFinite(v) ? v : Date.now()
                          }),
                        })),
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planValidityLabel')),
                        el('input', {
                          className: 'tn-input tn-num-input',
                          type: 'number', min: 1, max: 3650, step: 1,
                          value: plan.periodDays !== undefined && plan.periodDays !== null && plan.periodDays !== '' ? String(plan.periodDays) : '31',
                          disabled: plan.resetMode === 'monthly',
                          onChange: (e) => patchPlans((b) => { b.plans[key].periodDays = e.target.value }),
                        })),
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planResetModeLabel')),
                        el('select', {
                          className: 'tn-input',
                          value: plan.resetMode === 'monthly' ? 'monthly' : 'days',
                          onChange: (e) => patchPlans((b) => { b.plans[key].resetMode = e.target.value }),
                        },
                          el('option', { value: 'days' }, t('planResetModeDays')),
                          el('option', { value: 'monthly' }, t('planResetModeMonthly'))))))
                  : null,
                plan && plan.enabled && fee > 0
                  ? el('div', { className: 'tn-plan-row', style: { marginTop: '4px' } },
                    el('span', { className: 'tn-card-label', style: { margin: 0 } }, t('breakevenTitle')),
                    el('span', { className: 'tn-plan-badge ' + (brokenEven ? 'ok' : 'warn') }, brokenEven ? t('brokenEven') : t('notBrokenEven')),
                    el('span', { className: 'tn-plan-bar' },
                      el('div', { className: 'tn-plan-fill' + (pct >= 100 ? ' over' : ''), style: { width: pct + '%' } })),
                    el('span', { className: 'tn-price-hint' }, t('planProgress', { used: fmtMoney(cost, currency), fee: fmtMoney(fee, currency) })))
                  : null,
                plan && plan.enabled && credits > 0
                  ? el('div', { className: 'tn-plan-row', style: { marginTop: '4px' } },
                    el('button', { className: 'tn-btn', onClick: () => onConvert(key) }, t('planConvert')),
                    convertResult[key] !== undefined
                      ? el('span', { className: 'tn-saved' }, t('convertResult', { tokens: fmt(convertResult[key]) }))
                      : null,
                    el('span', { className: 'tn-price-hint' }, t('convertHint', { tokens: fmt(usage ? usage.cacheIn + usage.cacheOut + usage.output + usage.cacheWrite + usage.reasoning : 0), credits: fmt(credits) })))
                  : null,
                plan
                  ? el('div', { className: 'tn-plan-actions', style: { marginTop: '4px' } },
                    el('button', { className: 'tn-danger-btn', onClick: () => { void onDeletePlanAttr(key) } }, t('planAttrDelete')))
                  : null)
            })),
        el('div', { className: 'tn-save-row' },
          el('button', { className: 'tn-btn', onClick: () => { void onSavePlans() } }, t('savePlans')),
          savedMsg ? el('span', { className: 'tn-saved' }, t('savedOk')) : null))
    }

    // Provider ID 管理(0.3.2):目录行(显示名 + keyEnv + 所含模型);重置 =
    // 从全局设置 + 账本重新抓取;删除失效 Provider ID(同时删除其 Token Plan)。
    function ProviderIdManageSection(props) {
      const api = props.api
      const snap = useStore(props.hooks.taskNotice)
      const el = React.createElement
      const [dir, setDir] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [msg, setMsg] = React.useState(null)
      const [err, setErr] = React.useState(null)
      const available = typeof api.hasProviderDirectory === 'function' ? api.hasProviderDirectory() : false

      const refresh = React.useCallback(async (silent) => {
        if (!available) return
        if (!silent) setBusy(true)
        setErr(null)
        try {
          const value = await api.getProviderDirectory()
          if (value && Array.isArray(value.list)) setDir(value.list)
        } catch (error) {
          setErr(String(error && error.message ? error.message : error))
        } finally {
          if (!silent) setBusy(false)
        }
      }, [api, available])
      React.useEffect(() => { if (available) void refresh(true) }, [available, refresh, props.refreshKey || 0])

      const onReset = async () => {
        if (!available) return
        setBusy(true)
        setErr(null)
        setMsg(null)
        try {
          const value = await api.refreshProviderDirectory()
          if (value && Array.isArray(value.list)) {
            setDir(value.list)
            setMsg(t('providerResetOk', { count: value.list.length }))
            try { await api.reload() } catch { /* 目录已在本地,config 同步失败不影响 */ }
          }
        } catch (error) {
          setErr(String(error && error.message ? error.message : error))
        } finally {
          setBusy(false)
        }
      }
      const onDelete = async (id) => {
        const label = providerDisplayOf(dir, id)
        if (!window.confirm(t('providerDeleteConfirm', { id: label || id }))) return
        setErr(null)
        setMsg(null)
        try {
          const value = await api.deleteProviderId(id)
          if (value && Array.isArray(value.list)) {
            setDir(value.list)
            setMsg(t('providerDeleted', { id: label || id }))
            try { await api.reload() } catch { /* ignore */ }
          }
        } catch (error) {
          setErr(String(error && error.message ? error.message : error))
        }
      }

      const list = dir || ((snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : [])
      // 所含模型:显示名(模型 ID)——目录条目 models = [{ id, name }],兼容旧字符串数组
      const modelLabels = (p) => (Array.isArray(p.models) ? p.models : []).map((m) => {
        if (typeof m === 'string') return m
        if (m === null || typeof m !== 'object') return ''
        const id = typeof m.id === 'string' ? m.id : ''
        const name = typeof m.name === 'string' ? m.name.trim() : ''
        return name !== '' ? name + '(' + id + ')' : id
      }).filter((s) => s !== '')
      const rows = list.map((p) => {
        const labels = modelLabels(p)
        return el('tr', { key: p.id },
          el('td', null, p.id),
          el('td', null, p.displayName || p.id),
          el('td', null, p.keyEnv || '—'),
          el('td', null, labels.length > 0 ? fmt(labels.length) + ' · ' + labels.slice(0, 6).join(', ') + (labels.length > 6 ? '…' : '') : t('modelsNone')),
          el('td', null,
            el('button', { className: 'tn-danger-btn', onClick: () => { void onDelete(p.id) } }, t('providerDelete'))))
      })
      return el('div', { className: 'tn-settings-block' },
        el('div', { className: 'tn-subhead' }, t('providerIdManageTitle')),
        el('p', { className: 'tn-price-note' }, t('providerIdManageHint')),
        !available
          ? el('p', { className: 'tn-empty' }, t('providerEmpty'))
          : el('div', { className: 'tn-save-row', style: { marginBottom: '6px' } },
            el('button', { className: 'tn-btn', disabled: busy, onClick: () => { void onReset() } }, busy ? t('providerResetting') : t('providerReset'))),
        err ? el('div', { className: 'tn-err' }, t('error', { error: err })) : null,
        msg ? el('div', { className: 'tn-saved' }, msg) : null,
        list.length === 0
          ? el('p', { className: 'tn-empty' }, t('providerEmpty'))
          : el('div', { className: 'tn-table-wrap' },
            el('table', { className: 'tn-table' },
              el('thead', null,
                el('tr', null,
                  el('th', null, t('providerIdLabel')),
                  el('th', null, t('providerNameColumn')),
                  el('th', null, t('providerKeyEnvColumn')),
                  el('th', null, t('providerModelsColumn')),
                  el('th', null, ''))),
              el('tbody', null, rows))),
        el('p', { className: 'tn-note' }, t('providerFirstRun')))
    }

    function SettingsSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [perm, setPerm] = React.useState(notifyState)
      const [cfgErr, setCfgErr] = React.useState(null)
      // 清除记录数据流程:图形验证码拖动滑块(captchaValue 0..100,拖到底 = 验证通过);
      // clearCode = 随机 8 位验证码;clearInput = 用户输入;clearStage = 0 未确认 / 1 第一次确认
      const [captchaValue, setCaptchaValue] = React.useState(0)
      const [captchaSpan, setCaptchaSpan] = React.useState(0)
      const [captchaArmed, setCaptchaArmed] = React.useState(false)
      const [clearCode, setClearCode] = React.useState('')
      const [clearInput, setClearInput] = React.useState('')
      const [clearStage, setClearStage] = React.useState(0)
      const [clearBusy, setClearBusy] = React.useState(false)
      const [clearMsg, setClearMsg] = React.useState(null)
      const [clearErr, setClearErr] = React.useState(null)
      const dragRef = React.useRef(null)
      const CAPTCHA_KNOB = 46
      // 宿主是否已暴露 clearUsage(未重启 DSH 时旧进程的 remote 没有该方法)
      const [clearAvailable] = React.useState(() => (typeof api.hasClearUsage === 'function' ? api.hasClearUsage() : false))

      const genCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
        let s = ''
        for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
        return s
      }

      // 授权并开启浏览器系统通知(必须由点击按钮这一用户手势触发)
      const onGrantNotify = React.useCallback(async () => {
        const state = await requestNotifyPermission()
        setPerm(state)
        if (state === 'granted') {
          // 0.3.8:随草稿统一保存(与设置页其他更改一致的保存机制)
          patchCfg('webNotify', true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [api])

      const beginDrag = (e) => {
        if (!clearAvailable || captchaArmed || clearBusy) return
        const track = e.currentTarget
        if (track === null || typeof track.getBoundingClientRect !== 'function') return
        const rect = track.getBoundingClientRect()
        setCaptchaSpan(Math.max(1, rect.width - CAPTCHA_KNOB))
        dragRef.current = { rect }
        if (typeof track.setPointerCapture === 'function') {
          try { track.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        }
        setClearErr(null)
        setClearMsg(null)
        if (typeof e.preventDefault === 'function') e.preventDefault()
      }

      const moveDrag = (e) => {
        const d = dragRef.current
        if (d === null || d === undefined || d.rect === undefined) return
        const span = Math.max(1, d.rect.width - CAPTCHA_KNOB)
        const x = Math.max(0, Math.min(d.rect.width, e.clientX - d.rect.left - CAPTCHA_KNOB / 2))
        setCaptchaValue(Math.round((x / span) * 100))
      }

      const endDrag = (e) => {
        const d = dragRef.current
        if (d === null || d === undefined) return
        dragRef.current = null
        const span = Math.max(1, d.rect.width - CAPTCHA_KNOB)
        const x = Math.max(0, Math.min(d.rect.width, (typeof e.clientX === 'number' ? e.clientX : d.rect.left) - d.rect.left - CAPTCHA_KNOB / 2))
        if (Math.round((x / span) * 100) >= 97) {
          // 拖到底 → 验证通过(锁定绿色),进入输码确认阶段
          setCaptchaArmed(true)
          setCaptchaValue(100)
          if (clearCode === '') setClearCode(genCode())
        } else {
          setCaptchaValue(0)
        }
      }

      const onConfirm = async () => {
        setClearErr(null)
        setClearMsg(null)
        if (!clearAvailable) { setClearErr(t('clearHostUnavailable')); return }
        if (!captchaArmed) { setClearErr(t('clearSlideFirst')); return }
        if (clearInput !== clearCode) { setClearErr(t('clearCodeMismatch')); return }
        if (clearStage === 0) { setClearStage(1); return }
        // 第二次确认 → 真正清除
        setClearBusy(true)
        try {
          const value = await api.clearUsage()
          const count = (value && typeof value.cleared === 'number') ? value.cleared : 0
          setClearStage(0)
          setClearInput('')
          setClearCode('')
          setCaptchaArmed(false)
          setCaptchaValue(0)
          setCaptchaSpan(0)
          setClearMsg(t('clearedOk', { count }))
          if (typeof props.onCleared === 'function') props.onCleared()
        } catch (error) {
          setClearStage(1)
          setClearErr(String(error && error.message ? error.message : error))
        } finally {
          setClearBusy(false)
        }
      }

      // 0.3.8:插件配置改为草稿模式——更改先写入本地草稿(界面即时按草稿值显示),
      // 经悬浮保存按钮 / 切换选项卡 / 退出确认统一保存,不再逐项立即 updateConfig
      const [cfgDraft, setCfgDraft] = React.useState(null)
      const cfg = { ...(snap.config || {}), ...(cfgDraft || {}) }
      const patchCfg = (key, value) => setCfgDraft((prev) => ({ ...(prev || {}), [key]: value }))
      const savePluginConfig = async () => {
        if (cfgDraft === null) return
        const payload = cfgDraft
        try {
          await api.updateConfig(payload)
          setCfgDraft(null)
        } catch (err) {
          setCfgErr(String(err && err.message ? err.message : err))
        }
      }
      // 0.3.8:向设置页容器登记草稿状态与保存函数(每次渲染保持最新闭包)
      React.useEffect(() => {
        if (typeof props.onDirty === 'function') props.onDirty('cfg', cfgDraft !== null, savePluginConfig)
      })
      return el('div', { className: 'tn-settings-section' },
        // 插件配置(原「消耗统计」视图中的配置项,0.3.8 起草稿 + 统一保存)
        el('div', { className: 'tn-subhead' }, t('settingsSectionTitle')),
        cfgErr ? el('div', { className: 'tn-err' }, t('error', { error: cfgErr })) : null,
        el('div', { className: 'tn-cards' },
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('notifyTurn')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnTurn : true, onChange: (e) => patchCfg('notifyOnTurn', e.target.checked) }),
              t('notifyTurnDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('notifyGoal')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnGoal : true, onChange: (e) => patchCfg('notifyOnGoal', e.target.checked) }),
              t('notifyGoalDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('interactionRemind')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnApproval : true, onChange: (e) => patchCfg('notifyOnApproval', e.target.checked) }),
              el('span', null, t('notifyApproval') + ' — ' + t('notifyApprovalDesc'))),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnQuestion : true, onChange: (e) => patchCfg('notifyOnQuestion', e.target.checked) }),
              el('span', null, t('notifyQuestion') + ' — ' + t('notifyQuestionDesc')))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('popupSeconds')),
            el('div', { className: 'tn-range-row' },
              el('input', { className: 'tn-range', type: 'range', min: 3, max: 120, step: 1, value: cfg ? cfg.popupSeconds : 15, onChange: (e) => patchCfg('popupSeconds', Number(e.target.value)) }),
              el('span', { className: 'tn-range-value' }, fmt(cfg ? cfg.popupSeconds : 15) + 's'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('storeDays')),
            el('div', { className: 'tn-range-row' },
              el('input', { className: 'tn-range', type: 'range', min: 1, max: 3650, step: 1, value: cfg ? cfg.storeDays : 365, onChange: (e) => patchCfg('storeDays', Number(e.target.value)) }),
              el('span', { className: 'tn-range-value' }, fmt(cfg ? cfg.storeDays : 365) + 'd'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('pluginEnabled')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.enabled : true, onChange: (e) => patchCfg('enabled', e.target.checked) }),
              t('pluginEnabledDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('webNotify')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.webNotify !== false : true, disabled: perm === 'unsupported' || perm === 'denied', onChange: (e) => patchCfg('webNotify', e.target.checked) }),
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
              el('input', { type: 'checkbox', checked: cfg ? cfg.webNotifyBackgroundOnly !== false : true, disabled: perm === 'unsupported' || !(cfg ? cfg.webNotify !== false : true), onChange: (e) => patchCfg('webNotifyBackgroundOnly', e.target.checked) }),
              t('backgroundOnlyDesc')))),
        el('p', { className: 'tn-note' }, t('configHint')),

        // Token Plan Key 管理(0.3.2):取代原「价格编辑-Token订阅」
        el(TokenPlanKeyManageSection, { hooks: props.hooks, api, onDirty: props.onDirty }),

        // Provider ID 管理(0.3.2)
        el(ProviderIdManageSection, { hooks: props.hooks, api }),

        // 清除记录数据
        el('div', { className: 'tn-subhead' }, t('clearDataTitle')),
        el('div', { className: 'tn-clear-panel' },
          el('p', { className: 'tn-price-note' }, t('clearDataDesc')),
          el('ol', { className: 'tn-clear-steps' },
            el('li', null, t('clearStep1')),
            el('li', null, t('clearStep2')),
            el('li', null, t('clearStep3'))),
          !clearAvailable
            ? el('p', { className: 'tn-clear-err' }, t('clearHostUnavailable'))
            : el('div', { className: 'tn-captcha-row' },
              el('div', {
                className: 'tn-captcha' + (captchaArmed ? ' done' : '') + (!clearAvailable ? ' disabled' : ''),
                onPointerDown: beginDrag,
                onPointerMove: moveDrag,
                onPointerUp: endDrag,
                onPointerCancel: endDrag,
              },
                el('div', { className: 'tn-captcha-fill', style: { width: captchaValue + '%' } }),
                el('div', { className: 'tn-captcha-hint' }, captchaArmed ? t('clearSlideDone') : t('clearSlideHint')),
                el('div', { className: 'tn-captcha-knob', style: { left: Math.round(captchaSpan > 0 ? (captchaValue / 100) * captchaSpan : 0) + 'px' } }, captchaArmed ? '✓' : '»'))),
          el('div', { className: 'tn-custom' },
            clearCode !== '' && captchaArmed
              ? el('span', { className: 'tn-clear-code' }, clearCode)
              : el('span', { className: 'tn-hint' }, captchaArmed ? t('clearCodeHint') : t('clearSlideFirst')),
            clearCode !== '' && captchaArmed
              ? el('button', { className: 'tn-btn', onClick: () => setClearCode(genCode()) }, t('clearCodeRefresh'))
              : null),
          el('div', { className: 'tn-custom' },
            el('input', { className: 'tn-input', placeholder: t('clearCodePlaceholder'), value: clearInput, disabled: !clearAvailable || !captchaArmed || clearBusy, onChange: (e) => setClearInput(e.target.value) })),
          clearErr ? el('p', { className: 'tn-clear-err' }, clearErr) : null,
          clearMsg ? el('p', { className: 'tn-clear-ok' }, clearMsg) : null,
          el('div', { className: 'tn-custom' },
            clearStage === 0
              ? el('button', { className: 'tn-danger-btn', disabled: !clearAvailable || !captchaArmed || clearInput === '' || clearBusy, onClick: () => { void onConfirm() } }, t('clearConfirm1'))
              : el('button', { className: 'tn-danger-btn', disabled: clearBusy, onClick: () => { void onConfirm() } }, clearBusy ? t('clearing') : t('clearConfirm2'))))
      )
    }

    // ── 价格编辑视图(0.3.5 重设)─────────────────────────────────────────────
    // 卡片列表:一张卡片 = 一个模型(名字 + 集体价格;未自定义时显示官方价)。
    // 点击卡片非价格区域展开 → 列出包含该模型的 Provider ID 子卡片(「使用集体
    // 价格」默认勾选;取消勾选展开专属价编辑);卡片 / 子卡片右下角 保存 + 设置
    // 按钮。「设置」进入该主体的峰谷计价临时页(规则列表,条件格式式,退出即保存)。

    function PricingSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [draft, setDraft] = React.useState(null)
      const [addName, setAddName] = React.useState('')
      const [savedMsg, setSavedMsg] = React.useState(false)
      // 展开的模型卡片(显示 Provider ID 子卡片);峰谷计价临时页:{ model, provider } | null
      const [expanded, setExpanded] = React.useState([])
      const [subject, setSubject] = React.useState(null)
      // 全量账目(用于枚举模型与 Provider;从 0 到当前)
      const [enumData, setEnumData] = React.useState(null)
      // 官方价目录(0.3.7:apply 全局加载一次,经 store 快照下发)
      const catalog = snap.catalog
      // 模型显示名索引(0.3.7 修复):来自全局模型设置的 Provider → 模型显示名
      // (本页 modelNames 已是模型清单,故索引另起名)
      const dirNames = modelNameIndexOf(snap.config && snap.config.providers)

      React.useEffect(() => {
        let alive = true
        api.getUsageStats(0, Date.now()).then((res) => {
          if (!alive) return
          if (res && typeof res === 'object' && res.ok === true && res.value) setEnumData(res.value)
        }).catch(() => { /* 账目不可用时仅展示已保存的模型 */ })
        return () => { alive = false }
        // 清除账本后(设置页)重新枚举模型(消耗记录已清空)
      }, [api, props.clearVersion || 0])

      const DEFAULT_PEAK_CLIENT = { enabled: true, windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }], weekdaysOnly: true, boundaryMs: Date.parse('2026-08-16T16:00:00Z') }
      const basePricing = (snap.config && snap.config.pricing) || { currency: '¥', default: {}, models: {} }
      const pricing = draft ? draft.pricing : basePricing
      const plans = draft ? draft.plans : ((snap.config && snap.config.plans) || {})
      const peakCfg = draft ? draft.peak : ((snap.config && snap.config.peak) || DEFAULT_PEAK_CLIENT)
      const currency = pricing.currency === '$' ? '$' : '¥'

      const patchDraft = (mutate) => {
        setDraft((prev) => {
          const deep = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v))
          const base = prev
            ? { pricing: deep(prev.pricing), plans: deep(prev.plans), peak: deep(prev.peak) }
            : {
              pricing: deep(basePricing),
              plans: deep((snap.config && snap.config.plans) || {}),
              peak: deep((snap.config && snap.config.peak) || DEFAULT_PEAK_CLIENT),
            }
          mutate(base)
          return base
        })
      }

      // PRICE_KEY_LIST / cleanPrice / lookupClientModel / officialBaseOf 已提升为
      // 模块级共用(0.3.6:顶部横幅价格弹窗同样使用)。
      const cleanPriceEntry = (p) => {
        const base = cleanPrice(p)
        const pk = p && p.peak
        if (pk && ((pk.peak && Object.keys(cleanPrice(pk.peak)).length > 0) || (pk.offPeak && Object.keys(cleanPrice(pk.offPeak)).length > 0))) {
          base.peak = {}
          if (pk.offPeak) base.peak.offPeak = cleanPrice(pk.offPeak)
          if (pk.peak) base.peak.peak = cleanPrice(pk.peak)
        }
        return base
      }
      // 0.3.7 生效日 / 倍率工具
      const DAY_SCOPE_VALUES = ['weekday', 'everyday', 'custom']
      const dayScopeOf = (r) => (r && DAY_SCOPE_VALUES.includes(r.dayScope)) ? r.dayScope : (r && r.weekdaysOnly === false ? 'everyday' : 'weekday')
      const daysOfScope = (r, scope) => {
        if (scope === 'everyday') return [0, 1, 2, 3, 4, 5, 6]
        if (scope === 'custom') {
          return [...new Set((Array.isArray(r && r.days) ? r.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        }
        return [1, 2, 3, 4, 5]
      }
      const cleanMult = (v, fallback) => {
        const n = Number(v)
        return Number.isFinite(n) && n > 0 ? Math.min(1000, n) : fallback
      }
      // 主体峰谷规则 → 可保存形态(0.3.7 v2:生效日 + 峰时价格方式;无规则返回 null)
      const cleanSubjectPeak = (pk) => {
        if (!pk || typeof pk !== 'object' || !Array.isArray(pk.rules) || pk.rules.length === 0) return null
        const rules = []
        for (const r of pk.rules) {
          if (!r || typeof r !== 'object') continue
          const windows = (Array.isArray(r.windows) ? r.windows : [])
            .filter((w) => w && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)) && Number(w.start) >= 0 && Number(w.end) <= 24)
            .map((w) => ({ start: Number(w.start), end: Number(w.end) }))
          const scope = dayScopeOf(r)
          const rule = {
            dayScope: scope,
            days: daysOfScope(r, scope),
            windows,
            mode: r.mode === 'custom' ? 'custom' : 'multiplier',
            multiplier: cleanMult(r.multiplier, 2),
          }
          // mode='custom':峰时自定义价(留空字段按原价);无任何合法字段时退回倍率方式
          if (rule.mode === 'custom') {
            const pp = cleanPrice(r.peakPrice)
            if (Object.keys(pp).length > 0) rule.peakPrice = pp
          }
          rules.push(rule)
        }
        const tz = Number(pk.tz)
        return rules.length > 0
          ? { enabled: pk.enabled === true, tz: Number.isFinite(tz) && tz >= -12 && tz <= 14 ? tz : 8, rules }
          : null
      }
      const sanitizeProviders = (provSrc) => {
        const providers = {}
        if (!provSrc || typeof provSrc !== 'object') return providers
        for (const pid of Object.keys(provSrc)) {
          const pv = provSrc[pid]
          if (!pv || typeof pv !== 'object') continue
          const useC = pv.useCollective !== false
          const ownPrice = useC ? {} : cleanPriceEntry(pv.price)
          const pPeak = cleanSubjectPeak(pv.peak)
          const pMult = cleanMult(pv.multiplier, 1)
          if (useC && pMult === 1 && Object.keys(ownPrice).length === 0 && pPeak === null) continue
          const prow = { useCollective: useC, price: ownPrice, multiplier: pMult }
          if (pPeak !== null) prow.peak = pPeak
          providers[pid] = prow
        }
        return providers
      }
      const sanitizePeak = (pk) => {
        const windows = Array.isArray(pk && pk.windows)
          ? pk.windows.filter((w) => w && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.end)) && Number(w.start) >= 0 && Number(w.end) <= 24)
            .map((w) => ({ start: Number(w.start), end: Number(w.end) }))
          : []
        return {
          enabled: !!(pk && pk.enabled),
          windows,
          weekdaysOnly: !(pk && pk.weekdaysOnly === false),
          boundaryMs: Number(pk && pk.boundaryMs) > 0 ? Number(pk.boundaryMs) : 0,
        }
      }
      const onSave = async () => {
        try {
          const models = {}
          for (const name of Object.keys(pricing.models || {})) {
            const row = pricing.models[name]
            if (!row || typeof row !== 'object') continue
            const price = row.enabled === true ? cleanPriceEntry(row.price) : {}
            const mPeak = cleanSubjectPeak(row.peak)
            const providers = sanitizeProviders(row.providers)
            // 0.3.7:倍率模式下价格字段可全空(实际价 = 默认价 × 倍率),也算有效内容
            const isMult = row.mode === 'multiplier'
            const hasContent = (row.enabled === true && (Object.keys(price).length > 0 || isMult)) || mPeak !== null || Object.keys(providers).length > 0
            if (!hasContent) continue
            const outRow = {
              enabled: row.enabled === true && (Object.keys(price).length > 0 || isMult),
              price,
              mode: isMult ? 'multiplier' : 'custom',
              multiplier: cleanMult(row.multiplier, 1),
            }
            if (mPeak !== null) outRow.peak = mPeak
            if (Object.keys(providers).length > 0) outRow.providers = providers
            models[name] = outRow
          }
          const sanitizedPricing = { currency, default: cleanPriceEntry(pricing.default), models }
          const sanitizedPlans = {}
          for (const k of Object.keys(plans || {})) {
            const v = plans[k]
            if (!v || typeof v !== 'object') continue
            // 0.3.1:保留计费周期字段(startAt / periodDays / resetMode / 服务端维护的
            // cycleStart / cycleEnd / prevCycle),保存价格时不得覆盖周期状态
            const prev = (v.prevCycle && typeof v.prevCycle === 'object')
              ? {
                start: Number(v.prevCycle.start) > 0 ? Number(v.prevCycle.start) : 0,
                end: Number(v.prevCycle.end) > 0 ? Number(v.prevCycle.end) : 0,
                fee: Number(v.prevCycle.fee) > 0 ? Number(v.prevCycle.fee) : 0,
                tokens: Number(v.prevCycle.tokens) > 0 ? Number(v.prevCycle.tokens) : 0,
                cost: Number(v.prevCycle.cost) > 0 ? Number(v.prevCycle.cost) : 0,
              }
              : null
            const periodDays = Number(v.periodDays)
            sanitizedPlans[k] = {
              enabled: v.enabled === true,
              fee: Number(v.fee) > 0 ? Number(v.fee) : 0,
              credits: Number(v.credits) > 0 ? Number(v.credits) : 0,
              startAt: Number(v.startAt) > 0 ? Number(v.startAt) : 0,
              periodDays: Number.isFinite(periodDays) && periodDays > 0 ? Math.min(3650, Math.round(periodDays)) : 31,
              resetMode: v.resetMode === 'monthly' ? 'monthly' : 'days',
              cycleStart: Number(v.cycleStart) > 0 ? Number(v.cycleStart) : 0,
              cycleEnd: Number(v.cycleEnd) > 0 ? Number(v.cycleEnd) : 0,
              prevCycle: prev,
            }
            // 0.3.4:TID / 冻结历史 / 待确认 / 撤回快照原样保留(内部身份不显示)
            if (typeof v.tid === 'string' && v.tid !== '') sanitizedPlans[k].tid = v.tid
            if (v.cycles && typeof v.cycles === 'object' && !Array.isArray(v.cycles)) {
              const cycles = {}
              for (const tid of Object.keys(v.cycles)) {
                const c = v.cycles[tid]
                if (!c || typeof c !== 'object') continue
                cycles[tid] = {
                  start: Number(c.start) > 0 ? Number(c.start) : 0,
                  end: Number(c.end) > 0 ? Number(c.end) : 0,
                  fee: Number(c.fee) > 0 ? Number(c.fee) : 0,
                  tokens: Number(c.tokens) > 0 ? Number(c.tokens) : 0,
                  cost: Number(c.cost) > 0 ? Number(c.cost) : 0,
                }
              }
              if (Object.keys(cycles).length > 0) sanitizedPlans[k].cycles = cycles
            }
            if (v.pending && typeof v.pending === 'object' && Number(v.pending.at) > 0) sanitizedPlans[k].pending = { at: Number(v.pending.at) }
            if (v._undo && typeof v._undo === 'object') {
              const undo = {
                cycleStart: Number(v._undo.cycleStart) > 0 ? Number(v._undo.cycleStart) : 0,
                cycleEnd: Number(v._undo.cycleEnd) > 0 ? Number(v._undo.cycleEnd) : 0,
                prevCycle: null,
              }
              if (v._undo.prevCycle && typeof v._undo.prevCycle === 'object') {
                undo.prevCycle = {
                  start: Number(v._undo.prevCycle.start) > 0 ? Number(v._undo.prevCycle.start) : 0,
                  end: Number(v._undo.prevCycle.end) > 0 ? Number(v._undo.prevCycle.end) : 0,
                  fee: Number(v._undo.prevCycle.fee) > 0 ? Number(v._undo.prevCycle.fee) : 0,
                  tokens: Number(v._undo.prevCycle.tokens) > 0 ? Number(v._undo.prevCycle.tokens) : 0,
                  cost: Number(v._undo.prevCycle.cost) > 0 ? Number(v._undo.prevCycle.cost) : 0,
                }
              }
              if (typeof v._undo.tid === 'string' && v._undo.tid !== '') undo.tid = v._undo.tid
              sanitizedPlans[k]._undo = undo
            }
          }
          await api.updateConfig({ pricing: sanitizedPricing, plans: sanitizedPlans, peak: sanitizePeak(peakCfg) })
          setDraft(null)
          setSavedMsg(true)
          window.setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
          console.error('[dsh-task-notice] 保存价格失败: ' + String(err && err.message ? err.message : err))
        }
      }
      // 0.3.8:向设置页容器登记价格编辑草稿(悬浮保存按钮 / 切换选项卡 / 退出确认共用)
      React.useEffect(() => {
        if (typeof props.onDirty === 'function') props.onDirty('pricing', draft !== null, onSave)
      })

      // 官方价目录查询:lookupClientModel / officialBaseOf 已提升为模块级共用(0.3.6)

      // 峰时段文本 ⇄ 窗口数组
      const windowsToText = (windows) => (Array.isArray(windows) ? windows.map((w) => w.start + '-' + w.end).join(',') : '')
      const textToWindows = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean).map((seg) => {
        const parts = seg.split('-')
        const start = Number(parts[0])
        const end = Number(parts[1])
        return (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= 24) ? { start, end } : null
      }).filter((w) => w !== null)

      // Provider 目录(显示名 + 所含模型)
      const dirProviders = (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : []
      const providerName = (pid) => {
        const hit = dirProviders.find((p) => p && p.id === pid)
        return hit && hit.displayName ? hit.displayName : pid
      }

      // 模型枚举:全部 Key 的消耗记录 ∪ 已保存模型 ∪ 本次草稿新增
      const enumKeys = (enumData && Array.isArray(enumData.keys)) ? enumData.keys : []
      const providerOfModel = new Map()
      const modelSet = new Set()
      for (const row of enumKeys) {
        for (const m of (Array.isArray(row.models) ? row.models : [])) {
          if (!m || typeof m.model !== 'string' || m.model === '') continue
          modelSet.add(m.model)
          if (!providerOfModel.has(m.model)) providerOfModel.set(m.model, new Set())
          if (m.provider) providerOfModel.get(m.model).add(m.provider)
        }
      }
      for (const name of Object.keys(basePricing.models || {})) modelSet.add(name)
      for (const name of Object.keys((draft && draft.pricing.models) || {})) modelSet.add(name)
      // 0.3.2 首次启动 / 无数据:把 Provider 目录所含模型也列出来(可提前定价)
      // 0.3.7 修复:目录条目 models = [{ id, name }](兼容旧字符串数组)
      for (const p of dirProviders) {
        if (!p || !Array.isArray(p.models)) continue
        for (const item of p.models) {
          const id = typeof item === 'string' ? item : (item !== null && typeof item === 'object' && typeof item.id === 'string' ? item.id : '')
          if (id === '') continue
          modelSet.add(id)
          if (!providerOfModel.has(id)) providerOfModel.set(id, new Set())
          providerOfModel.get(id).add(p.id || '')
        }
      }
      const modelNames = [...modelSet].sort((a, b) => a.localeCompare(b))

      // ── 行数据读取 / 修改(0.3.7:模型名不区分大小写查找)──────────────────
      const rowOf = (model) => {
        const dr = (draft && draft.pricing && draft.pricing.models) ? savedModelRow(draft.pricing, model) : undefined
        return dr || savedModelRow(basePricing, model) || { enabled: false, price: {} }
      }
      // 卡片显示价:已自定义 → 集体价;未自定义 → 官方价(目录收录)或留空(继承全局默认)
      const displayPrice = (model) => {
        const row = savedModelRow(pricing, model)
        if (row && row.enabled === true && row.mode !== 'multiplier') return row.price || {}
        const catEntry = lookupClientModel(model, catalog)
        return officialBaseOf(catEntry, currency) || {}
      }
      // 0.3.7 倍率模式实际价预览:默认价(官方价,未收录回退全局默认价)× 倍率
      // (字段级,与宿主 priceFor 的合并口径一致),只读展示
      const multiplierPreview = (model, row) => {
        const official = officialBaseOf(lookupClientModel(model, catalog), currency) || {}
        const def = pricing && pricing.default && typeof pricing.default === 'object' ? pricing.default : {}
        const mult = cleanMult(row && row.multiplier, 1)
        const out = {}
        for (const k of PRICE_KEY_LIST) {
          const baseV = official[k] !== undefined && official[k] !== null ? Number(official[k]) : Number(def[k] !== undefined && def[k] !== null ? def[k] : 0)
          out[k] = Math.round((Number.isFinite(baseV) ? baseV : 0) * mult * 1e6) / 1e6
        }
        return out
      }
      const baseKeysOf = (p) => {
        const o = {}
        for (const k of PRICE_KEY_LIST) { if (p && p[k] !== undefined && p[k] !== null) o[k] = p[k] }
        return o
      }
      const setCustom = (model, on) => patchDraft((b) => {
        const row = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        row.enabled = on === true
        // 激活自定义:若价格尚未填写则用官方价预填(含峰谷子档)
        if (row.enabled) {
          const catEntry = lookupClientModel(model, catalog)
          const base = officialBaseOf(catEntry, currency)
          if (base && Object.keys(cleanPrice(row.price)).length === 0) {
            row.price = {}
            for (const k of Object.keys(base)) row.price[k] = base[k]
            if (catEntry && catEntry.peak) {
              const side = currency === '$' ? 'usd' : 'cny'
              row.price.peak = {}
              if (catEntry.peak.offPeak && catEntry.peak.offPeak[side]) row.price.peak.offPeak = { ...catEntry.peak.offPeak[side] }
              if (catEntry.peak.peak && catEntry.peak.peak[side]) row.price.peak.peak = { ...catEntry.peak.peak[side] }
            }
          }
        }
      })
      const setModelPrice = (model, k, v, tier) => patchDraft((b) => {
        const row = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        if (tier === 'base') {
          row.price[k] = v
        } else {
          if (!row.price.peak) row.price.peak = {}
          if (!row.price.peak[tier]) row.price.peak[tier] = {}
          row.price.peak[tier][k] = v
        }
      })
      // 0.3.7:自定义方式(逐字段价 / 倍率)与倍率值(实际价 = 默认价 × 倍率)
      const setModelMode = (model, mode) => patchDraft((b) => {
        const row = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        row.mode = mode === 'multiplier' ? 'multiplier' : 'custom'
        if (row.mode === 'multiplier') {
          const n = Number(row.multiplier)
          if (!(Number.isFinite(n) && n > 0)) row.multiplier = 1
        }
      })
      const setModelMultiplier = (model, v) => patchDraft((b) => {
        const row = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        // 保留原文(可含小数点):onChange 立即 Number 化会把 "1." 抹成 "1",小数输不进去;
        // 保存时 cleanMult 统一数值化
        row.multiplier = v
      })
      const addModel = () => {
        const name = String(addName || '').trim()
        if (name === '') return
        if (savedModelRow(pricing, name) !== undefined) {
          setSavedMsg(true)
          window.setTimeout(() => setSavedMsg(false), 2500)
          setAddName('')
          return
        }
        patchDraft((b) => { b.pricing.models[name] = { enabled: false, price: {} } })
        setAddName('')
      }
      const provRowOf = (model, pid) => {
        const row = savedModelRow(pricing, model) || null
        const providers = row && row.providers && typeof row.providers === 'object' ? row.providers : {}
        return providers[pid] || null
      }
      // 取消「使用集体价格」→ 建立专属价行并预填当前生效基础价;重新勾选 → 回到集体价
      const setProvCollective = (model, pid, useC) => {
        const prefill = useC ? null : baseKeysOf(displayPrice(model))
        patchDraft((b) => {
          const mrow = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
          mrow.providers = mrow.providers && typeof mrow.providers === 'object' ? mrow.providers : {}
          const prow = mrow.providers[pid] = mrow.providers[pid] || { useCollective: true, price: {} }
          // useC = 勾选框的新状态(checked);取消勾选 → useCollective=false 并预填专属价
          prow.useCollective = useC
          if (prefill !== null && Object.keys(cleanPrice(prow.price)).length === 0) prow.price = { ...prefill }
        })
      }
      const setProvPrice = (model, pid, k, v) => patchDraft((b) => {
        const mrow = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        mrow.providers = mrow.providers && typeof mrow.providers === 'object' ? mrow.providers : {}
        const prow = mrow.providers[pid] = mrow.providers[pid] || { useCollective: false, price: {} }
        prow.useCollective = false
        prow.price[k] = v
      })
      // 0.3.7:Provider ID 价格倍率(默认 1,对该 Provider 的最终价整体缩放)
      const setProvMultiplier = (model, pid, v) => patchDraft((b) => {
        const mrow = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        mrow.providers = mrow.providers && typeof mrow.providers === 'object' ? mrow.providers : {}
        const prow = mrow.providers[pid] = mrow.providers[pid] || { useCollective: true, price: {} }
        prow.multiplier = v // 原文保留,小数可输入;保存时 cleanMult 数值化
      })
      // 主体峰谷规则读取 / 修改(主体 = 模型集体 或 模型 × Provider)
      const subjectPeakOf = (model, pid) => {
        const row = savedModelRow(pricing, model) || null
        const subj = pid ? ((row && row.providers && row.providers[pid]) || null) : row
        const peak = subj && subj.peak && typeof subj.peak === 'object' ? subj.peak : null
        return peak && Array.isArray(peak.rules) ? peak : { enabled: false, tz: 8, rules: [] }
      }
      const patchSubjectPeak = (model, pid, mutate) => patchDraft((b) => {
        const mrow = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        let target
        if (pid) {
          mrow.providers = mrow.providers && typeof mrow.providers === 'object' ? mrow.providers : {}
          mrow.providers[pid] = mrow.providers[pid] || { useCollective: true, price: {} }
          target = mrow.providers[pid]
        } else {
          target = mrow
        }
        target.peak = target.peak && typeof target.peak === 'object' ? target.peak : { enabled: false, rules: [] }
        if (!Array.isArray(target.peak.rules)) target.peak.rules = []
        mutate(target.peak)
      })
      const toggleExpand = (model) => setExpanded((prev) => (prev.includes(model) ? prev.filter((m) => m !== model) : prev.concat(model)))
      // 0.3.7 修复:模型归属的 Provider ID 以全局模型设置声明的模型清单为准
      // (目录条目 models 现为 [{ id, name }];账本观测只作补集)。
      const providersFor = (model, row) => {
        const set = new Set()
        const fromUse = providerOfModel.get(model)
        if (fromUse) for (const p of fromUse) { if (p && p !== '' && p !== 'unknown') set.add(p) }
        for (const p of dirProviders) {
          if (!p || !p.id || !Array.isArray(p.models)) continue
          if (p.models.some((m) => (typeof m === 'string' ? m : (m !== null && typeof m === 'object' ? m.id : '')) === model)) set.add(p.id)
        }
        if (row && row.providers && typeof row.providers === 'object') { for (const pid of Object.keys(row.providers)) set.add(pid) }
        return [...set].sort((a, b) => a.localeCompare(b))
      }
      // 规则摘要(0.3.7 v2):生效日 + 高峰时段 + 峰时价格(倍率 / 自定义价)
      const ruleDayText = (r) => {
        const scope = dayScopeOf(r)
        if (scope === 'everyday') return t('dayScopeEveryday')
        if (scope === 'custom') {
          const labels = t('dayOfWeekHeaders') // 周一..周日 = 1..6,0
          const valToLabel = (d) => labels[d === 0 ? 6 : d - 1]
          return t('dayScopeCustom') + '(' + (daysOfScope(r, 'custom').map(valToLabel).join(',') || '—') + ')'
        }
        return t('dayScopeWeekday')
      }
      const rulesSummary = (peak) => {
        if (!peak || peak.enabled !== true || !Array.isArray(peak.rules) || peak.rules.length === 0) return null
        return peak.rules.map((r) => {
          const price = r.mode === 'custom'
            ? t('peakModeCustom') + '(' + PRICE_KEY_LIST.filter((k) => r.peakPrice && r.peakPrice[k] !== undefined).map((k) => k + '=' + r.peakPrice[k]).join(',') + ')'
            : '×' + String(cleanMult(r.multiplier, '?'))
          return ruleDayText(r) + ' ' + windowsToText(r.windows) + ' ' + price
        }).join(' / ')
      }
      const peakOnOf = (peak) => !!(peak && peak.enabled === true && Array.isArray(peak.rules) && peak.rules.length > 0)

      // ── 峰谷计价临时页(设置按钮进入;退出 = 保存)────────────────────────
      if (subject !== null) {
        const peak = subjectPeakOf(subject.model, subject.provider)
        const provRow = subject.provider ? provRowOf(subject.model, subject.provider) : null
        const subjDisplay = modelDisplayName(subject.model, catalog, dirNames, subject.provider)
        const title = t('peakSubjectTitle') + ' — ' + subjDisplay
          + (subjDisplay !== subject.model ? ' (' + subject.model + ')' : '')
          + (subject.provider ? ' · ' + providerName(subject.provider) + '(' + subject.provider + ')' : ' · ' + t('collectiveLabel'))
        const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // 周一..周日
        return el('div', { className: 'tn-price-page' },
          el('div', { className: 'tn-peak-topbar' },
            el('button', {
              className: 'tn-btn',
              onClick: () => { void (async () => { await onSave(); setSubject(null) })() },
            }, '← ' + t('peakBackSave')),
            el('span', { className: 'tn-model-name' }, title)),
          el('p', { className: 'tn-price-note' }, t('peakSubjectHint')),
          subject.provider !== null && provRow !== null && provRow.useCollective !== false
            ? el('p', { className: 'tn-price-hint' }, t('providerPeakNote'))
            : null,
          el('div', { className: 'tn-card' },
            el('label', { className: 'tn-check' },
              el('input', {
                type: 'checkbox',
                checked: peak.enabled === true,
                onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.enabled = e.target.checked }),
              }),
              el('span', null, t('subjectPeakEnabled') + ' — ' + t('subjectPeakEnabledDesc'))),
            el('div', { className: 'tn-plan-row', style: { marginTop: '6px' } },
              el('label', { className: 'tn-price-field', style: { maxWidth: '160px' } },
                el('span', null, t('peakTzLabel')),
                el('input', {
                  className: 'tn-input tn-num-input', type: 'number', min: -12, max: 14, step: 0.5,
                  value: peak.tz !== undefined && peak.tz !== null ? String(peak.tz) : '8',
                  onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.tz = e.target.value === '' ? '' : Number(e.target.value) }),
                })),
              el('span', { className: 'tn-hint' }, t('peakTzHint'))),
            peak.rules.length === 0
              ? el('p', { className: 'tn-price-hint', style: { marginTop: '4px' } }, t('noRulesHint'))
              : null,
            peak.rules.map((rule, i) => el('div', { className: 'tn-rule-row', key: i },
              el('span', { className: 'tn-rule-idx' }, String(i + 1) + '.'),
              // 生效日:工作日 / 自定义 / 每天(0.3.7)
              el('label', { className: 'tn-price-field' },
                el('span', null, t('dayScopeLabel')),
                el('select', {
                  className: 'tn-input',
                  value: dayScopeOf(rule),
                  onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => {
                    const scope = e.target.value
                    pk.rules[i] = { ...rule, dayScope: scope, days: daysOfScope({ ...rule, dayScope: scope }, scope) }
                  }),
                },
                  el('option', { value: 'weekday' }, t('dayScopeWeekday')),
                  el('option', { value: 'custom' }, t('dayScopeCustom')),
                  el('option', { value: 'everyday' }, t('dayScopeEveryday')))),
              // 高峰时段(按主体时区的小时)
              el('label', { className: 'tn-price-field' },
                el('span', null, t('peakWindows')),
                el('input', {
                  className: 'tn-input tn-num-input', type: 'text',
                  placeholder: t('peakWindowsPlaceholder'),
                  value: windowsToText(rule.windows),
                  onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.rules[i] = { ...rule, windows: textToWindows(e.target.value) } }),
                })),
              // 峰时价格方式:倍率 / 自定义(0.3.7)
              el('label', { className: 'tn-price-field' },
                el('span', null, t('peakModeLabel')),
                el('select', {
                  className: 'tn-input',
                  value: rule.mode === 'custom' ? 'custom' : 'multiplier',
                  onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.rules[i] = { ...rule, mode: e.target.value } }),
                },
                  el('option', { value: 'multiplier' }, t('peakModeMultiplier')),
                  el('option', { value: 'custom' }, t('peakModeCustom')))),
              rule.mode !== 'custom'
                ? el('label', { className: 'tn-price-field tn-rule-mult' },
                  el('span', null, t('ruleMultiplier')),
                  el('input', {
                    className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any',
                    value: rule.multiplier !== undefined && rule.multiplier !== null ? String(rule.multiplier) : '',
                    onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.rules[i] = { ...rule, multiplier: e.target.value } }), // 原文保留,小数可输入;保存时 cleanMult 数值化
                  }))
                : null,
              el('button', {
                className: 'tn-btn',
                onClick: () => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.rules.splice(i, 1) }),
              }, t('deleteRule')),
              // 自定义生效日:勾选星期(0 = 周日)
              dayScopeOf(rule) === 'custom'
                ? el('div', { style: { flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' } },
                  el('span', { className: 'tn-hint' }, t('ruleDayCustomHint')),
                  DAY_ORDER.map((d) => el('label', { className: 'tn-check', key: d, style: { flex: 'none' } },
                    el('input', {
                      type: 'checkbox',
                      checked: daysOfScope(rule, 'custom').includes(d),
                      onChange: (e) => patchSubjectPeak(subject.model, subject.provider, (pk) => {
                        const cur = daysOfScope(pk.rules[i], 'custom')
                        const next = e.target.checked ? [...new Set([...cur, d])].sort() : cur.filter((x) => x !== d)
                        pk.rules[i] = { ...rule, days: next }
                      }),
                    }),
                    el('span', null, t('dayOfWeekHeaders')[d === 0 ? 6 : d - 1]))))
                : null,
              // 峰时自定义价(0.3.7):留空字段按原价
              rule.mode === 'custom'
                ? el('div', { style: { flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: '4px' } },
                  el('span', { className: 'tn-hint' }, t('peakCustomHint')),
                  PriceFields({ values: rule.peakPrice || {}, onChange: (k, v) => patchSubjectPeak(subject.model, subject.provider, (pk) => {
                    if (!pk.rules[i].peakPrice) pk.rules[i].peakPrice = {}
                    pk.rules[i].peakPrice[k] = v
                  }) }))
                : null)),
            el('div', { className: 'tn-add-row', style: { marginTop: '8px' } },
              el('button', {
                className: 'tn-btn',
                onClick: () => patchSubjectPeak(subject.model, subject.provider, (pk) => { pk.rules.push({ dayScope: 'weekday', days: [1, 2, 3, 4, 5], windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }], mode: 'multiplier', multiplier: 2 }) }),
              }, t('addRule'))),
            el('p', { className: 'tn-price-hint', style: { marginTop: '6px' } }, t('rulePriorityNote'))))
      }

      // ── 卡片列表 ─────────────────────────────────────────────────────────
      return el('div', { className: 'tn-price-page' },
        el('p', { className: 'tn-price-note' }, t('pricePageHint')),
        el('div', { className: 'tn-legacy-note' }, t('legacyPriceNote')),

        // 币种 + 全局默认价 + 全局峰谷
        el('div', { className: 'tn-cards' },
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('currencyLabel')),
            el('select', {
              className: 'tn-input',
              value: currency,
              onChange: (e) => patchDraft((b) => { b.pricing.currency = e.target.value }),
            },
              el('option', { value: '¥' }, '¥ CNY'),
              el('option', { value: '$' }, '$ USD')),
            el('p', { className: 'tn-card-label', style: { marginTop: '8px' } }, t('priceGlobal')),
            PriceFields({ values: pricing.default, onChange: (k, v) => patchDraft((b) => { b.pricing.default[k] = v }) })),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('peakTitle')),
            el('p', { className: 'tn-price-hint' }, t('peakTitleDesc')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: !!(peakCfg && peakCfg.enabled), onChange: (e) => patchDraft((b) => { b.peak.enabled = e.target.checked }) }),
              el('span', null, t('peakEnabled') + ' — ' + t('peakEnabledDesc'))),
            el('div', { className: 'tn-plan-row', style: { marginTop: '6px' } },
              el('label', { className: 'tn-price-field' },
                el('span', null, t('peakWindows')),
                el('input', { className: 'tn-input tn-num-input', type: 'text', placeholder: t('peakWindowsPlaceholder'), value: windowsToText(peakCfg && peakCfg.windows), onChange: (e) => patchDraft((b) => { b.peak.windows = textToWindows(e.target.value) }) })),
              el('label', { className: 'tn-check' },
                el('input', { type: 'checkbox', checked: !!(peakCfg && peakCfg.weekdaysOnly !== false), onChange: (e) => patchDraft((b) => { b.peak.weekdaysOnly = e.target.checked }) }),
                el('span', null, t('peakWeekdaysOnly')))),
            el('p', { className: 'tn-price-hint', style: { marginTop: '4px' } }, t('peakNote')))),

        // 模型卡片(集体价格;点击卡片非价格区域展开 Provider ID 子卡片)
        el('div', { className: 'tn-subhead', style: { marginTop: '6px' } }, t('priceModelRows')),
        modelNames.length === 0
          ? el('p', { className: 'tn-empty' }, t('empty'))
          : el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            modelNames.map((model) => {
              const row = rowOf(model)
              const enabled = row.enabled === true
              const catEntry = lookupClientModel(model, catalog)
              const provs = providersFor(model, row)
              const isExp = expanded.includes(model)
              const summary = rulesSummary(row.peak)
              const isMult = enabled && row.mode === 'multiplier'
              const display = modelDisplayName(model, catalog, dirNames, provs.length === 1 ? provs[0] : '')
              return el('div', { className: 'tn-card2', key: model, onClick: () => toggleExpand(model) },
                el('div', { className: 'tn-card-head' },
                  el('span', { className: 'tn-expand-mark' }, isExp ? '▾' : '▸'),
                  // 0.3.7:显示层用模型显示名,悬停显示原始模型 ID
                  el('span', { className: 'tn-model-name', title: model }, display),
                  enabled
                    ? el('span', { className: 'tn-badge custom' }, t('activeBadge') + (isMult ? ' · ' + t('priceModeMultiplier') : ''))
                    : (catEntry ? el('span', { className: 'tn-badge official' }, t('officialBadge')) : null),
                  peakOnOf(row.peak) ? el('span', { className: 'tn-badge peakv' }, t('peakOnBadge')) : null,
                  provs.length > 0 ? el('span', { className: 'tn-model-meta' }, t('providerSubLabel') + ' × ' + String(provs.length)) : null),
                el('div', { className: 'tn-card-body', onClick: (e) => e.stopPropagation() },
                  el('label', { className: 'tn-check' },
                    el('input', { type: 'checkbox', checked: enabled, onChange: (e) => setCustom(model, e.target.checked) }),
                    el('span', null, t('customPrice'))),
                  // 0.3.7:勾选自定义价格后选择 自定义(逐字段价)/ 倍率(默认价 × 倍率)
                  enabled
                    ? el('div', { className: 'tn-plan-row', style: { marginTop: '2px' } },
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('priceModeLabel')),
                        el('select', {
                          className: 'tn-input',
                          value: row.mode === 'multiplier' ? 'multiplier' : 'custom',
                          onChange: (e) => setModelMode(model, e.target.value),
                        },
                          el('option', { value: 'custom' }, t('priceModeCustom')),
                          el('option', { value: 'multiplier' }, t('priceModeMultiplier')))),
                      isMult
                        ? el('label', { className: 'tn-price-field tn-rule-mult' },
                          el('span', null, t('multiplierLabel')),
                          el('input', {
                            className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any',
                            value: row.multiplier !== undefined && row.multiplier !== null && row.multiplier !== '' ? String(row.multiplier) : '1',
                            onChange: (e) => setModelMultiplier(model, e.target.value),
                          }))
                        : null)
                    : null,
                  isMult
                    ? el('div', null,
                      el('p', { className: 'tn-price-hint' }, t('multiplierHint')),
                      PriceFields({ values: multiplierPreview(model, row), disabled: true }))
                    : PriceFields({ values: displayPrice(model), disabled: !enabled, onChange: (k, v) => setModelPrice(model, k, v, 'base') }),
                  summary !== null ? el('p', { className: 'tn-official-summary' }, t('rulesSummaryLabel') + ': ' + summary) : null,
                  el('p', { className: 'tn-price-hint' }, t('priceUnitNote'))),
                el('div', { className: 'tn-card-actions', onClick: (e) => e.stopPropagation() },
                  el('button', { className: 'tn-btn', onClick: () => { void onSave() } }, t('saveCard')),
                  el('button', { className: 'tn-btn', onClick: () => setSubject({ model, provider: null }) }, t('peakSettings'))),
                isExp
                  ? el('div', { className: 'tn-prov-list', onClick: (e) => e.stopPropagation() },
                    provs.length === 0 ? el('p', { className: 'tn-empty' }, t('noProvidersHint')) : null,
                    provs.map((pid) => {
                      const prow = provRowOf(model, pid)
                      const useC = !prow || prow.useCollective !== false
                      const pSummary = rulesSummary(prow && prow.peak)
                      return el('div', { className: 'tn-prov-card', key: pid },
                        el('div', { className: 'tn-prov-head' },
                          el('label', { className: 'tn-check' },
                            el('input', { type: 'checkbox', checked: useC, onChange: (e) => setProvCollective(model, pid, e.target.checked) }),
                            el('span', null, t('useCollective'))),
                          el('span', { className: 'tn-model-meta' }, providerName(pid) + '(' + pid + ')'),
                          el('div', { className: 'tn-prov-actions' },
                            el('button', { className: 'tn-btn', onClick: () => { void onSave() } }, t('saveCard')),
                            el('button', { className: 'tn-btn', onClick: () => setSubject({ model, provider: pid }) }, t('peakSettings')))),
                        // 0.3.7:该 Provider ID 的价格倍率(默认 1)
                        el('div', { className: 'tn-plan-row', style: { marginTop: '4px' } },
                          el('label', { className: 'tn-price-field tn-rule-mult' },
                            el('span', null, t('provMultiplierLabel')),
                            el('input', {
                              className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any',
                              value: prow && prow.multiplier !== undefined && prow.multiplier !== null && prow.multiplier !== '' ? String(prow.multiplier) : '1',
                              onChange: (e) => setProvMultiplier(model, pid, e.target.value),
                            })),
                          el('span', { className: 'tn-hint' }, t('provMultiplierHint'))),
                        !useC
                          ? el('div', { className: 'tn-prov-body' },
                            PriceFields({ values: (prow && prow.price) || {}, onChange: (k, v) => setProvPrice(model, pid, k, v) }),
                            pSummary !== null ? el('p', { className: 'tn-official-summary' }, t('rulesSummaryLabel') + ': ' + pSummary) : null)
                          : null)
                    }))
                  : null)
            })),

        // 添加模型
        el('div', { className: 'tn-add-row' },
          el('input', {
            className: 'tn-input',
            type: 'text',
            placeholder: t('addModelPlaceholder'),
            value: addName,
            onChange: (e) => setAddName(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') addModel() },
          }),
          el('button', { className: 'tn-btn', onClick: () => addModel() }, t('addModel'))),

        // Token Plan 管理已移至 设置 → Token Plan Key 管理(0.3.2):
        // 本页只编辑模型价格;套餐仍按现状保存,不会被清空。
        el('p', { className: 'tn-price-note' }, t('planSectionTitle') + ': ' + t('planMovedToSettings')),
        el('p', { className: 'tn-price-hint' }, t('priceSaveNow')),

        el('div', { className: 'tn-save-row' },
          el('button', { className: 'tn-btn', onClick: () => { void onSave() } }, t('savePricing')),
          savedMsg ? el('span', { className: 'tn-saved' }, t('savedOk')) : null))
    }

    // ── 使用分析视图(0.3.1)─────────────────────────────────────────────────
    // 顶部导航「使用分析」,四个部分:
    //  1) 消耗金额展示:模型金额占比饼图(悬停查看该模型具体使用情况)+ 各 Key 消耗额度表;
    //  2) Token Plan 回本提示:每个 Token Plan Key 一张子卡片(key 名称 / 名下各模型
    //     消耗金额 / 是否回本 / 每 Credit 对应 tokens / 重置当前周期按钮);
    //  3) 性价比计算:1 元能兑换多少 tokens(模型 tokens ÷ 金额),同品牌模型分组比较;
    //     Token Plan 的 Key 优先用上一轮计费周期(tokens ÷ 上一轮订阅费),无上一轮数据
    //     则用当前消耗 ÷ 金额并标注「正在统计」;
    //  4) 每日费用消耗表:微型日历(代表一天的正方形填充颜色深度 = 当天用量)+ 每个日期
    //     的各模型消耗金额(Token Plan 模型按加权平均摊薄),数据默认堆叠,一次显示 6 天,
    //     其余滚轮滚动查看。

    const ANALYSIS_COLORS = ['#4f8cff', '#3ba272', '#d9a13b', '#e05b5b', '#9b6bff', '#2fb6c9', '#e06bb3', '#8a9b3f', '#b36b5b', '#5b8ab3', '#7a7aff', '#c98a3f', '#6bb38a', '#b36b9b']

    function pieArc(cx, cy, rOuter, rInner, startDeg, endDeg) {
      const a0 = startDeg * Math.PI / 180
      const a1 = endDeg * Math.PI / 180
      const x0 = cx + rOuter * Math.cos(a0)
      const y0 = cy + rOuter * Math.sin(a0)
      const x1 = cx + rOuter * Math.cos(a1)
      const y1 = cy + rOuter * Math.sin(a1)
      const xi0 = cx + rInner * Math.cos(a1)
      const yi0 = cy + rInner * Math.sin(a1)
      const xi1 = cx + rInner * Math.cos(a0)
      const yi1 = cy + rInner * Math.sin(a0)
      const large = (endDeg - startDeg) > 180 ? 1 : 0
      return 'M' + x0 + ',' + y0 +
        ' A' + rOuter + ',' + rOuter + ' 0 ' + large + ' 1 ' + x1 + ',' + y1 +
        ' L' + xi0 + ',' + yi0 +
        ' A' + rInner + ',' + rInner + ' 0 ' + large + ' 0 ' + xi1 + ',' + yi1 +
        ' Z'
    }

    /**
     * 饼图分块(0.3.3):SVG 弧线在起点=终点时整段不渲染,单个模型占满 360°
     * 的圆环会变成空白;这里把整圆切成两个 180° 半环(颜色/悬停信息不变)。
     * 多个模型时输出与旧逻辑一致。
     */
    function buildSlices(pieModels, totalCost) {
      let acc = 0
      const out = []
      pieModels.forEach((m, i) => {
        const start = -90 + (acc / totalCost) * 360
        acc += m.cost
        const end = -90 + (acc / totalCost) * 360
        const color = ANALYSIS_COLORS[i % ANALYSIS_COLORS.length]
        if (end - start >= 360) {
          out.push({ m, i, start, end: start + 180, color })
          out.push({ m, i, start: start + 180, end, color })
        } else {
          out.push({ m, i, start, end, color })
        }
      })
      return out
    }

    function fmtDateLocal(ts) {
      const d = new Date(ts)
      const pad = (n) => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    }

    function fmtDateTime(ts) {
      const d = new Date(ts)
      const pad = (n) => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    }

    // ── 今日消耗(0.3.3):顶部导航第一个标签页 ────────────────────────────────
    // 展示:今天的模型消耗金额占比饼图 + 各模型 tokens 消耗量 + 今天的消费情况。
    // 复用 getUsageStats(今日 00:00 → 现在)与饼图绘制(pieArc / ANALYSIS_COLORS)。
    function TodaySection(props) {
      const api = props.api
      const snap = useStore(props.hooks.taskNotice)
      const el = React.createElement
      const clearVersion = props.clearVersion || 0
      const [data, setData] = React.useState({ status: 'idle', stats: null, entries: [], error: null })
      const [hover, setHover] = React.useState(null)
      const [entryPage, setEntryPage] = React.useState(0) // 明细翻页:每页最多 20 条

      const todayStart = () => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      }

      const load = React.useCallback(async () => {
        setData({ status: 'loading', stats: null, entries: [], error: null })
        try {
          const result = await api.getUsageStats(todayStart(), Date.now())
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed')
          }
          // 单次消耗明细(0.3.3):旧宿主无 getUsageEntries 时降级为不展示,不影响统计
          let entries = []
          try {
            const er = await api.getUsageEntries(todayStart(), Date.now())
            if (er !== null && typeof er === 'object' && er.ok === true && er.value && Array.isArray(er.value.entries)) {
              entries = er.value.entries
            }
          } catch { /* 旧宿主无该 RPC */ }
          setData({ status: 'ready', stats: result.value, entries, error: null })
        } catch (error) {
          setData({ status: 'error', stats: null, entries: [], error: String(error && error.message ? error.message : error) })
        }
      }, [api])

      React.useEffect(() => { void load() }, [load])
      React.useEffect(() => { if (clearVersion > 0) void load() }, [clearVersion, load])

      // 价格/套餐变化后重算今日金额
      const priceSignature = snap.config ? JSON.stringify([snap.config.pricing, snap.config.plans, snap.config.peak]) : ''
      React.useEffect(() => {
        if (data.status === 'ready' && priceSignature !== '') void load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [priceSignature])

      const stats = data.stats
      const entries = (data && Array.isArray(data.entries)) ? data.entries : []
      const rows = (stats && Array.isArray(stats.keys)) ? stats.keys : []
      // 明细翻页(0.3.7):每页最多 20 条,数据刷新后页码越界自动收敛
      const pageCount = Math.max(1, Math.ceil(entries.length / 20))
      const entryPageIndex = Math.min(entryPage, pageCount - 1)
      const pageEntries = entries.slice(entryPageIndex * 20, entryPageIndex * 20 + 20)
      const pagerEl = entries.length > 20
        ? el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' } },
          el('button', { className: 'tn-btn', disabled: entryPageIndex === 0, onClick: () => setEntryPage(entryPageIndex - 1) }, t('pagerPrev')),
          el('span', { className: 'tn-hint' }, t('pagerInfo', { page: entryPageIndex + 1, pages: pageCount, n: entries.length })),
          el('button', { className: 'tn-btn', disabled: entryPageIndex >= pageCount - 1, onClick: () => setEntryPage(entryPageIndex + 1) }, t('pagerNext')))
        : null
      // 跨 Key 按模型聚合(与消耗统计口径一致):今日各模型 tokens 与金额
      // 0.3.7:按 (模型, Provider ID) 分行——同名模型不同 Provider 分开显示、分开配色
      const modelMap = new Map()
      for (const row of rows) {
        const models = Array.isArray(row.models) ? row.models : []
        for (const m of models) {
          const name = (m && typeof m.model === 'string' && m.model !== '') ? m.model : 'unknown'
          const provider = (m && typeof m.provider === 'string') ? m.provider : ''
          const gkey = name + '\u0000' + provider
          let agg = modelMap.get(gkey)
          if (agg === undefined) {
            agg = { label: name, model: name, provider, calls: 0, cacheIn: 0, cacheOut: 0, output: 0, cacheWrite: 0, reasoning: 0, tokens: 0, cost: 0 }
            modelMap.set(gkey, agg)
          }
          agg.calls += m.calls
          agg.cacheIn += m.cacheIn
          agg.cacheOut += m.cacheOut
          agg.output += m.output
          agg.cacheWrite += m.cacheWrite
          agg.reasoning += m.reasoning
          agg.tokens += (m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning)
          agg.cost += m.cost || 0
        }
      }
      const modelRows = [...modelMap.values()].sort((a, b) => b.cost - a.cost || b.tokens - a.tokens)
      // 色块只区分 Provider ID(0.3.7):同一 Provider 的模型共用同色,按出现顺序取色
      const providerColorMap = new Map()
      for (const m of modelRows) {
        if (!providerColorMap.has(m.provider)) providerColorMap.set(m.provider, ANALYSIS_COLORS[providerColorMap.size % ANALYSIS_COLORS.length])
      }
      const providerColorOf = (m) => providerColorMap.get(m.provider)
      const totalCost = modelRows.reduce((a, m) => a + (m.cost || 0), 0)
      const currency = (snap.config && snap.config.pricing && snap.config.pricing.currency === '$') ? '$' : '¥'
      const catalog = snap.catalog // 0.3.7:模型显示名来源(全局模型设置优先,官方目录兜底)
      const modelNames = modelNameIndexOf(snap.config && snap.config.providers)
      const dirList = (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : []
      // 图例项(0.3.7):色块 + Provider 显示名 · ID(不区分模型、不显示模型名与用量)
      const legendItems = [...providerColorMap.keys()].map((pid) => {
        const lbl = providerRowLabel({ key: pid, provider: pid, providerName: providerDisplayOf(dirList, pid) }, dirList)
        return { pid, color: providerColorMap.get(pid), text: lbl.main + (lbl.sub ? ' · ' + lbl.sub : '') }
      })
      // 图例列宽按最长标签的字数自适应(12px 字号:CJK ≈12px/字、拉丁 ≈7px/字,另加色块与间距 22px);
      // min(…px, 50%) 保证每行至少 2 项,grid 上下行对齐——ID 越短每行放的图例越多
      const legendTrackPx = Math.max(140, ...legendItems.map((it) => {
        let w = 22
        for (const ch of it.text) w += ch.charCodeAt(0) > 0x2e80 ? 12 : 7
        return w
      }))

      // 饼图分块(今日模型金额占比;单模型整圆拆半环,0.3.3)
      const pieModels = totalCost > 0 ? modelRows.filter((m) => (m.cost || 0) > 0) : []
      const slices = buildSlices(pieModels, totalCost)
      // 悬停索引在数据刷新(切片变少/清空)后可能越界,越界时不渲染气泡
      const hovered = (hover !== null && slices[hover.idx] !== undefined) ? slices[hover.idx] : null

      return el('div', { className: 'tn-analysis' },
        el('div', { className: 'tn-block-title' }, t('todayTitle')),
        el('p', { className: 'tn-block-note' }, t('todayHint', { date: fmtDateLocal(Date.now()) })),
        data.status === 'loading' ? el('div', { className: 'tn-empty' }, t('loading')) : null,
        data.status === 'error' ? el('div', { className: 'tn-err' }, t('error', { error: data.error })) : null,
        data.status === 'ready' && modelRows.length === 0 ? el('div', { className: 'tn-empty' }, t('empty')) : null,
        data.status === 'ready'
          ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
            // 今天的消费情况
            el('div', { className: 'tn-cards' },
              el('div', { className: 'tn-card' },
                el('p', { className: 'tn-card-label' }, t('statTokens')),
                el('div', { className: 'tn-card-value' }, num(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning))),
              el('div', { className: 'tn-card' },
                el('p', { className: 'tn-card-label' }, t('statCalls')),
                el('div', { className: 'tn-card-value' }, num(stats.calls))),
              el('div', { className: 'tn-card' },
                el('p', { className: 'tn-card-label' }, t('costChip')),
                el('div', { className: 'tn-card-value' }, money(stats.totals.cost, currency)))),
            // 今天用的模型占比饼图
            el('div', { className: 'tn-block-title' }, t('todayPieTitle')),
            el('div', { className: 'tn-pie-wrap' },
              el('div', { className: 'tn-pie-box', onMouseLeave: () => setHover(null) },
                el('svg', { width: 180, height: 180, viewBox: '0 0 180 180' },
                  slices.map((s, si) => el('path', {
                    key: s.m.model + ':' + si,
                    d: pieArc(90, 90, 74, 46, s.start, s.end),
                    fill: s.color,
                    stroke: 'var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))',
                    strokeWidth: 1.5,
                    style: { cursor: 'pointer', opacity: hovered !== null && hovered.i !== s.i ? 0.45 : 1, transition: 'opacity .15s' },
                    onMouseMove: (e) => {
                      const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
                      setHover({ idx: si, x: e.clientX - rect.left, y: e.clientY - rect.top })
                    },
                  })),
                  el('text', { x: 90, y: 90, textAnchor: 'middle', fontSize: 14, fontWeight: 600, fill: 'var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))' }, fmtMoney(totalCost, currency), el('title', null, fmtExact(totalCost))),
                  el('text', { x: 90, y: 107, textAnchor: 'middle', fontSize: 10, fill: 'var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))' }, t('total'))),
                hovered !== null
                  ? el('div', { className: 'tn-pie-tip', style: { left: hovered.x, top: hovered.y } },
                    el('div', { style: { fontWeight: 600 }, title: hovered.m.model }, modelDisplayName(hovered.m.model, catalog, modelNames, hovered.m.provider)),
                    el('div', null, t('total') + ' ' + fmt(hovered.m.tokens) + ' ' + t('tokensUnit')),
                    el('div', null, t('money') + ' ' + fmtMoney(hovered.m.cost, currency) + ' · ' + ((hovered.m.cost / totalCost) * 100).toFixed(1) + '%'))
                  : null),
              el('div', { className: 'tn-legend' },
                pieModels.map((m, i) => el('div', { className: 'tn-legend-item', key: m.model + '\u0000' + m.provider },
                  el('span', { className: 'tn-legend-dot', style: { background: ANALYSIS_COLORS[i % ANALYSIS_COLORS.length] } }),
                  el('span', { className: 'tn-legend-name', title: m.model }, modelDisplayName(m.model, catalog, modelNames, m.provider) + (m.provider ? ' · ' + m.provider : '')),
                  el('span', { className: 'tn-legend-val', title: fmtExact(m.cost) }, fmtMoney(m.cost, currency) + ' · ' + ((m.cost / totalCost) * 100).toFixed(1) + '%'))),
                el('div', { className: 'tn-legend-item' },
                  el('span', { className: 'tn-legend-name', style: { fontWeight: 600 } }, t('total')),
                  el('span', { className: 'tn-legend-val', title: fmtExact(totalCost) }, fmtMoney(totalCost, currency))))),
            // 今天各个模型的 tokens 消耗量
            el('div', { className: 'tn-block-title' }, t('todayModelTokensTitle')),
            el('div', { className: 'tn-table-wrap' },
              el('table', { className: 'tn-table' },
                el('thead', null,
                  el('tr', null,
                    el('th', null, t('modelColumn')),
                    el('th', { className: 'num' }, t('calls')),
                    el('th', { className: 'num' }, t('cacheIn')),
                    el('th', { className: 'num' }, t('cacheOut')),
                    el('th', { className: 'num' }, t('output')),
                    el('th', { className: 'num' }, t('total')),
                    el('th', { className: 'num' }, t('money')))),
                el('tbody', null,
                  modelRows.map((m) => el('tr', { key: m.model + '\u0000' + m.provider },
                    el('td', null,
                      el('span', { className: 'tn-legend-dot', style: { background: providerColorOf(m), display: 'inline-block', marginRight: '6px', verticalAlign: '-1px' } }),
                      el('span', { title: m.model }, modelDisplayName(m.model, catalog, modelNames, m.provider)),
                      m.provider ? el('span', { className: 'tn-model-meta', style: { marginLeft: '6px' } }, m.provider) : null),
                    el('td', { className: 'num', title: fmtExact(m.calls) }, fmt(m.calls)),
                    el('td', { className: 'num', title: fmtExact(m.cacheIn) }, fmt(m.cacheIn)),
                    el('td', { className: 'num', title: fmtExact(m.cacheOut) }, fmt(m.cacheOut)),
                    el('td', { className: 'num', title: fmtExact(m.output) }, fmt(m.output)),
                    el('td', { className: 'num', title: fmtExact(m.tokens) }, fmt(m.tokens)),
                    el('td', { className: 'num', title: fmtExact(m.cost) }, fmtMoney(m.cost, currency)))),
                  el('tr', { className: 'tn-row-total' },
                    el('td', null, t('total')),
                    el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.calls, 0)) }, fmt(modelRows.reduce((a, m) => a + m.calls, 0))),
                    el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.cacheIn, 0)) }, fmt(modelRows.reduce((a, m) => a + m.cacheIn, 0))),
                    el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.cacheOut, 0)) }, fmt(modelRows.reduce((a, m) => a + m.cacheOut, 0))),
                    el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.output, 0)) }, fmt(modelRows.reduce((a, m) => a + m.output, 0))),
                    el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + m.tokens, 0)) }, fmt(modelRows.reduce((a, m) => a + m.tokens, 0))),
                    el('td', { className: 'num', title: fmtExact(modelRows.reduce((a, m) => a + (m.cost || 0), 0)) }, fmtMoney(modelRows.reduce((a, m) => a + (m.cost || 0), 0), currency)))))),
            // 图例:色块 = Provider ID(同 Provider 同色;不区分模型、不显示模型名与用量),
            // 列宽随 Provider ID 字数自适应,每行至少 2 项、上下行对齐
            el('div', { className: 'tn-legend-grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(min(' + legendTrackPx + 'px, 50%), 1fr))' } },
              legendItems.map((it) => el('div', { className: 'tn-legend-item', key: it.pid },
                el('span', { className: 'tn-legend-dot', style: { background: it.color } }),
                el('span', { className: 'tn-legend-name', title: it.pid }, it.text)))),
            // 今日消耗明细(0.3.3):每次产生消耗的单次记录(时间倒序)
            el('div', { className: 'tn-block-title' }, t('todayEntriesTitle')),
            el('p', { className: 'tn-block-note' }, t('todayEntriesHint')),
            el('div', { className: 'tn-table-wrap' },
              el('table', { className: 'tn-table' },
                el('thead', null,
                  el('tr', null,
                    el('th', null, t('timeColumn')),
                    el('th', null, t('modelColumn')),
                    el('th', null, t('key')),
                    el('th', { className: 'num' }, t('cacheIn')),
                    el('th', { className: 'num' }, t('cacheOut')),
                    el('th', { className: 'num' }, t('output')),
                    el('th', { className: 'num' }, t('total')),
                    el('th', { className: 'num' }, t('money')))),
                el('tbody', null,
                  entries.length === 0
                    ? el('tr', null, el('td', { colSpan: 8, className: 'tn-empty' }, t('empty')))
                    : pageEntries.map((en, ei) => {
                      const total = (en.cacheIn || 0) + (en.cacheOut || 0) + (en.output || 0) + (en.cacheWrite || 0) + (en.reasoning || 0)
                      const lbl = providerRowLabel(en, (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : [])
                      return el('tr', { key: ei },
                        el('td', null, fmtDateTime(en.at)),
                        el('td', null, el('span', { title: en.model }, modelDisplayName(en.model, catalog, modelNames, en.provider))),
                        el('td', null, lbl.main, lbl.sub ? el('div', { className: 'tn-model-row' }, lbl.sub) : null),
                        el('td', { className: 'num', title: fmtExact(en.cacheIn) }, fmt(en.cacheIn)),
                        el('td', { className: 'num', title: fmtExact(en.cacheOut) }, fmt(en.cacheOut)),
                        el('td', { className: 'num', title: fmtExact(en.output) }, fmt(en.output)),
                        el('td', { className: 'num', title: fmtExact(total) }, fmt(total)),
                        el('td', { className: 'num', title: fmtExact(en.cost) }, fmtMoney(en.cost, currency)))
                    })))), 
            pagerEl)
          : null)
    }

    function AnalysisSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [rangeId, setRangeId] = React.useState('1m')
      const [customFrom, setCustomFrom] = React.useState(localInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      const [customTo, setCustomTo] = React.useState(localInputValue(new Date()))
      const [data, setData] = React.useState({ status: 'idle', analysis: null, error: null })
      const [hover, setHover] = React.useState(null)
      const [hoverDay, setHoverDay] = React.useState(null)
      const [resetting, setResetting] = React.useState(null)
      // 清除账本后(设置页)自动重查分析
      const clearVersion = props.clearVersion || 0

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
        setData({ status: 'loading', analysis: null, error: null })
        try {
          const result = await api.getUsageAnalysis(fromMs, toMs)
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed')
          }
          setData({ status: 'ready', analysis: result.value, error: null })
        } catch (error) {
          setData({ status: 'error', analysis: null, error: String(error && error.message ? error.message : error) })
        }
      }, [customFrom, customTo])

      React.useEffect(() => { void load(rangeId) }, [rangeId, load])

      React.useEffect(() => {
        if (clearVersion > 0) void load(rangeId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [clearVersion])

      // 价格 / 套餐 / 峰谷变化后(价格编辑页保存)立即重算分析
      const priceSignature = snap.config
        ? JSON.stringify([snap.config.pricing, snap.config.plans, snap.config.peak])
        : ''
      React.useEffect(() => {
        if (data.status === 'ready' && priceSignature !== '') void load(rangeId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [priceSignature])

      // ── Token Plan 重置保护(0.3.3)+ 续费确认(0.3.4)─────────────────────
      // 重置/撤回需要:① 输入随机 4 位数字验证码 → ② 两次点击不同位置的确认
      // 按钮才执行。resetFlow = { key, mode: 'reset'|'undo'|'renew'|'dismiss',
      // code, input, stage };renew/dismiss 无需验证码(两段确认即可)。
      const [resetFlow, setResetFlow] = React.useState(null)
      // 已重置、可撤回的 Key(以服务端 plan._undo 快照为准;本地跟踪 + 启动时兜底)
      const [undoKeys, setUndoKeys] = React.useState(() => {
        const s = new Set()
        try {
          const plans = snap.config && snap.config.plans ? snap.config.plans : {}
          for (const k of Object.keys(plans)) {
            if (plans[k] && plans[k]._undo) s.add(k)
          }
        } catch { /* ignore */ }
        return s
      })
      const markUndoable = (key) => setUndoKeys((prev) => new Set(prev).add(key))
      const clearUndoable = (key) => setUndoKeys((prev) => { const n = new Set(prev); n.delete(key); return n })

      const startResetFlow = (key, mode) => {
        if (mode === 'undo' && !(api.hasUndoPlanCycle ? api.hasUndoPlanCycle() : false)) {
          setData({ status: 'error', analysis: data.analysis, error: String(t('undoHostUnavailable')) })
          return
        }
        setResetFlow({ key, mode, code: mode === 'reset' || mode === 'undo' ? gen4() : '', input: '', stage: 0 })
      }
      const cancelResetFlow = () => setResetFlow(null)

      // 第一次确认:reset/undo 需验证码正确才进入第二次确认(不同位置);
      // renew/dismiss 无需验证码,首次点击即进入确认步骤。
      const confirmResetStep = () => {
        const flow = resetFlow
        if (flow === null) return
        if ((flow.mode === 'reset' || flow.mode === 'undo') && flow.input !== flow.code) return
        setResetFlow({ ...flow, stage: 1 })
      }

      // 第二次确认:真正执行重置 / 撤回 / 续费重置 / 清除待确认
      const executeReset = async () => {
        const flow = resetFlow
        if (flow === null || flow.stage !== 1) return
        const key = flow.key
        setResetting(key)
        try {
          const { fromMs, toMs } = computeRange(rangeId)
          const result = flow.mode === 'undo'
            ? await api.undoPlanCycle(key, fromMs, toMs)
            : flow.mode === 'renew'
              ? await api.renewPlanCycle(key, false, fromMs, toMs)
              : flow.mode === 'dismiss'
                ? await api.dismissPlanPending(key, fromMs, toMs)
                : await api.resetPlanCycle(key, fromMs, toMs)
          if (result !== null && typeof result === 'object' && result.ok === true && result.value) {
            setData({ status: 'ready', analysis: result.value, error: null })
            if (flow.mode === 'undo') clearUndoable(key)
            else markUndoable(key)
            // 0.3.4:renew/dismiss 改了 pending 状态,刷新配置快照;续费后再问套餐是否变更
            if (flow.mode === 'renew' || flow.mode === 'dismiss') {
              try { await api.reload() } catch { /* ignore */ }
              if (flow.mode === 'renew') openPluginView('settings', key)
            }
          }
        } catch (error) {
          setData({ status: 'error', analysis: data.analysis, error: String(error && error.message ? error.message : error) })
        } finally {
          setResetting(null)
          setResetFlow(null)
        }
      }

      // 0.3.4:弹窗「进入重置页」→ 切到使用分析并打开该 Key 的重置流程
      const externalReset = props.externalReset
      React.useEffect(() => {
        if (externalReset !== null && externalReset !== undefined && typeof externalReset.key === 'string') {
          startResetFlow(externalReset.key, 'reset')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [externalReset !== null && externalReset !== undefined ? externalReset.nonce : 0])

      const analysis = data.analysis
      const catalog = snap.catalog // 0.3.7:模型显示名来源
      const currencySymbol = (analysis && typeof analysis.currency === 'string' && analysis.currency === '$')
        ? '$'
        : ((snap.config && snap.config.pricing && snap.config.pricing.currency === '$') ? '$' : '¥')
      const models = (analysis && Array.isArray(analysis.models)) ? analysis.models : []
      const keys = (analysis && Array.isArray(analysis.keys)) ? analysis.keys : []
      const rankings = (analysis && Array.isArray(analysis.rankings)) ? analysis.rankings : []
      const daily = (analysis && Array.isArray(analysis.daily)) ? analysis.daily : []
      const maxDailyCost = (analysis && typeof analysis.maxDailyCost === 'number') ? analysis.maxDailyCost : 0
      const totalCost = models.reduce((a, m) => a + (m.cost || 0), 0)
      const pieModels = totalCost > 0 ? models.filter((m) => (m.cost || 0) > 0) : []
      // 0.3.7 修复:模型显示名来自全局模型设置(analysis.models 带 provider,可精确定位)
      const modelNames = modelNameIndexOf(snap.config && snap.config.providers)

      // 0.3.5:每日费用表颜色按模型名全局分配——同模型跨日期同色(顺序与饼图一致,再补每日独有模型)
      const dailyColorMap = new Map()
      const dailyColor = (name) => {
        if (!dailyColorMap.has(name)) dailyColorMap.set(name, ANALYSIS_COLORS[dailyColorMap.size % ANALYSIS_COLORS.length])
        return dailyColorMap.get(name)
      }
      for (const m of pieModels) dailyColor(m.model)
      for (const d of daily) for (const m of d.models) dailyColor(m.model)

      // 饼图分块(单模型整圆拆半环,0.3.3)
      const slices = buildSlices(pieModels, totalCost)
      // 悬停索引在数据刷新(切片变少/清空)后可能越界,越界时不渲染气泡
      const hovered = (hover !== null && slices[hover.idx] !== undefined) ? slices[hover.idx] : null

      // 日历:展示范围结束所在月份;格子的颜色深度 = 当天消耗 / 最大日消耗
      const toMsEnd = (analysis && typeof analysis.toMs === 'number') ? analysis.toMs : Date.now()
      const fromMs0 = (analysis && typeof analysis.fromMs === 'number') ? analysis.fromMs : 0
      const calDate = new Date(toMsEnd)
      const calYear = calDate.getFullYear()
      const calMonth = calDate.getMonth()
      const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
      const dailyMap = new Map()
      for (const d of daily) dailyMap.set(d.date, d)
      const todayKey = fmtDateLocal(Date.now())
      const weekHeaders = t('dayOfWeekHeaders')
      const calCells = []
      for (let i = 0; i < firstDow; i += 1) calCells.push(null)
      for (let d = 1; d <= daysInMonth; d += 1) {
        const ts = new Date(calYear, calMonth, d).getTime()
        calCells.push({ d, ts, inRange: ts >= fromMs0 && ts <= toMsEnd })
      }
      const focusDay = hoverDay !== null ? hoverDay : (daily.length > 0 ? daily[0].date : null)
      const focusInfo = focusDay !== null ? dailyMap.get(focusDay) : null


      const planKeys = keys.filter((k) => k.plan !== null)
      const ready = data.status === 'ready' && analysis !== null
      const tipLeft = hover !== null ? Math.max(4, Math.min(hover.x + 14, 180 - 256 + 4)) : 4
      const tipTop = hover !== null ? Math.max(4, hover.y + 14) : 4

      return el('div', { className: 'tn-analysis' },
        el('p', { className: 'tn-block-note' }, t('analysisHint')),
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
        data.status === 'loading' ? el('div', { className: 'tn-empty' }, t('loading')) : null,
        data.status === 'error' ? el('div', { className: 'tn-err' }, t('error', { error: data.error })) : null,
        ready && models.length === 0 ? el('div', { className: 'tn-empty' }, t('empty')) : null,
        ready
          ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
            // ── 第一部分:消耗金额展示 ──
            el('div', { className: 'tn-block-title' }, t('pieTitle')),
            el('p', { className: 'tn-block-note' }, t('pieHint')),
            el('div', { className: 'tn-pie-wrap' },
              el('div', { className: 'tn-pie-box', onMouseLeave: () => setHover(null) },
                el('svg', { width: 180, height: 180, viewBox: '0 0 180 180' },
                  slices.map((s, si) => el('path', {
                    key: s.m.model + ':' + si,
                    d: pieArc(90, 90, 74, 46, s.start, s.end),
                    fill: s.color,
                    stroke: 'var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))',
                    strokeWidth: 1.5,
                    style: { cursor: 'pointer', opacity: hovered !== null && hovered.i !== s.i ? 0.45 : 1, transition: 'opacity .15s' },
                    onMouseMove: (e) => {
                      const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
                      setHover({ idx: si, x: e.clientX - rect.left, y: e.clientY - rect.top })
                    },
                  })),
                  el('text', { x: 90, y: 90, textAnchor: 'middle', fontSize: 14, fontWeight: 600, fill: 'var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))' }, fmtMoney(totalCost, currencySymbol), el('title', null, fmtExact(totalCost))),
                  el('text', { x: 90, y: 107, textAnchor: 'middle', fontSize: 10, fill: 'var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))' }, t('total'))),
                hovered !== null && hovered !== undefined
                  ? el('div', { className: 'tn-pie-tip', style: { left: tipLeft, top: tipTop } },
                    el('div', { style: { fontWeight: 600 }, title: hovered.m.model }, hovered.m.brand + ' · ' + modelDisplayName(hovered.m.model, catalog, modelNames, hovered.m.provider)),
                    el('div', null, t('calls') + ' ' + fmt(hovered.m.calls) + ' · ' + t('total') + ' ' + fmt(hovered.m.tokens) + ' ' + t('tokensUnit')),
                    el('div', null, t('cacheIn') + ' ' + fmt(hovered.m.cacheIn) + ' · ' + t('cacheOut') + ' ' + fmt(hovered.m.cacheOut) + ' · ' + t('output') + ' ' + fmt(hovered.m.output)),
                    hovered.m.cacheWrite > 0 || hovered.m.reasoning > 0
                      ? el('div', null, t('cacheWrite') + ' ' + fmt(hovered.m.cacheWrite) + ' · ' + t('reasoning') + ' ' + fmt(hovered.m.reasoning))
                      : null,
                    el('div', null, t('money') + ' ' + fmtMoney(hovered.m.cost, currencySymbol) + ' · ' + ((hovered.m.cost / totalCost) * 100).toFixed(1) + '%'))
                  : null),
              el('div', { className: 'tn-legend' },
                pieModels.map((m, i) => el('div', { className: 'tn-legend-item', key: m.model },
                  el('span', { className: 'tn-legend-dot', style: { background: ANALYSIS_COLORS[i % ANALYSIS_COLORS.length] } }),
                  el('span', { className: 'tn-legend-name', title: m.model }, modelDisplayName(m.model, catalog, modelNames, m.provider) + (m.brand && m.brand !== '其他' ? ' (' + m.brand + ')' : '')),
                  el('span', { className: 'tn-legend-val', title: fmtExact(m.cost) }, fmtMoney(m.cost, currencySymbol) + ' · ' + ((m.cost / totalCost) * 100).toFixed(1) + '%'))),
                el('div', { className: 'tn-legend-item' },
                  el('span', { className: 'tn-legend-name', style: { fontWeight: 600 } }, t('total')),
                  el('span', { className: 'tn-legend-val', title: fmtExact(totalCost) }, fmtMoney(totalCost, currencySymbol))))),
            el('div', { className: 'tn-subhead', style: { marginTop: '4px' } }, t('keyQuotaTitle')),
            el('div', { className: 'tn-table-wrap' },
              el('table', { className: 'tn-table' },
                el('thead', null,
                  el('tr', null,
                    el('th', null, t('key')),
                    el('th', null, t('provider')),
                    el('th', { className: 'num' }, t('calls')),
                    el('th', { className: 'num' }, t('total')),
                    el('th', { className: 'num' }, t('money')))),
                el('tbody', null,
                  keys.map((row) => {
                    const lbl = providerRowLabel(row, (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : [])
                    return el('tr', { key: row.key },
                      el('td', null, lbl.main, lbl.sub ? el('div', { className: 'tn-model-row' }, lbl.sub) : null),
                      el('td', null, row.provider || '—'),
                      el('td', { className: 'num', title: fmtExact(row.calls) }, fmt(row.calls)),
                      el('td', { className: 'num', title: fmtExact(row.tokens) }, fmt(row.tokens)),
                      el('td', { className: 'num', title: fmtExact(row.cost) }, fmtMoney(row.cost, currencySymbol)))
                  }),
                  el('tr', { className: 'tn-row-total' },
                    el('td', null, t('total')),
                    el('td', null, ''),
                    el('td', { className: 'num', title: fmtExact(keys.reduce((a, r) => a + r.calls, 0)) }, fmt(keys.reduce((a, r) => a + r.calls, 0))),
                    el('td', { className: 'num', title: fmtExact(keys.reduce((a, r) => a + r.tokens, 0)) }, fmt(keys.reduce((a, r) => a + r.tokens, 0))),
                    el('td', { className: 'num', title: fmtExact(keys.reduce((a, r) => a + r.cost, 0)) }, fmtMoney(keys.reduce((a, r) => a + r.cost, 0), currencySymbol)))))),

            // ── 第二部分:Token Plan 回本提示 ──
            el('div', { className: 'tn-block-title', style: { marginTop: '10px' } }, t('planBreakTitle')),
            el('p', { className: 'tn-block-note' }, t('planBreakHint')),
            planKeys.length === 0
              ? el('p', { className: 'tn-empty' }, t('noPlan'))
              : el('div', { className: 'tn-plan-cards' },
                planKeys.map((row) => {
                  const p = row.plan
                  const pct = p.fee > 0 ? Math.min(100, Math.max(0, (p.cycleCost / p.fee) * 100)) : 0
                  const lbl = providerRowLabel(row, (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : [])
                  return el('div', { className: 'tn-plan-card', key: row.key },
                    el('div', { className: 'tn-plan-head' },
                      el('span', { className: 'tn-plan-key' }, lbl.main),
                      el('span', { className: 'tn-plan-badge ' + (p.brokenEven ? 'ok' : 'warn') }, p.brokenEven ? t('brokenEven') : t('notBrokenEven'))),
                    lbl.sub ? el('div', { className: 'tn-plan-meta' }, lbl.sub) : null,
                    el('div', { className: 'tn-plan-meta' },
                      t('cycleRange') + ': ' + fmtDateTime(p.cycleStart) + ' ~ ' + fmtDateTime(p.cycleEnd)),
                    el('div', { className: 'tn-plan-meta' },
                      t('planResetModeLabel') + ': ' + (p.resetMode === 'monthly' ? t('resetModeMonthly') : t('resetModeDays', { days: fmt(p.periodDays) }))),
                    el('div', { className: 'tn-plan-row', style: { marginTop: '2px' } },
                      el('span', { className: 'tn-card-label', style: { margin: 0 } }, t('breakevenTitle')),
                      el('span', { className: 'tn-plan-bar' },
                        el('div', { className: 'tn-plan-fill' + (pct >= 100 ? ' over' : ''), style: { width: pct + '%' } })),
                      el('span', { className: 'tn-price-hint' }, t('planProgress', { used: fmtMoney(p.cycleCost, currencySymbol), fee: fmtMoney(p.fee, currencySymbol) }))),
                    el('div', { className: 'tn-plan-meta' }, t('planModelCostTitle')),
                    row.models.length === 0
                      ? el('div', { className: 'tn-plan-meta' }, t('empty'))
                      : el('div', { className: 'tn-plan-model' },
                        row.models.map((m) => el('span', { key: m.model, title: m.model },
                          modelDisplayName(m.model, catalog, modelNames, m.provider || row.key) + ': ' + fmtMoney(m.cost, currencySymbol) + ' · ' + fmt(m.tokens) + ' ' + t('tokensUnit')))),
                    el('div', { className: 'tn-plan-meta' },
                      t('tokensPerCreditLabel') + ' ' + (p.tokensPerCredit !== null ? fmt(Math.round(p.tokensPerCredit)) : '—') + ' ' + t('tokensUnit')),
                    p.prevCycle !== null
                      ? el('div', { className: 'tn-plan-meta' },
                        t('prevCycleLabel') + ': ' + fmt(p.prevCycle.tokens) + ' ' + t('tokensUnit') + ' / ' + fmtMoney(p.prevCycle.cost, currencySymbol) + ' / ' + t('planFee') + ' ' + fmtMoney(p.prevCycle.fee, currencySymbol))
                      : null,
                    // 0.3.4:429/402 待确认横幅(临时账本 + 续费/未续费入口)
                    p.pending !== null && p.pending !== undefined
                      ? el('div', { className: 'tn-pending' },
                        el('div', null, t('planPendingBanner')),
                        el('div', { className: 'tn-plan-meta' },
                          t('total') + ': ' + fmt(p.pending.tokens) + ' ' + t('tokensUnit') + ' · ' + t('money') + ' ' + fmtMoney(p.pending.cost, currencySymbol)),
                        el('div', { className: 'tn-pending-flow' },
                          el('button', { className: 'tn-btn', disabled: resetting === row.key, onClick: () => { void startResetFlow(row.key, 'renew') } }, t('planRenew')),
                          el('button', { className: 'tn-btn', disabled: resetting === row.key, onClick: () => { void startResetFlow(row.key, 'dismiss') } }, t('planNotRenew'))))
                      : null,
                    // 0.3.4:历史周期按钮(旧 TID 数据已冻结,点击展开查阅)
                    Array.isArray(p.cycles) && p.cycles.length > 0
                      ? el('div', { className: 'tn-plan-meta' },
                        el('details', { className: 'tn-details' },
                          el('summary', { className: 'tn-hist-toggle' }, t('planHistory') + ' (' + t('planHistoryTitle') + ')'),
                          el('div', { className: 'tn-hist-list' },
                            p.cycles.map((c, i) => el('div', { className: 'tn-hist-row', key: i },
                              t('planHistRow', {
                                start: fmtDateTime(c.start),
                                end: fmtDateTime(c.end),
                                fee: fmtMoney(c.fee, currencySymbol),
                                tokens: fmt(c.tokens),
                                cost: fmtMoney(c.cost, currencySymbol),
                              }))))))
                      : null,
                    el('div', { className: 'tn-plan-actions' },
                      resetFlow !== null && resetFlow.key === row.key
                        ? (resetFlow.mode === 'renew' || resetFlow.mode === 'dismiss')
                          ? el('div', { className: 'tn-reset-flow' },
                            el('div', { className: 'tn-reset-flow-hint' },
                              resetFlow.mode === 'renew' ? t('planRenewSummary') : t('planNoRenewConfirm')),
                            el('div', { className: 'tn-reset-flow-row' },
                              el('button', { className: 'tn-danger-btn', disabled: resetting === row.key, onClick: () => { void executeReset() } },
                                resetting === row.key ? t('resetting') : (resetFlow.mode === 'renew' ? t('planRenewConfirm') : t('planNoRenewConfirm'))),
                              el('button', { className: 'tn-btn tn-reset-cancel', onClick: () => cancelResetFlow() }, t('resetCancel'))))
                          : el('div', { className: 'tn-reset-flow' },
                            el('div', { className: 'tn-reset-flow-hint' },
                              resetFlow.mode === 'undo' ? t('undoCycleHint') : t('resetCycleHint'),
                              ' ' + t('resetCodeLabel') + ': ',
                              el('b', { className: 'tn-reset-code' }, resetFlow.code)),
                            el('div', { className: 'tn-reset-flow-row' },
                              el('input', {
                                className: 'tn-input tn-num-input',
                                type: 'number', min: 0, max: 9999, step: 1,
                                placeholder: t('resetCodePlaceholder'),
                                value: resetFlow.input,
                                onChange: (e) => { const v = e.target.value; setResetFlow((f) => (f === null ? f : { ...f, input: v.length > 4 ? v.slice(0, 4) : v })) },
                              }),
                              resetFlow.stage === 0
                                ? el('button', {
                                  className: 'tn-btn',
                                  disabled: resetFlow.input !== resetFlow.code,
                                  onClick: () => confirmResetStep(),
                                }, t('resetConfirmA'))
                                : el('button', {
                                  className: 'tn-danger-btn',
                                  onClick: () => { void executeReset() },
                                }, resetFlow.mode === 'undo' ? t('undoConfirmB') : t('resetConfirmB'))),
                            resetFlow.stage === 0
                              ? el('button', { className: 'tn-btn tn-reset-cancel', onClick: () => cancelResetFlow() }, t('resetCancel'))
                              : null)
                        : [
                          el('button', { className: 'tn-btn', disabled: resetting === row.key, onClick: () => { void startResetFlow(row.key, 'reset') } },
                            resetting === row.key ? t('resetting') : t('resetCycle')),
                          (undoKeys.has(row.key) && (api.hasUndoPlanCycle ? api.hasUndoPlanCycle() : false))
                            ? el('button', { className: 'tn-btn', disabled: resetting === row.key, onClick: () => { void startResetFlow(row.key, 'undo') } },
                              resetting === row.key ? t('undoing') : t('undoCycle'))
                            : null,
                        ]))
                })),

            // ── 第三部分:性价比计算(所有 Key·模型 一起排名比较) ──
            el('div', { className: 'tn-block-title', style: { marginTop: '10px' } }, t('ratioTitle')),
            el('p', { className: 'tn-block-note' }, t('ratioHint')),
            rankings.length > 0
              ? el('div', { className: 'tn-table-wrap', style: { marginTop: '4px' } },
                el('table', { className: 'tn-table' },
                  el('thead', null,
                    el('tr', null,
                      el('th', { className: 'num' }, t('rankColumn')),
                      el('th', null, t('keyModelColumn')),
                      el('th', null, t('ratioScopeColumn')),
                      el('th', { className: 'num' }, t('total')),
                      el('th', { className: 'num' }, t('spend')),
                      el('th', { className: 'num' }, t('tokensPerCny')))),
                  el('tbody', null,
                    rankings.map((r, i) => {
                      const lbl = providerRowLabel(r, (snap.config && Array.isArray(snap.config.providers)) ? snap.config.providers : [])
                      return el('tr', { key: r.key + '\u0000' + r.model },
                        el('td', { className: 'num' }, fmt(i + 1)),
                        el('td', null, lbl.main + ' · ', el('span', { title: r.model }, modelDisplayName(r.model, catalog, modelNames, r.key))),
                        el('td', null,
                          r.usingPrev ? t('prevCycleLabel') : t('cycleRange'),
                          r.collecting ? el('span', { className: 'tn-badge collecting', style: { marginLeft: '6px' } }, t('collecting')) : null),
                        el('td', { className: 'num', title: fmtExact(r.tokens) }, fmt(r.tokens)),
                        el('td', { className: 'num', title: fmtExact(r.amount) }, fmtMoney(r.amount, currencySymbol)),
                        el('td', { className: 'num', title: r.ratio > 0 ? fmtExact(r.ratio) : undefined }, r.ratio > 0 ? fmt(r.ratio) : '—'))
                    }))))
              : null,

            // ── 第四部分:每日费用消耗表 ──
            el('div', { className: 'tn-block-title', style: { marginTop: '10px' } }, t('dailyTitle')),
            el('p', { className: 'tn-block-note' }, t('dailyHint')),
            el('div', { className: 'tn-calendar' },
              weekHeaders.map((w, i) => el('div', { className: 'tn-cal-head', key: 'h' + i }, w)),
              calCells.map((c, i) => {
                if (c === null) return el('div', { className: 'tn-cal-cell out', key: 'e' + i }, '')
                const dayKey = fmtDateLocal(c.ts)
                const info = c.inRange ? dailyMap.get(dayKey) : undefined
                const bg = (c.inRange && info && info.cost > 0)
                  ? 'rgba(79,140,255,' + (0.10 + 0.80 * (maxDailyCost > 0 ? Math.min(1, info.cost / maxDailyCost) : 0)).toFixed(3) + ')'
                  : 'transparent'
                const isToday = dayKey === todayKey
                return el('div', {
                  className: 'tn-cal-cell' + (c.inRange ? '' : ' out') + (isToday ? ' today' : ''),
                  key: 'd' + i,
                  style: { background: bg },
                  title: c.inRange && info ? dayKey + ': ' + fmtMoney(info.cost, currencySymbol) + ' · ' + fmt(info.tokens) + ' ' + t('tokensUnit') : dayKey,
                  onMouseEnter: () => { if (c.inRange) setHoverDay(dayKey) },
                  onMouseLeave: () => setHoverDay(null),
                }, String(c.d))
              })),
            focusInfo !== null && focusInfo !== undefined
              ? el('div', { className: 'tn-block-note', style: { marginTop: '6px' } },
                '· ' + focusDay + ': ' + fmtMoney(focusInfo.cost, currencySymbol) + ' · ' + fmt(focusInfo.tokens) + ' ' + t('tokensUnit'))
              : null,
            el('p', { className: 'tn-block-note', style: { marginTop: '6px' } }, t('dailyScrollHint')),
            el('div', { className: 'tn-daily-scroll' },
              daily.map((d) => el('div', { className: 'tn-daily-day', key: d.date },
                el('div', { className: 'tn-daily-head' },
                  el('span', { className: 'tn-daily-date' }, d.date),
                  el('span', { className: 'tn-daily-total' }, fmtMoney(d.cost, currencySymbol) + ' · ' + fmt(d.tokens) + ' ' + t('tokensUnit'))),
                d.cost > 0
                  ? el('div', { className: 'tn-daily-stack' },
                    d.models.map((m, i) => el('div', {
                      className: 'tn-daily-seg',
                      key: i,
                      style: { width: (d.cost > 0 ? (m.cost / d.cost) * 100 : 0) + '%', background: dailyColor(m.model) },
                    })))
                  : null,
                d.models.map((m) => el('div', { className: 'tn-daily-model', key: m.model },
                  el('span', { className: 'tn-daily-dot', style: { background: dailyColor(m.model) } }),
                  el('span', { className: 'tn-daily-model-name', title: m.model }, modelDisplayName(m.model, catalog, modelNames)),
                  m.planWeighted ? el('span', { className: 'tn-badge weighted' }, t('weightedBadge')) : null,
                  m.pending ? el('span', { className: 'tn-badge pending' }, t('pendingBadge')) : null,
                  el('span', { title: fmtExact(m.tokens) }, fmt(m.tokens) + ' ' + t('tokensUnit')),
                  el('b', { title: fmtExact(m.cost) }, fmtMoney(m.cost, currencySymbol))))))))
          : null)
    }

    // ── 顶部提示横幅(0.3.6)─────────────────────────────────────────────────────
    // 注册于 shell.overlay(帧级浮层,所有页面常驻,页面顶部居中):
    //  ① 系统通知权限横幅:权限未授权(default)或被拒(denied)且系统通知开关
    //     开启时显示;点击横幅直接执行授权动作(requestPermission,需用户手势)。
    //  ② 模型价格横幅:「当前使用的模型」没有规定价格(未激活自定义且官方目录
    //     未收录,Provider 专属价也没有)时显示;点击直接弹出该模型的价格编辑
    //     弹窗(预填全局默认价),「保存并确定」即写入配置并立即生效。
    // 「使用的模型」= 最近一次完工通知帧的模型(实时)∪ 最近 7 天账本中最新
    // 使用且未定价的模型(刷新页面后仍能提示)。两条横幅均可 × 关闭(本次页面
    // 生命周期内不再出现);插件停用时不显示。

    function bannerPickModel(snap, probe) {
      const a = (snap && snap.lastModel && typeof snap.lastModel.model === 'string' && snap.lastModel.model !== '') ? snap.lastModel : null
      const b = (probe && typeof probe.model === 'string' && probe.model !== '') ? probe : null
      if (a === null) return b
      if (b === null) return a
      return (b.at || 0) > (a.at || 0) ? b : a
    }

    /**
     * 0.3.6:按背景亮度取前景色(YIQ)——浅底(≥140)深字、深底浅字。
     * 横幅背景是「强调色 × 主题底色」的 color-mix 混色,主题 label 色不保证
     * 与之形成对比;改为渲染后读实际背景色实时决定。解析失败返回 null(保留主题色)。
     */
    function contrastTextOf(bgColor) {
      const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(String(bgColor === undefined || bgColor === null ? '' : bgColor).trim())
      if (m === null) return null
      if (m[4] !== undefined && Number(m[4]) === 0) return null // 全透明背景无法判定,保留主题色
      const yiq = (Number(m[1]) * 299 + Number(m[2]) * 587 + Number(m[3]) * 114) / 1000
      return yiq >= 140 ? '#1f1f1f' : '#fff'
    }

    function TopBannerHost(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [perm, setPerm] = React.useState(notifyState)
      // 官方价目录(0.3.7:apply 全局加载一次,经 store 快照下发;含模型显示名)
      const catalog = snap.catalog
      // 模型显示名索引(0.3.7 修复):全局模型设置里该 Provider 下该模型的自定义显示名
      const modelNames = modelNameIndexOf(snap.config && snap.config.providers)
      const [probe, setProbe] = React.useState(null) // { model, at }:账本里最新使用且未定价的模型
      const [dismissPerm, setDismissPerm] = React.useState(false)
      const [dismissPrice, setDismissPrice] = React.useState(false)
      const [editing, setEditing] = React.useState(null) // { model }:价格编辑弹窗
      const [draft, setDraft] = React.useState({})
      const [busy, setBusy] = React.useState(false)
      const [saved, setSaved] = React.useState(false)
      const [err, setErr] = React.useState(null)
      const [permBusy, setPermBusy] = React.useState(false) // 0.3.6:正在请求授权
      const [permAsked, setPermAsked] = React.useState(false) // 0.3.6:已发起过授权请求(识别「关闭未选择」)
      // 0.3.6:横幅字色实时对比 —— 渲染后读实际背景色决定字色(见 contrastTextOf)
      const permBannerRef = React.useRef(null)
      const priceBannerRef = React.useRef(null)
      const applyBannerContrast = () => {
        for (const ref of [permBannerRef, priceBannerRef]) {
          const node = ref.current
          if (node === null || node === undefined) continue
          let fg = null
          try { fg = contrastTextOf(getComputedStyle(node).backgroundColor) } catch { fg = null }
          if (fg !== null) node.style.setProperty('--tn-banner-fg', fg)
        }
      }
      React.useEffect(() => {
        applyBannerContrast()
        // 主题快照由官方 theme presenter 投影到 document.body 的 style 上;
        // 观察其变化即主题切换时实时重算(每次渲染后本 effect 也会重跑一遍)。
        try {
          const observer = new MutationObserver(applyBannerContrast)
          observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })
          observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
          return () => observer.disconnect()
        } catch { /* 无 MutationObserver 环境退化为每次渲染重算 */ }
      })

      // 权限状态随页面可见性 / 聚焦刷新(权限变化无事件通知,低频重查即可)
      React.useEffect(() => {
        const refresh = () => setPerm(notifyState())
        document.addEventListener('visibilitychange', refresh)
        window.addEventListener('focus', refresh)
        return () => {
          document.removeEventListener('visibilitychange', refresh)
          window.removeEventListener('focus', refresh)
        }
      }, [])

      const cfg = snap.config || null
      const pricing = (cfg && cfg.pricing) || null
      const currency = pricing === null || pricing.currency !== '$' ? '¥' : '$'

      /** 模型是否已有规定价格:自定义集体价 / Provider 专属价 / 官方目录任一命中(0.3.7:大小写不敏感)。 */
      const modelHasPrice = (model) => {
        if (typeof model !== 'string' || model === '') return true
        const row = (pricing && pricing.models) ? savedModelRow(pricing, model) : null
        if (row && row.enabled === true) return true
        if (row && row.providers && typeof row.providers === 'object') {
          for (const pid of Object.keys(row.providers)) {
            const pv = row.providers[pid]
            if (pv && pv.useCollective === false && pv.price && Object.keys(pv.price).length > 0) return true
          }
        }
        return officialBaseOf(lookupClientModel(model, catalog), currency) !== null
      }

      // 最近 7 天账本里最新使用且未定价的模型(刷新页面后仍能提示);
      // 价格配置 / 目录变化后重查(保存某个模型的价格后自动换下一个或消失)
      React.useEffect(() => {
        if (cfg === null) return
        let alive = true
        void (async () => {
          try {
            const res = await api.getUsageEntries(Date.now() - 7 * 24 * 60 * 60 * 1000, Date.now())
            if (!alive) return
            if (res === null || typeof res !== 'object' || res.ok !== true || !res.value || !Array.isArray(res.value.entries)) return
            for (const entry of res.value.entries) { // 服务端已按时间倒序
              if (entry && typeof entry.model === 'string' && entry.model !== '' && entry.model !== 'unknown' && !modelHasPrice(entry.model)) {
                setProbe({ model: entry.model, provider: typeof entry.provider === 'string' ? entry.provider : '', at: Number(entry.at) > 0 ? Number(entry.at) : 0 })
                return
              }
            }
            setProbe(null)
          } catch { /* 旧宿主无该 RPC:仅靠完工帧的实时信号 */ }
        })()
        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [cfg === null ? '' : JSON.stringify(pricing), catalog])

      const healthOk = !(snap.health && snap.health.enabled === false)
      const showPermBanner = healthOk && !dismissPerm && cfg !== null && cfg.webNotify !== false && (perm === 'default' || perm === 'denied')
      const picked = bannerPickModel(snap, probe)
      const priceModel = catalog !== null && picked !== null && !modelHasPrice(picked.model) ? picked.model : null
      const showPriceBanner = healthOk && !dismissPrice && priceModel !== null

      // 点击权限横幅:直接执行索权动作(点击即用户手势)。
      // 0.3.6:任何结局都可见 —— requestPermission 关闭弹窗未选择时返回 default,
      // 此前页面侧毫无变化(「点了没反应」的静默根因);现等待中立即变文案,
      // 关闭未选择后明确提示。授权成功仍直发系统通知回执(不经 showNativeNotify,
      // 其「仅后台时发送」会在页面可见时把这条压掉)。
      const onPermClick = async () => {
        if (permBusy) return
        setPermBusy(true)
        try {
          const state = await requestNotifyPermission()
          setPerm(notifyState())
          setPermAsked(true)
          if (state === 'granted') {
            try { await api.updateConfig({ webNotify: true }) } catch { /* 失败保持现状 */ }
            try {
              const n = new window.Notification(t('bannerPermGrantedTitle'), { body: t('bannerPermGrantedBody'), tag: 'dsh-task-notice-perm-ok' })
              n.onclick = () => { try { window.focus() } catch { /* ignore */ } try { n.close() } catch { /* ignore */ } }
            } catch { /* 系统拒绝时静默 */ }
          }
        } finally {
          setPermBusy(false)
        }
      }

      const openPriceModal = (model) => {
        const prefill = {}
        const def = (pricing && pricing.default) || {}
        for (const k of PRICE_KEY_LIST) {
          const v = def[k]
          if (v !== undefined && v !== null && v !== '') prefill[k] = v
        }
        setDraft(prefill)
        setErr(null)
        setSaved(false)
        // provider 只用于取该模型的显示名(全局模型设置里按 Provider 配置)
        const hit = (snap.config && Array.isArray(snap.config.providers) ? snap.config.providers : [])
          .find((p) => p && Array.isArray(p.models) && p.models.some((m) => (typeof m === 'string' ? m : (m !== null && typeof m === 'object' ? m.id : '')) === model))
        setEditing({ model, provider: hit ? hit.id : '' })
      }

      // 「保存并确定」:合入现有 pricing(其余模型 / 峰谷 / Provider 子价不动),
      // 经 updateConfig 落盘并立即生效;横幅条件随新配置自动消失。
      const onSavePrice = async () => {
        if (editing === null) return
        setBusy(true)
        setErr(null)
        try {
          const base = pricing || { currency: '¥', default: {}, models: {} }
          const models = { ...(base.models || {}) }
          const prev = models[editing.model] || {}
          models[editing.model] = { ...prev, enabled: true, price: cleanPrice(draft) }
          await api.updateConfig({ pricing: { ...base, models } })
          setSaved(true)
          window.setTimeout(() => { setEditing(null); setSaved(false) }, 900)
        } catch (error) {
          setErr(String(error && error.message ? error.message : error))
        } finally {
          setBusy(false)
        }
      }

      if (!showPermBanner && !showPriceBanner && editing === null) return null
      return el('div', { className: 'tn-banner-host' },
        showPermBanner
          ? el('div', {
            className: 'tn-banner perm' + (perm === 'denied' ? ' denied' : ''),
            ref: permBannerRef,
            role: 'button', tabIndex: 0,
            onClick: () => { void onPermClick() },
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void onPermClick() } },
          },
            el('span', { className: 'tn-banner-icon' }, '🔔'),
            el('span', { className: 'tn-banner-text' },
              permBusy ? t('bannerPermRequesting')
                : perm === 'denied' ? t('bannerPermDeniedText')
                : permAsked && perm === 'default' ? t('bannerPermDismissed')
                : t('bannerPermText')),
            el('button', {
              className: 'tn-banner-close', 'aria-label': t('close'),
              onClick: (e) => { e.stopPropagation(); setDismissPerm(true) },
            }, '×'))
          : null,
        showPriceBanner
          ? el('div', {
            className: 'tn-banner price',
            ref: priceBannerRef,
            role: 'button', tabIndex: 0,
            onClick: () => openPriceModal(priceModel),
            onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPriceModal(priceModel) } },
          },
            el('span', { className: 'tn-banner-icon' }, '💰'),
            el('span', { className: 'tn-banner-text', title: priceModel }, t('bannerPriceText', { model: modelDisplayName(priceModel, catalog, modelNames, picked !== null ? picked.provider : '') })),
            el('button', {
              className: 'tn-banner-close', 'aria-label': t('close'),
              onClick: (e) => { e.stopPropagation(); setDismissPrice(true) },
            }, '×'))
          : null,
        editing !== null
          ? el('div', {
            className: 'tn-modal-mask',
            onClick: (e) => { if (e.target === e.currentTarget) setEditing(null) },
          },
            el('div', { className: 'tn-modal' },
              el('div', { className: 'tn-modal-title', title: editing.model }, t('bannerPriceEditTitle', { model: modelDisplayName(editing.model, catalog, modelNames, editing.provider) })),
              el('p', { className: 'tn-price-hint' }, t('bannerPriceModalHint', { currency })),
              PriceFields({ values: draft, onChange: (k, v) => setDraft((prev) => ({ ...prev, [k]: v })) }),
              err ? el('p', { className: 'tn-err' }, t('error', { error: err })) : null,
              el('div', { className: 'tn-save-row' },
                el('button', {
                  className: 'tn-btn',
                  disabled: busy || Object.keys(cleanPrice(draft)).length === 0,
                  onClick: () => { void onSavePrice() },
                }, saved ? t('savedOk') : t('bannerPriceSave')),
                el('button', { className: 'tn-btn', disabled: busy, onClick: () => setEditing(null) }, t('cancel')))))
          : null)
    }

    // ── 插件主体 ────────────────────────────────────────────────────────────

    // 0.3.5:uiSession / slots 一并声明。此前 apply 里是一次性 ctx.get():
    // 若插件先于服务就绪而加载,操作提醒监听(授权/提问)或弹窗插槽注册会被
    // 静默跳过,该页面生命周期内不再弹任何通知(偶发失效的来源之一)。
    // 声明 inject 后由 Cordis 停靠等待服务就绪再激活(与官方 UI 插件一致)。
    const inject = ['remote', 'uiSession', 'slots']

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

      const store = createStore({ status: 'loading', health: null, config: null, error: null, notifications: [], catalog: null })

      // config 未就绪(启动瞬间)时按默认值兜底,与宿主 CONFIG_DEFAULTS 保持一致
      const DEFAULT_CFG = { webNotify: true, webNotifyBackgroundOnly: true, notifyOnTurn: true, notifyOnGoal: true, notifyOnApproval: true, notifyOnQuestion: true, pricing: { currency: '¥', default: {}, models: {} }, plans: {}, peak: { enabled: true, windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }], weekdaysOnly: true, boundaryMs: Date.parse('2026-08-16T16:00:00Z') }, providers: [] }

      // 统一入口:入队页内弹窗队列 + 按配置发送系统通知(Web Notifications)。
      // 0.3.6:turn 帧顺带记录「最近使用的模型」(顶部横幅「未定价模型」的实时数据源)。
      const pushFrame = (frame) => {
        const cur = store.get()
        const next = { ...cur, notifications: [...(cur.notifications || []), frame].slice(-20) }
        if (frame !== null && typeof frame === 'object' && frame.type === 'turn' && typeof frame.model === 'string' && frame.model !== '') {
          next.lastModel = {
            model: frame.model,
            provider: typeof frame.provider === 'string' ? frame.provider : '',
            at: (typeof frame.atMs === 'number' && frame.atMs > 0) ? frame.atMs : Date.now(),
          }
        }
        store.set(next)
        showNativeNotify(frame, cur.config || DEFAULT_CFG)
      }

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

      // 0.3.7:官方价目录全局加载一次(模型显示名 / 价格编辑 / 顶部横幅共用),
      // 各视图不再各自拉取目录
      void (async () => {
        try {
          const res = await taskNotice.getPriceCatalog()
          if (res !== null && typeof res === 'object' && res.ok === true && res.value && typeof res.value === 'object') {
            store.set({ ...store.get(), catalog: res.value })
          }
        } catch { /* 目录不可用时显示名回退模型 ID */ }
      })()

      // 通知流:任务完成帧推入 store,由弹窗浮层渲染。流结束(连接断开等)
      // 后允许重拉;pumping 守卫防止并发双订阅导致重复帧。
      const controller = new AbortController()
      let pumping = false
      const pump = async () => {
        if (pumping) return
        pumping = true
        try {
          for await (const frame of taskNotice.subscribeNotifications(controller.signal)) {
            if (frame === null || typeof frame !== 'object') continue
            pushFrame(frame)
          }
        } catch (error) {
          console.warn('[dsh-task-notice] 通知流结束: ' + String(error && error.message ? error.message : error))
        } finally {
          pumping = false
        }
      }
      void pump()
      ctx.effect(() => () => controller.abort(), 'dsh-task-notice: notify stream')

      // 0.3.5:断线重连时重拉通知流——此前流一旦随连接断开结束就不再重订阅,
      // 重连后完工 / Token Plan 通知静默失效,直到刷新页面。
      ctx.effect(() => ctx.on('connection/reset', () => { void reload(); void pump() }), 'dsh-task-notice: reconnect reload')

      // ── 操作提醒:权限请求 / 用户提问 ──────────────────────────────────────
      // 注意:approval/request 与 user-questions/request 是 agent 作用域上的
      // waterfall 应答事件——任何监听者若不调用 next() 就会截断应答链,导致
      // 提问/授权对话框不再出现(0.2.0 曾因此回归)。所以这里**绝不**在
      // ctx.remote.$on 上注册监听;改为订阅官方 UI 的只读待处理交互存储
      // uiSession.pendingInteractions:请求到达时由审批/提问 UI 发布进来、
      // 回答/关闭后自动移除。我们只读快照、订阅变化,完全不参与应答链。
      //
      // 0.3.5 去重身份:官方交互对象自带每请求唯一的 key(question:N /
      // approval:N)。此前用内容签名(问题 id 拼接 / 工具名+原因)做去重键,
      // 而问题 id 是模型自选、复用极常见——回答后 60 秒内换汤不换药地再次
      // 提问会被静默吞掉(0.3.4「偶发不弹通知」的根因)。内容签名只保留作
      // 跨标签页系统通知的 dedupeKey(各标签页计数器独立,帧 id 不再一致)。
      const interactionSeen = new Map()
      const clipText = (value, n) => {
        const s = String(value ?? '').replace(/\s+/g, ' ').trim()
        return s.length > n ? s.slice(0, n) + '…' : s
      }

      const describePending = (interaction) => {
        if (interaction === null || typeof interaction !== 'object') return null
        // dedupeKey:跨标签页稳定的内容签名(供系统通知跨页去重);
        // key:本页去重身份——优先用交互对象自带的每请求唯一 key。
        const ownKey = typeof interaction.key === 'string' && interaction.key !== '' ? interaction.key : null
        if (Array.isArray(interaction.questions) && interaction.questions.length > 0) {
          const qs = interaction.questions.filter((q) => q !== null && typeof q === 'object' && (typeof q.question === 'string' || typeof q.header === 'string'))
          if (qs.length === 0) return null
          const ids = qs.map((q, i) => (typeof q.id === 'string' && q.id !== '' ? q.id : String(i))).join(',')
          const sid = typeof interaction.sessionId === 'string' && interaction.sessionId !== '' ? interaction.sessionId : ''
          const first = clipText(((typeof qs[0].header === 'string' && qs[0].header !== '' ? qs[0].header + ' ' : '') + (typeof qs[0].question === 'string' ? qs[0].question : '')).trim(), 110)
          const summary = qs.length > 1 ? first + ' · ' + t('questionMore', { count: qs.length }) : first
          // 签名并入首题文本:仅复用 id、文本不同的新提问不再被跨页去重吞掉横幅
          const sig = 'pend:q:' + sid + ':' + ids + ':' + clipText(first, 60)
          const key = ownKey !== null ? 'pend:' + ownKey : sig
          return { type: 'question', key, frame: { id: key, dedupeKey: sig, type: 'question', atMs: Date.now(), title: t('questionTitle'), summary: clipText(summary, 170), tokens: {}, total: 0, key: null } }
        }
        const toolName = typeof interaction.toolName === 'string' ? interaction.toolName : ''
        const reason = (typeof interaction.reason === 'string' && interaction.reason.trim() !== '')
          ? interaction.reason
          : (toolName !== '' ? t('approvalSummary', { toolName }) : '')
        if (reason === '' && toolName === '') return null
        const sid = typeof interaction.sessionId === 'string' && interaction.sessionId !== '' ? interaction.sessionId : ''
        const sig = 'pend:a:' + sid + ':' + ((typeof interaction.callId === 'string' && interaction.callId !== '') ? interaction.callId : (toolName + ':' + reason))
        const key = ownKey !== null ? 'pend:' + ownKey : sig
        return { type: 'approval', key, frame: { id: key, dedupeKey: sig, type: 'approval', atMs: Date.now(), title: t('approvalTitle'), summary: clipText(reason, 150), tokens: {}, total: 0, key: null } }
      }

      const notifyPending = () => {
        const cfg = store.get().config || DEFAULT_CFG
        const pending = ctx.get('uiSession')
        if (pending === undefined || pending === null || typeof pending.pendingInteractions !== 'object' || pending.pendingInteractions === null) return
        const snap = pending.pendingInteractions.getSnapshot()
        if (snap === undefined || snap === null || typeof snap.values !== 'function') return
        const now = Date.now()
        const present = new Set()
        for (const interaction of snap.values()) {
          const info = describePending(interaction)
          if (!info) continue
          present.add(info.key)
          if (info.type === 'approval' && cfg.notifyOnApproval === false) continue
          if (info.type === 'question' && cfg.notifyOnQuestion === false) continue
          const last = interactionSeen.get(info.key)
          if (last !== undefined && now - last < 60000) continue
          interactionSeen.set(info.key, now)
          pushFrame(info.frame)
        }
        // 请求已离开待处理列表(已回答/已关闭)→ 清出去重表:
        // 之后即使内容签名相同(模型复用问题 id)的新请求也必定再提醒
        for (const k of interactionSeen.keys()) {
          if (!present.has(k)) interactionSeen.delete(k)
        }
      }

      const pendingWatch = ctx.get('uiSession')
      if (pendingWatch !== undefined && pendingWatch !== null && typeof pendingWatch.pendingInteractions === 'object' && pendingWatch.pendingInteractions !== null
        && typeof pendingWatch.pendingInteractions.getSnapshot === 'function' && typeof pendingWatch.pendingInteractions.subscribe === 'function') {
        const onPendingChange = () => { try { notifyPending() } catch { /* ignore */ } }
        const offPending = pendingWatch.pendingInteractions.subscribe(onPendingChange)
        // 监听建立前已挂起的请求(如页面重连后仍在等待回答)也补一次提醒
        try { onPendingChange() } catch { /* ignore */ }
        ctx.effect(() => () => { try { offPending() } catch { /* ignore */ } }, 'dsh-task-notice: pending watch')
      }

      const api = {
        reload,
        getUsageStats: (fromMs, toMs) => taskNotice.getUsageStats(fromMs, toMs),
        getUsageEntries: (fromMs, toMs) => taskNotice.getUsageEntries(fromMs, toMs),
        getUsageAnalysis: (fromMs, toMs) => taskNotice.getUsageAnalysis(fromMs, toMs),
        resetPlanCycle: (key, fromMs, toMs) => taskNotice.resetPlanCycle(key, fromMs, toMs),
        hasUndoPlanCycle: () => typeof taskNotice.undoPlanCycle === 'function',
        undoPlanCycle: (key, fromMs, toMs) => taskNotice.undoPlanCycle(key, fromMs, toMs),
        renewPlanCycle: (key, planChanged, fromMs, toMs) => taskNotice.renewPlanCycle(key, planChanged, fromMs, toMs),
        dismissPlanPending: (key, fromMs, toMs) => taskNotice.dismissPlanPending(key, fromMs, toMs),
        getHealth: () => taskNotice.getHealth(),
        getConfig: () => taskNotice.getConfig(),
        getPriceCatalog: () => taskNotice.getPriceCatalog(),
        hasProviderDirectory: () => typeof taskNotice.getProviderDirectory === 'function',
        getProviderDirectory: async () => {
          if (typeof taskNotice.getProviderDirectory !== 'function') throw new Error('宿主服务尚未加载 Provider 目录功能(remote.taskNotice.getProviderDirectory 不存在),请重启 DSH 后重试')
          const result = await taskNotice.getProviderDirectory()
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed: getProviderDirectory')
          }
          return result.value
        },
        refreshProviderDirectory: async () => {
          if (typeof taskNotice.refreshProviderDirectory !== 'function') throw new Error('宿主服务尚未加载 Provider 目录重置功能,请重启 DSH 后重试')
          const result = await taskNotice.refreshProviderDirectory()
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed: refreshProviderDirectory')
          }
          return result.value
        },
        deleteProviderId: async (id) => {
          if (typeof taskNotice.deleteProviderId !== 'function') throw new Error('宿主服务尚未加载 Provider 删除功能,请重启 DSH 后重试')
          const result = await taskNotice.deleteProviderId(id)
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed: deleteProviderId')
          }
          return result.value
        },
        hasClearUsage: () => typeof taskNotice.clearUsage === 'function',
        clearUsage: async () => {
          if (typeof taskNotice.clearUsage !== 'function') {
            throw new Error('宿主服务尚未加载清除功能(remote.taskNotice.clearUsage 不存在),请重启 DSH 后重试')
          }
          const result = await taskNotice.clearUsage()
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            throw new Error((result && result.error && result.error.message) ? result.error.message : 'RPC failed: clearUsage')
          }
          return result.value
        },
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

      // 0.3.6 顶部提示横幅(shell.overlay 帧级浮层:通知权限 / 未定价模型 + 价格编辑弹窗)
      try {
        slots.inject('shell.overlay', () => {
          const dispose = slots.register(
            { name: 'shell.overlay', id: 'task-notice-top-banner', order: 10 },
            withRuntime(TopBannerHost),
          )
          return dispose
        })
      } catch (error) {
        console.warn('[dsh-task-notice] 顶部横幅插槽注册失败: ' + String(error && error.message ? error.message : error))
      }

      // 设置页分节:消耗统计 + 价格编辑(0.3.1 独立页面)
      const registerSection = (id, order, label, Component) => {
        try {
          slots.inject('settings.section', () => {
            const dispose = slots.register(
              { name: 'settings.section', id, order, label },
              withRuntime(Component),
            )
            return dispose
          })
        } catch (error) {
          console.warn('[dsh-task-notice] 设置分节注册失败: ' + String(error && error.message ? error.message : error))
        }
      }
      // 价格编辑为页内顶部导航切换(0.3.1),不另开设置分节
      registerSection('task-notice', 40, t('sectionLabel'), StatsSection)
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
