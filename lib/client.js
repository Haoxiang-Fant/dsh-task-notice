/**
 * dsh-task-notice 浏览器端 bundle(单文件,经 __ModuleLoader__ 加载)。
 *
 * 提供三块界面:
 *  - 完工通知弹窗:常驻 sidebar.footer.action 插槽内的 fixed 浮层队列,消费
 *    remote.taskNotice.subscribeNotifications 流,展示任务完成与本次消耗的
 *    tokens(缓存输入 / 缓外输入 / 输出)与金额,自动消失时长可配。
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
      // 顶部导航栏(0.3.1:消耗统计 ⇄ 价格编辑)
      '.tn-tabs{display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1,var(--dsh-alias-border-l1,#333));padding-bottom:8px;flex-wrap:wrap}',
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
      '.tn-daily-model-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tn-daily-model b{color:var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee));font-variant-numeric:tabular-nums}',
      '.tn-badge.weighted{color:#ff9800;border-color:#ff9800}',
      '.tn-badge.collecting{color:var(--dsw-alias-state-info-primary,#3b82f6);border-color:var(--dsw-alias-state-info-primary,#3b82f6)}',
      '.tn-btn:disabled{opacity:.5;cursor:not-allowed}',
      // 设置页:清除记录数据(0.3.1)
      '.tn-settings-section{display:flex;flex-direction:column;gap:16px}',
      '.tn-clear-panel{border:1px solid var(--dsw-alias-state-error-primary,#e05b5b);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e05b5b) 6%,transparent)}',
      '.tn-clear-title{font-size:13px;font-weight:600;color:var(--dsw-alias-state-error-primary,#e05b5b)}',
      '.tn-clear-steps{font-size:12px;color:var(--dsw-alias-label-secondary,var(--dsh-alias-label-secondary,#bbb));line-height:1.8;margin:0}',
      '.tn-clear-code{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:20px;letter-spacing:5px;font-weight:700;color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-bg-base,#141414);border:1px dashed var(--dsw-alias-border-l1,#333);border-radius:8px;padding:6px 12px;user-select:all;display:inline-block}',
      '.tn-danger-btn{font:inherit;font-size:12px;color:#fff;background:var(--dsw-alias-state-error-primary,#e05b5b);border:1px solid transparent;border-radius:8px;padding:5px 14px;cursor:pointer}',
      '.tn-danger-btn:hover{filter:brightness(1.1)}',
      '.tn-danger-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.tn-clear-ok{font-size:12px;color:var(--dsw-alias-state-ok-primary,#3ba272)}',
      '.tn-clear-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#e05b5b)}',
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
        savedOk: '已保存',
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
        // 使用分析页(0.3.1)
        analysisTab: '使用分析',
        // 设置页(0.3.1):顶部导航「设置」,含插件配置 + 清除记录数据
        settingsTab: '设置',
        settingsSectionTitle: '插件配置',
        clearDataTitle: '清除记录数据',
        clearDataDesc: '删除全部 Token 消耗统计账本(usage.json)。此操作不可撤销:清除后「消耗统计」「使用分析」与完工通知金额全部归零,价格、套餐与峰谷配置不受影响。',
        clearStep1: '① 将下方滑条从左拖到最右',
        clearStep2: '② 输入右侧随机验证码(8 位英文数字,区分大小写)',
        clearStep3: '③ 连续点击两次「确认清除」',
        clearCodeLabel: '验证码',
        clearCodeRefresh: '换一个',
        clearCodePlaceholder: '输入上方 8 位验证码',
        clearCodeMismatch: '验证码不正确,请重新输入。',
        clearSlideFirst: '请先将滑条拖到最右端。',
        clearReady: '已就绪 — 请输入验证码',
        clearNotReady: '未就绪 — 请将滑条拖到最右端',
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
        noPlan: '暂无设置为 Token Plan 的 Key(可在「价格编辑」页勾选订阅)。',
        ratioTitle: '性价比计算',
        ratioHint: '1 元(CNY)能兑换多少 tokens = 消耗 Token 总数 ÷ 消耗金额;所有模型的 (Key · 模型) 一起排名比较。Token Plan 的模型按「订阅费 × 该模型 tokens ÷ 周期总 tokens」加权平均分配额度(基于 Tokens 消耗摊薄订阅费用),优先用上一轮计费周期,没有上一轮数据时用当前周期并标注「正在统计」。',
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
        brand: '品牌',
        modelColumn: '模型',
        tokensPerCny: 'tokens/元',
        spend: '金额',
        dayOfWeekHeaders: ['一', '二', '三', '四', '五', '六', '日'],
        planStartAtLabel: '套餐起效时间',
        planValidityLabel: '有效期(天)',
        planResetModeLabel: '自动重置',
        planResetModeDays: '按天数(默认 31 天)',
        planResetModeMonthly: '每月 1 号(UTC+0)',
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
        savedOk: 'Saved',
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
        // Usage analysis page (0.3.1)
        analysisTab: 'Analysis',
        settingsTab: 'Settings',
        settingsSectionTitle: 'Plugin settings',
        clearDataTitle: 'Clear usage records',
        clearDataDesc: 'Deletes the entire token-usage ledger (usage.json). This cannot be undone: after clearing, Usage, Analysis and completion-notification costs all reset to zero. Prices, plans and peak/off-peak config are kept.',
        clearStep1: '① Drag the slider below all the way to the right',
        clearStep2: '② Type the random 8-character code (letters & digits, case-sensitive)',
        clearStep3: '③ Click “Confirm clear” twice',
        clearCodeLabel: 'Code',
        clearCodeRefresh: 'Regenerate',
        clearCodePlaceholder: 'Enter the 8-character code above',
        clearCodeMismatch: 'Incorrect code — please re-enter.',
        clearSlideFirst: 'Drag the slider all the way to the right first.',
        clearReady: 'Armed — enter the code',
        clearNotReady: 'Not armed — drag the slider to the right',
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
        resetting: 'Resetting…',
        cycleRange: 'Current cycle',
        prevCycleLabel: 'Previous',
        resetModeDays: 'Every {days} days',
        resetModeMonthly: 'Auto-reset on the 1st (UTC+0)',
        planEffectiveAt: 'Plan start',
        planExpireAt: 'Cycle ends',
        tokensPerCreditLabel: '1 Credit ≈',
        planModelCostTitle: 'Per-model cost (current cycle)',
        noPlan: 'No key is set as Token Plan yet (enable it on the “Price editor” tab).',
        ratioTitle: 'Cost-performance',
        ratioHint: 'Tokens per 1 CNY = total tokens consumed ÷ money spent; all models (key · model) are ranked together. Token Plan models are allocated the subscription fee by a token-weighted average (fee × model tokens ÷ cycle tokens); the previous billing cycle is preferred, otherwise the current cycle is used and marked “collecting”.',
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
        brand: 'Brand',
        modelColumn: 'Model',
        tokensPerCny: 'tokens/CNY',
        spend: 'Spent',
        dayOfWeekHeaders: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        planStartAtLabel: 'Plan start time',
        planValidityLabel: 'Validity (days)',
        planResetModeLabel: 'Auto reset',
        planResetModeDays: 'By days (default 31)',
        planResetModeMonthly: '1st of month (UTC+0)',
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

    /** 金额显示:币种 + 4 位有效数字(与宿主 pricing.js 一致)。 */
    function fmtMoney(value, currency) {
      const cur = currency === '$' ? '$' : '¥'
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
      try {
        return cur + new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format(n)
      } catch {
        return cur + n.toFixed(4)
      }
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
      // 跨标签页去重:hub 会向每个打开的标签页推送同一帧,避免操作中心重复
      try {
        const key = 'dsh-task-notice:notified:' + String(frame.id ?? '')
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
            el('span', { className: 'tn-popup-token' }, t('cacheIn'), el('b', null, fmt(tokens.cacheIn))),
            el('span', { className: 'tn-popup-token' }, t('cacheOut'), el('b', null, fmt(tokens.cacheOut))),
            el('span', { className: 'tn-popup-token' }, t('output'), el('b', null, fmt(tokens.output))),
            el('span', { className: 'tn-popup-token' }, t('total'), el('b', null, fmt(frame.total))),
            typeof frame.cost === 'number' && frame.cost > 0
              ? el('span', { className: 'tn-popup-token' }, t('money'), el('b', null, fmtMoney(frame.cost, frame.currency || '¥')))
              : null)
          : null,
        usageFrame && frame.key ? el('div', { className: 'tn-popup-key' }, t('key') + ': ' + frame.key) : null)
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

    /** 价格输入网格:5 个价格字段(留空 = 继承上一层价格)。 */
    function PriceFields({ values, onChange }) {
      const el = React.createElement
      const FIELDS = [['cacheIn', 'cacheIn'], ['cacheOut', 'cacheOut'], ['output', 'output'], ['cacheWrite', 'cacheWrite'], ['reasoning', 'reasoning']]
      return el('div', { className: 'tn-price-grid' },
        FIELDS.map(([k, labelKey]) => el('label', { className: 'tn-price-field', key: k },
          el('span', null, t(labelKey)),
          el('input', {
            className: 'tn-input tn-num-input',
            type: 'number', min: 0, step: 'any',
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
      // 清除账本后 +1,驱动统计 / 分析 / 价格编辑视图自动刷新
      const [clearVersion, setClearVersion] = React.useState(0)


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

      return el('div', { className: 'tn-section' },
        // 顶部导航栏:消耗统计 ⇄ 价格编辑 ⇄ 使用分析(0.3.1)
        el('div', { className: 'tn-tabs' },
          el('button', { className: 'tn-tab' + (view === 'stats' ? ' active' : ''), onClick: () => setView('stats') }, t('usageStatsTab')),
          el('button', { className: 'tn-tab' + (view === 'pricing' ? ' active' : ''), onClick: () => setView('pricing') }, t('pricePageTitle')),
          el('button', { className: 'tn-tab' + (view === 'analysis' ? ' active' : ''), onClick: () => setView('analysis') }, t('analysisTab')),
          el('button', { className: 'tn-tab' + (view === 'settings' ? ' active' : ''), onClick: () => setView('settings') }, t('settingsTab'))),
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

        view === 'pricing'
          ? el(PricingSection, { hooks: props.hooks, api, clearVersion })
          : view === 'analysis'
            ? el(AnalysisSection, { hooks: props.hooks, api, clearVersion })
            : view === 'settings'
              ? el(SettingsSection, { hooks: props.hooks, api, onCleared: () => setClearVersion((v) => v + 1) })
              : el('div', { className: 'tn-stats-body' },
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
            el('div', { className: 'tn-card-value' }, stats ? fmt(stats.totals.output) : '—')),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('costChip')),
            el('div', { className: 'tn-card-value' }, stats ? fmtMoney(stats.totals.cost, currency) : '—'))),

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
                    el('td', { className: 'num' }, fmt(total)),
                    el('td', { className: 'num' }, fmtMoney(row.cost, currency)))
                }),
                el('tr', { className: 'tn-row-total' },
                  el('td', null, t('total')),
                  el('td', null, ''),
                  el('td', { className: 'num' }, fmt(stats.calls)),
                  el('td', { className: 'num' }, fmt(stats.totals.cacheIn)),
                  el('td', { className: 'num' }, fmt(stats.totals.cacheOut)),
                  el('td', { className: 'num' }, fmt(stats.totals.output)),
                  el('td', { className: 'num' }, fmt(stats.totals.cacheIn + stats.totals.cacheOut + stats.totals.output + stats.totals.cacheWrite + stats.totals.reasoning)),
                  el('td', { className: 'num' }, fmtMoney(stats.totals.cost, currency))))))
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
                  el('td', null, m.label),
                  el('td', { className: 'num' }, fmt(m.calls)),
                  el('td', { className: 'num' }, fmt(m.cacheIn)),
                  el('td', { className: 'num' }, fmt(m.cacheOut)),
                  el('td', { className: 'num' }, fmt(m.output)),
                  el('td', { className: 'num' }, fmt(m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning)),
                  el('td', { className: 'num' }, fmtMoney(m.cost, currency)))),
                el('tr', { className: 'tn-row-total' },
                  el('td', null, t('total')),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.calls, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.cacheIn, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.cacheOut, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.output, 0))),
                  el('td', { className: 'num' }, fmt(modelRows.reduce((a, m) => a + m.cacheIn + m.cacheOut + m.output + m.cacheWrite + m.reasoning, 0))),
                  el('td', { className: 'num' }, fmtMoney(modelRows.reduce((a, m) => a + (m.cost || 0), 0), currency))))))
          : null,
        el('p', { className: 'tn-note' }, t('note')))
        )
    }

    // ── 设置视图(0.3.1):顶部导航「设置」选项卡 ─────────────────────────────
    // 原「消耗统计」视图中的插件配置项移至此处;另含「清除记录数据」:
    // 滑条拖到底 → 输入随机 8 位验证码 → 连续点击两次确认,才真正清空账本。

    function SettingsSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [perm, setPerm] = React.useState(notifyState)
      const [cfgErr, setCfgErr] = React.useState(null)
      // 清除记录数据流程:clearArmed = 滑条已拖到底;clearCode = 随机 8 位验证码;
      // clearInput = 用户输入;clearStage = 0 未确认 / 1 第一次确认 / 2 执行中
      const [clearArmed, setClearArmed] = React.useState(false)
      const [clearCode, setClearCode] = React.useState('')
      const [clearInput, setClearInput] = React.useState('')
      const [clearStage, setClearStage] = React.useState(0)
      const [clearBusy, setClearBusy] = React.useState(false)
      const [clearMsg, setClearMsg] = React.useState(null)
      const [clearErr, setClearErr] = React.useState(null)

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
          try { await api.updateConfig({ webNotify: true }) } catch { /* 失败保持现状 */ }
        }
      }, [api])

      const arm = (value) => {
        const armed = value >= 100
        setClearArmed(armed)
        if (armed) {
          if (clearCode === '') setClearCode(genCode())
        } else {
          setClearStage(0)
          setClearInput('')
          setClearCode('')
        }
        setClearMsg(null)
        setClearErr(null)
      }

      const onConfirm = async () => {
        setClearErr(null)
        setClearMsg(null)
        if (!clearArmed) { setClearErr(t('clearSlideFirst')); return }
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
          setClearArmed(false)
          setClearMsg(t('clearedOk', { count }))
          if (typeof props.onCleared === 'function') props.onCleared()
        } catch (error) {
          setClearStage(1)
          setClearErr(String(error && error.message ? error.message : error))
        } finally {
          setClearBusy(false)
        }
      }

      const cfg = snap.config || {}
      return el('div', { className: 'tn-settings-section' },
        // 插件配置(原「消耗统计」视图中的配置项,经 updateConfig 持久化)
        el('div', { className: 'tn-subhead' }, t('settingsSectionTitle')),
        cfgErr ? el('div', { className: 'tn-err' }, t('error', { error: cfgErr })) : null,
        el('div', { className: 'tn-cards' },
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('notifyTurn')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnTurn : true, onChange: (e) => { void api.updateConfig({ notifyOnTurn: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
              t('notifyTurnDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('notifyGoal')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnGoal : true, onChange: (e) => { void api.updateConfig({ notifyOnGoal: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
              t('notifyGoalDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('interactionRemind')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnApproval : true, onChange: (e) => { void api.updateConfig({ notifyOnApproval: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
              el('span', null, t('notifyApproval') + ' — ' + t('notifyApprovalDesc'))),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.notifyOnQuestion : true, onChange: (e) => { void api.updateConfig({ notifyOnQuestion: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
              el('span', null, t('notifyQuestion') + ' — ' + t('notifyQuestionDesc')))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('popupSeconds')),
            el('div', { className: 'tn-range-row' },
              el('input', { className: 'tn-range', type: 'range', min: 3, max: 120, step: 1, value: cfg ? cfg.popupSeconds : 15, onChange: (e) => { void api.updateConfig({ popupSeconds: Number(e.target.value) }).catch(() => {}) } }),
              el('span', { className: 'tn-range-value' }, fmt(cfg ? cfg.popupSeconds : 15) + 's'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('storeDays')),
            el('div', { className: 'tn-range-row' },
              el('input', { className: 'tn-range', type: 'range', min: 1, max: 3650, step: 1, value: cfg ? cfg.storeDays : 365, onChange: (e) => { void api.updateConfig({ storeDays: Number(e.target.value) }).catch(() => {}) } }),
              el('span', { className: 'tn-range-value' }, fmt(cfg ? cfg.storeDays : 365) + 'd'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('pluginEnabled')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.enabled : true, onChange: (e) => { void api.updateConfig({ enabled: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
              t('pluginEnabledDesc'))),
          el('div', { className: 'tn-card' },
            el('p', { className: 'tn-card-label' }, t('webNotify')),
            el('label', { className: 'tn-check' },
              el('input', { type: 'checkbox', checked: cfg ? cfg.webNotify !== false : true, disabled: perm === 'unsupported' || perm === 'denied', onChange: (e) => { void api.updateConfig({ webNotify: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
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
              el('input', { type: 'checkbox', checked: cfg ? cfg.webNotifyBackgroundOnly !== false : true, disabled: perm === 'unsupported' || !(cfg ? cfg.webNotify !== false : true), onChange: (e) => { void api.updateConfig({ webNotifyBackgroundOnly: e.target.checked }).catch((err) => setCfgErr(String(err && err.message ? err.message : err))) } }),
              t('backgroundOnlyDesc')))),
        el('p', { className: 'tn-note' }, t('configHint')),

        // 清除记录数据
        el('div', { className: 'tn-subhead' }, t('clearDataTitle')),
        el('div', { className: 'tn-clear-panel' },
          el('p', { className: 'tn-price-note' }, t('clearDataDesc')),
          el('ol', { className: 'tn-clear-steps' },
            el('li', null, t('clearStep1')),
            el('li', null, t('clearStep2')),
            el('li', null, t('clearStep3'))),
          el('div', { className: 'tn-custom' },
            el('input', { className: 'tn-range', type: 'range', min: 0, max: 100, step: 1, value: clearArmed ? 100 : 0, onChange: (e) => arm(Number(e.target.value)) }),
            el('span', { className: 'tn-range-value' }, clearArmed ? t('clearReady') : t('clearNotReady'))),
          el('div', { className: 'tn-custom' },
            clearCode !== ''
              ? el('span', { className: 'tn-clear-code' }, clearCode)
              : el('span', { className: 'tn-hint' }, t('clearSlideFirst')),
            clearCode !== ''
              ? el('button', { className: 'tn-btn', onClick: () => setClearCode(genCode()) }, t('clearCodeRefresh'))
              : null),
          el('div', { className: 'tn-custom' },
            el('input', { className: 'tn-input', placeholder: t('clearCodePlaceholder'), value: clearInput, disabled: !clearArmed || clearBusy, onChange: (e) => setClearInput(e.target.value) })),
          clearErr ? el('p', { className: 'tn-clear-err' }, clearErr) : null,
          clearMsg ? el('p', { className: 'tn-clear-ok' }, clearMsg) : null,
          el('div', { className: 'tn-custom' },
            clearStage === 0
              ? el('button', { className: 'tn-danger-btn', disabled: !clearArmed || clearInput === '' || clearBusy, onClick: () => { void onConfirm() } }, t('clearConfirm1'))
              : el('button', { className: 'tn-danger-btn', disabled: clearBusy, onClick: () => { void onConfirm() } }, clearBusy ? t('clearing') : t('clearConfirm2'))))
      )
    }

    // ── 价格编辑视图(0.3.1):任务通知与消耗页内顶部导航切换 ──────────────
    // 模型价格跨 Key 合并:不同 Key 使用同一模型的调用都按该模型的价格计费。
    // 未激活自定义的模型默认按官方价计费(宿主 priceFor 回退官方目录);
    // 「添加模型」按钮可手动加入未出现的模型;保存后立即生效并重算金额。

    function PricingSection(props) {
      const store = props.hooks.taskNotice
      const api = props.api
      const snap = useStore(store)
      const el = React.createElement
      const [draft, setDraft] = React.useState(null)
      const [addName, setAddName] = React.useState('')
      const [savedMsg, setSavedMsg] = React.useState(false)
      const [convertResult, setConvertResult] = React.useState({})
      // 全量账目(用于枚举模型与 Key;从 0 到当前)
      const [enumData, setEnumData] = React.useState(null)
      const [catalog, setCatalog] = React.useState(null)

      React.useEffect(() => {
        let alive = true
        api.getUsageStats(0, Date.now()).then((res) => {
          if (!alive) return
          if (res && typeof res === 'object' && res.ok === true && res.value) setEnumData(res.value)
        }).catch(() => { /* 账目不可用时仅展示已保存的模型 */ })
        api.getPriceCatalog().then((res) => {
          if (!alive) return
          if (res && typeof res === 'object' && res.ok === true && res.value && typeof res.value === 'object') setCatalog(res.value)
        }).catch(() => { /* 目录不可用时仅隐藏官方价信息 */ })
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

      const cleanPrice = (p) => {
        const o = {}
        const keys = ['cacheIn', 'cacheOut', 'output', 'cacheWrite', 'reasoning']
        for (const k of keys) {
          const v = p && p[k]
          if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0) o[k] = Number(v)
        }
        return o
      }
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
            if (!row || row.enabled !== true) continue
            const price = cleanPriceEntry(row.price)
            if (Object.keys(price).length === 0) continue
            models[name] = { enabled: true, price }
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
          }
          await api.updateConfig({ pricing: sanitizedPricing, plans: sanitizedPlans, peak: sanitizePeak(peakCfg) })
          setDraft(null)
          setSavedMsg(true)
          window.setTimeout(() => setSavedMsg(false), 2500)
        } catch (err) {
          console.error('[dsh-task-notice] 保存价格失败: ' + String(err && err.message ? err.message : err))
        }
      }

      // 官方价目录查询(与宿主 pricing-catalog.js 同逻辑)
      const lookupClientModel = (model, cat) => {
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
      const officialBaseOf = (catEntry) => (catEntry ? catEntry[currency === '$' ? 'usd' : 'cny'] : null)
      const officialSummary = (model, catEntry) => {
        const base = officialBaseOf(catEntry)
        if (!base) return t('noOfficialPrice')
        const parts = []
        for (const k of ['cacheIn', 'cacheOut', 'output', 'cacheWrite', 'reasoning']) {
          if (base[k] !== undefined && base[k] !== null) parts.push(t(k) + ' ' + String(base[k]))
        }
        if (catEntry.peak && (catEntry.peak.offPeak || catEntry.peak.peak)) parts.push(t('tierOffPeak') + '/' + t('tierPeak'))
        return parts.join(' · ')
      }
      // 激活自定义:解锁编辑;若价格尚未填写则用官方价预填(含峰谷子档)
      const activateModel = (model) => patchDraft((b) => {
        const row = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        row.enabled = true
        const catEntry = lookupClientModel(model, catalog)
        const base = officialBaseOf(catEntry)
        if (base && Object.keys(cleanPrice(row.price)).length === 0) {
          row.price = {}
          for (const k of Object.keys(base)) row.price[k] = base[k]
          if (catEntry.peak) {
            const side = currency === '$' ? 'usd' : 'cny'
            row.price.peak = {}
            if (catEntry.peak.offPeak && catEntry.peak.offPeak[side]) row.price.peak.offPeak = { ...catEntry.peak.offPeak[side] }
            if (catEntry.peak.peak && catEntry.peak.peak[side]) row.price.peak.peak = { ...catEntry.peak.peak[side] }
          }
        }
      })
      const deactivateModel = (model) => patchDraft((b) => {
        const row = b.pricing.models[model] = b.pricing.models[model] || { enabled: false, price: {} }
        row.enabled = false
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
      const addModel = () => {
        const name = String(addName || '').trim()
        if (name === '') return
        if (pricing.models && pricing.models[name]) {
          setSavedMsg(true)
          window.setTimeout(() => setSavedMsg(false), 2500)
          setAddName('')
          return
        }
        patchDraft((b) => { b.pricing.models[name] = { enabled: false, price: {} } })
        setAddName('')
      }
      const onConvert = (key) => {
        const plan = plans && plans[key]
        const credits = plan ? Number(plan.credits) : 0
        const row = (enumData && Array.isArray(enumData.keys)) ? enumData.keys.find((r) => r.key === key) : null
        if (!row || !(credits > 0)) return
        const tokens = row.cacheIn + row.cacheOut + row.output + row.cacheWrite + row.reasoning
        setConvertResult((prev) => ({ ...prev, [key]: Math.round(tokens / credits) }))
      }

      // 峰时段文本 ⇄ 窗口数组
      const windowsToText = (windows) => (Array.isArray(windows) ? windows.map((w) => w.start + '-' + w.end).join(',') : '')
      const textToWindows = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean).map((seg) => {
        const parts = seg.split('-')
        const start = Number(parts[0])
        const end = Number(parts[1])
        return (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= 24) ? { start, end } : null
      }).filter((w) => w !== null)

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
      const modelNames = [...modelSet].sort((a, b) => a.localeCompare(b))

      return el('div', { className: 'tn-price-page' },
        el('p', { className: 'tn-price-note' }, t('pricePageHint')),
        el('div', { className: 'tn-legacy-note' }, t('legacyPriceNote')),
        el('p', { className: 'tn-price-note' }, t('priceSaveNow')),

        // 币种 + 全局默认价
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

        // 模型价格(跨 Key 合并)
        el('div', { className: 'tn-subhead', style: { marginTop: '6px' } }, t('priceModelRows')),
        el('p', { className: 'tn-price-note' }, t('modelMergedNote')),
        modelNames.length === 0
          ? el('p', { className: 'tn-empty' }, t('empty'))
          : el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            modelNames.map((model) => {
              const saved = (basePricing.models && basePricing.models[model]) || null
              const draftRow = (draft && draft.pricing.models && draft.pricing.models[model]) || null
              const row = draftRow || saved || { enabled: false, price: {} }
              const enabled = row.enabled === true
              const price = row.price || {}
              const catEntry = lookupClientModel(model, catalog)
              const hasPeak = !!(price.peak && (price.peak.peak || price.peak.offPeak)) || !!(catEntry && catEntry.peak)
              const providers = providerOfModel.get(model)
              return el('div', { className: 'tn-model-row2', key: model },
                el('div', { className: 'tn-model-head' },
                  el('span', { className: 'tn-model-name' }, model),
                  providers && providers.size > 0
                    ? el('span', { className: 'tn-model-meta' }, t('modelUsageInKeys') + ': ' + [...providers].join(', '))
                    : null,
                  enabled
                    ? el('span', { className: 'tn-badge custom' }, t('activeBadge'))
                    : (catEntry ? el('span', { className: 'tn-badge official' }, t('officialBadge')) : null),
                  el('button', {
                    className: 'tn-toggle' + (enabled ? ' on' : ''),
                    onClick: () => { if (enabled) deactivateModel(model); else activateModel(model) },
                  }, enabled ? t('deactivateCustom') : t('activateCustom'))),
                enabled
                  ? el('div', null,
                    PriceFields({ values: price, onChange: (k, v) => setModelPrice(model, k, v, 'base') }),
                    hasPeak
                      ? el('div', { className: 'tn-tier-row' },
                        el('div', { className: 'tn-tier-cell' },
                          el('span', { className: 'tn-tier-badge off' }, t('tierOffPeak')),
                          PriceFields({ values: price.peak && price.peak.offPeak, onChange: (k, v) => setModelPrice(model, k, v, 'offPeak') })),
                        el('div', { className: 'tn-tier-cell' },
                          el('span', { className: 'tn-tier-badge peak' }, t('tierPeak')),
                          PriceFields({ values: price.peak && price.peak.peak, onChange: (k, v) => setModelPrice(model, k, v, 'peak') })))
                      : null)
                  : el('div', { className: 'tn-official-summary' },
                    t('officialColon') + ': ' + officialSummary(model, catEntry),
                    catEntry && catEntry.source ? ' · ' + catEntry.source : ''),
                el('p', { className: 'tn-price-hint' }, t('priceUnitNote')))
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

        // Token Plan 订阅(按 Key)
        el('div', { className: 'tn-subhead', style: { marginTop: '10px' } }, t('planSectionTitle')),
        enumKeys.length === 0
          ? el('p', { className: 'tn-empty' }, t('empty'))
          : el('div', { className: 'tn-cards' },
            enumKeys.map((row) => {
              const plan = plans && plans[row.key]
              const fee = plan ? Number(plan.fee) : 0
              const credits = plan ? Number(plan.credits) : 0
              const brokenEven = !!(plan && plan.enabled && fee > 0 && row.cost >= fee)
              const pct = (plan && plan.enabled && fee > 0) ? Math.min(100, Math.max(0, (row.cost / fee) * 100)) : 0
              return el('div', { className: 'tn-card', key: row.key },
                el('p', { className: 'tn-card-label' }, t('key') + ': ' + row.key + ' · ' + t('money') + ' ' + fmtMoney(row.cost, currency)),
                el('div', { className: 'tn-plan-row' },
                  el('label', { className: 'tn-check' },
                    el('input', { type: 'checkbox', checked: !!(plan && plan.enabled), onChange: (e) => patchDraft((b) => {
                      if (!b.plans[row.key]) b.plans[row.key] = { enabled: false, fee: 0, credits: 0 }
                      const target = b.plans[row.key]
                      target.enabled = e.target.checked
                      // 0.3.1:设置为 Token Plan 时需要套餐起效时间与有效期(默认 31 天)
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
                        el('input', { className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any', value: plan.fee !== undefined && plan.fee !== null && plan.fee !== '' ? String(plan.fee) : '', placeholder: '0', onChange: (e) => patchDraft((b) => { b.plans[row.key].fee = e.target.value }) })),
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planCredits')),
                        el('input', { className: 'tn-input tn-num-input', type: 'number', min: 0, step: 'any', value: plan.credits !== undefined && plan.credits !== null && plan.credits !== '' ? String(plan.credits) : '', placeholder: '0', onChange: (e) => patchDraft((b) => { b.plans[row.key].credits = e.target.value }) }))),
                    // 0.3.1:套餐起效时间 + 有效期(默认 31 天)或每月 1 号(UTC+0)自动重置
                    el('div', { className: 'tn-plan-row', style: { marginTop: '6px' } },
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planStartAtLabel')),
                        el('input', {
                          className: 'tn-input tn-num-input',
                          type: 'datetime-local',
                          value: plan.startAt > 0 ? localInputValue(new Date(plan.startAt)) : localInputValue(new Date()),
                          onChange: (e) => patchDraft((b) => {
                            const v = new Date(e.target.value).getTime()
                            b.plans[row.key].startAt = Number.isFinite(v) ? v : Date.now()
                          }),
                        })),
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planValidityLabel')),
                        el('input', {
                          className: 'tn-input tn-num-input',
                          type: 'number', min: 1, max: 3650, step: 1,
                          value: plan.periodDays !== undefined && plan.periodDays !== null && plan.periodDays !== '' ? String(plan.periodDays) : '31',
                          disabled: plan.resetMode === 'monthly',
                          onChange: (e) => patchDraft((b) => { b.plans[row.key].periodDays = e.target.value }),
                        })),
                      el('label', { className: 'tn-price-field' },
                        el('span', null, t('planResetModeLabel')),
                        el('select', {
                          className: 'tn-input',
                          value: plan.resetMode === 'monthly' ? 'monthly' : 'days',
                          onChange: (e) => patchDraft((b) => { b.plans[row.key].resetMode = e.target.value }),
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
                    el('span', { className: 'tn-price-hint' }, t('planProgress', { used: fmtMoney(row.cost, currency), fee: fmtMoney(fee, currency) })))
                  : null,
                plan && plan.enabled && credits > 0
                  ? el('div', { className: 'tn-plan-row', style: { marginTop: '4px' } },
                    el('button', { className: 'tn-btn', onClick: () => onConvert(row.key) }, t('planConvert')),
                    convertResult[row.key] !== undefined
                      ? el('span', { className: 'tn-saved' }, t('convertResult', { tokens: fmt(convertResult[row.key]) }))
                      : null,
                    el('span', { className: 'tn-price-hint' }, t('convertHint', { tokens: fmt(row.cacheIn + row.cacheOut + row.output + row.cacheWrite + row.reasoning), credits: fmt(credits) })))
                  : null)
            })),

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

    function fmtCompact(n) {
      const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
      if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
      if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k'
      return v.toFixed(1)
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

      const onReset = async (key) => {
        setResetting(key)
        try {
          const { fromMs, toMs } = computeRange(rangeId)
          const result = await api.resetPlanCycle(key, fromMs, toMs)
          if (result !== null && typeof result === 'object' && result.ok === true && result.value) {
            setData({ status: 'ready', analysis: result.value, error: null })
          }
        } catch (error) {
          setData({ status: 'error', analysis: data.analysis, error: String(error && error.message ? error.message : error) })
        } finally {
          setResetting(null)
        }
      }

      const analysis = data.analysis
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

      // 饼图分块
      let acc = 0
      const slices = pieModels.map((m, i) => {
        const start = -90 + (acc / totalCost) * 360
        acc += m.cost
        const end = -90 + (acc / totalCost) * 360
        return { m, i, start, end, color: ANALYSIS_COLORS[i % ANALYSIS_COLORS.length] }
      })
      const hovered = hover !== null ? slices[hover.idx] : null

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
                  slices.map((s) => el('path', {
                    key: s.m.model + ':' + s.i,
                    d: pieArc(90, 90, 74, 46, s.start, s.end),
                    fill: s.color,
                    stroke: 'var(--dsw-alias-bg-layer-1,var(--dsh-alias-bg-layer-1,#181818))',
                    strokeWidth: 1.5,
                    style: { cursor: 'pointer', opacity: hovered !== null && hovered.i !== s.i ? 0.45 : 1, transition: 'opacity .15s' },
                    onMouseMove: (e) => {
                      const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect()
                      setHover({ idx: s.i, x: e.clientX - rect.left, y: e.clientY - rect.top })
                    },
                  })),
                  el('text', { x: 90, y: 90, textAnchor: 'middle', fontSize: 14, fontWeight: 600, fill: 'var(--dsw-alias-label-primary,var(--dsh-alias-label-primary,#eee))' }, fmtMoney(totalCost, currencySymbol)),
                  el('text', { x: 90, y: 107, textAnchor: 'middle', fontSize: 10, fill: 'var(--dsw-alias-label-tertiary,var(--dsh-alias-label-tertiary,#999))' }, t('total'))),
                hovered !== null && hovered !== undefined
                  ? el('div', { className: 'tn-pie-tip', style: { left: tipLeft, top: tipTop } },
                    el('div', { style: { fontWeight: 600 } }, hovered.m.brand + ' · ' + hovered.m.model),
                    el('div', null, t('calls') + ' ' + fmt(hovered.m.calls) + ' · ' + t('total') + ' ' + fmt(hovered.m.tokens) + ' ' + t('tokensUnit')),
                    el('div', null, t('cacheIn') + ' ' + fmt(hovered.m.cacheIn) + ' · ' + t('cacheOut') + ' ' + fmt(hovered.m.cacheOut) + ' · ' + t('output') + ' ' + fmt(hovered.m.output)),
                    hovered.m.cacheWrite > 0 || hovered.m.reasoning > 0
                      ? el('div', null, t('cacheWrite') + ' ' + fmt(hovered.m.cacheWrite) + ' · ' + t('reasoning') + ' ' + fmt(hovered.m.reasoning))
                      : null,
                    el('div', null, t('money') + ' ' + fmtMoney(hovered.m.cost, currencySymbol) + ' · ' + ((hovered.m.cost / totalCost) * 100).toFixed(1) + '%'))
                  : null),
              el('div', { className: 'tn-legend' },
                slices.map((s) => el('div', { className: 'tn-legend-item', key: s.m.model },
                  el('span', { className: 'tn-legend-dot', style: { background: s.color } }),
                  el('span', { className: 'tn-legend-name' }, s.m.model + (s.m.brand && s.m.brand !== '其他' ? ' (' + s.m.brand + ')' : '')),
                  el('span', { className: 'tn-legend-val' }, fmtMoney(s.m.cost, currencySymbol) + ' · ' + ((s.m.cost / totalCost) * 100).toFixed(1) + '%'))),
                el('div', { className: 'tn-legend-item' },
                  el('span', { className: 'tn-legend-name', style: { fontWeight: 600 } }, t('total')),
                  el('span', { className: 'tn-legend-val' }, fmtMoney(totalCost, currencySymbol))))),
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
                  keys.map((row) => el('tr', { key: row.key },
                    el('td', null, row.key),
                    el('td', null, row.provider || '—'),
                    el('td', { className: 'num' }, fmt(row.calls)),
                    el('td', { className: 'num' }, fmt(row.tokens)),
                    el('td', { className: 'num' }, fmtMoney(row.cost, currencySymbol)))),
                  el('tr', { className: 'tn-row-total' },
                    el('td', null, t('total')),
                    el('td', null, ''),
                    el('td', { className: 'num' }, fmt(keys.reduce((a, r) => a + r.calls, 0))),
                    el('td', { className: 'num' }, fmt(keys.reduce((a, r) => a + r.tokens, 0))),
                    el('td', { className: 'num' }, fmtMoney(keys.reduce((a, r) => a + r.cost, 0), currencySymbol)))))),

            // ── 第二部分:Token Plan 回本提示 ──
            el('div', { className: 'tn-block-title', style: { marginTop: '10px' } }, t('planBreakTitle')),
            el('p', { className: 'tn-block-note' }, t('planBreakHint')),
            planKeys.length === 0
              ? el('p', { className: 'tn-empty' }, t('noPlan'))
              : el('div', { className: 'tn-plan-cards' },
                planKeys.map((row) => {
                  const p = row.plan
                  const pct = p.fee > 0 ? Math.min(100, Math.max(0, (p.cycleCost / p.fee) * 100)) : 0
                  return el('div', { className: 'tn-plan-card', key: row.key },
                    el('div', { className: 'tn-plan-head' },
                      el('span', { className: 'tn-plan-key' }, row.key),
                      el('span', { className: 'tn-plan-badge ' + (p.brokenEven ? 'ok' : 'warn') }, p.brokenEven ? t('brokenEven') : t('notBrokenEven'))),
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
                        row.models.map((m) => el('span', { key: m.model },
                          m.model + ': ' + fmtMoney(m.cost, currencySymbol) + ' · ' + fmt(m.tokens) + ' ' + t('tokensUnit')))),
                    el('div', { className: 'tn-plan-meta' },
                      t('tokensPerCreditLabel') + ' ' + (p.tokensPerCredit !== null ? fmt(Math.round(p.tokensPerCredit)) : '—') + ' ' + t('tokensUnit')),
                    p.prevCycle !== null
                      ? el('div', { className: 'tn-plan-meta' },
                        t('prevCycleLabel') + ': ' + fmt(p.prevCycle.tokens) + ' ' + t('tokensUnit') + ' / ' + fmtMoney(p.prevCycle.cost, currencySymbol) + ' / ' + t('planFee') + ' ' + fmtMoney(p.prevCycle.fee, currencySymbol))
                      : null,
                    el('div', { className: 'tn-plan-actions' },
                      el('button', { className: 'tn-btn', disabled: resetting === row.key, onClick: () => { void onReset(row.key) } },
                        resetting === row.key ? t('resetting') : t('resetCycle'))))
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
                      el('th', null, t('brand')),
                      el('th', null, t('ratioScopeColumn')),
                      el('th', { className: 'num' }, t('total')),
                      el('th', { className: 'num' }, t('spend')),
                      el('th', { className: 'num' }, t('tokensPerCny')))),
                  el('tbody', null,
                    rankings.map((r, i) => el('tr', { key: r.key + '\u0000' + r.model },
                      el('td', { className: 'num' }, fmt(i + 1)),
                      el('td', null, r.key + ' · ' + r.model),
                      el('td', null, r.brand),
                      el('td', null,
                        r.usingPrev ? t('prevCycleLabel') : t('cycleRange'),
                        r.collecting ? el('span', { className: 'tn-badge collecting', style: { marginLeft: '6px' } }, t('collecting')) : null),
                      el('td', { className: 'num' }, fmt(r.tokens)),
                      el('td', { className: 'num' }, fmtMoney(r.amount, currencySymbol)),
                      el('td', { className: 'num' }, r.ratio > 0 ? fmtCompact(r.ratio) : '—'))))))
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
                      style: { width: (d.cost > 0 ? (m.cost / d.cost) * 100 : 0) + '%', background: ANALYSIS_COLORS[i % ANALYSIS_COLORS.length] },
                    })))
                  : null,
                d.models.map((m) => el('div', { className: 'tn-daily-model', key: m.model },
                  el('span', { className: 'tn-daily-model-name' }, m.model),
                  m.planWeighted ? el('span', { className: 'tn-badge weighted' }, t('weightedBadge')) : null,
                  el('span', null, fmt(m.tokens) + ' ' + t('tokensUnit')),
                  el('b', null, fmtMoney(m.cost, currencySymbol))))))))
          : null)
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

      // config 未就绪(启动瞬间)时按默认值兜底,与宿主 CONFIG_DEFAULTS 保持一致
      const DEFAULT_CFG = { webNotify: true, webNotifyBackgroundOnly: true, notifyOnTurn: true, notifyOnGoal: true, notifyOnApproval: true, notifyOnQuestion: true, pricing: { currency: '¥', default: {}, models: {} }, plans: {}, peak: { enabled: true, windows: [{ start: 1, end: 4 }, { start: 6, end: 10 }], weekdaysOnly: true, boundaryMs: Date.parse('2026-08-16T16:00:00Z') } }

      // 统一入口:入队页内弹窗队列 + 按配置发送系统通知(Web Notifications)。
      const pushFrame = (frame) => {
        const cur = store.get()
        store.set({ ...cur, notifications: [...(cur.notifications || []), frame].slice(-20) })
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
      ctx.effect(() => ctx.on('connection/reset', () => { void reload() }), 'dsh-task-notice: reconnect reload')

      // 通知流:任务完成帧推入 store,由弹窗浮层渲染。
      const controller = new AbortController()
      const pump = async () => {
        try {
          for await (const frame of taskNotice.subscribeNotifications(controller.signal)) {
            if (frame === null || typeof frame !== 'object') continue
            pushFrame(frame)
          }
        } catch (error) {
          console.warn('[dsh-task-notice] 通知流结束: ' + String(error && error.message ? error.message : error))
        }
      }
      void pump()
      ctx.effect(() => () => controller.abort(), 'dsh-task-notice: notify stream')

      // ── 操作提醒:权限请求 / 用户提问 ──────────────────────────────────────
      // 注意:approval/request 与 user-questions/request 是 agent 作用域上的
      // waterfall 应答事件——任何监听者若不调用 next() 就会截断应答链,导致
      // 提问/授权对话框不再出现(0.2.0 曾因此回归)。所以这里**绝不**在
      // ctx.remote.$on 上注册监听;改为订阅官方 UI 的只读待处理交互存储
      // uiSession.pendingInteractions:请求到达时由审批/提问 UI 发布进来、
      // 回答/关闭后自动移除。我们只读快照、订阅变化,完全不参与应答链。
      const interactionSeen = new Map()
      const clipText = (value, n) => {
        const s = String(value ?? '').replace(/\s+/g, ' ').trim()
        return s.length > n ? s.slice(0, n) + '…' : s
      }

      const describePending = (interaction) => {
        if (interaction === null || typeof interaction !== 'object') return null
        if (Array.isArray(interaction.questions) && interaction.questions.length > 0) {
          const qs = interaction.questions.filter((q) => q !== null && typeof q === 'object' && (typeof q.question === 'string' || typeof q.header === 'string'))
          if (qs.length === 0) return null
          const ids = qs.map((q, i) => (typeof q.id === 'string' && q.id !== '' ? q.id : String(i))).join(',')
          const sid = typeof interaction.sessionId === 'string' && interaction.sessionId !== '' ? interaction.sessionId : ''
          const first = clipText(((typeof qs[0].header === 'string' && qs[0].header !== '' ? qs[0].header + ' ' : '') + (typeof qs[0].question === 'string' ? qs[0].question : '')).trim(), 110)
          const summary = qs.length > 1 ? first + ' · ' + t('questionMore', { count: qs.length }) : first
          const key = 'pend:q:' + sid + ':' + ids
          return { type: 'question', key, frame: { id: key, type: 'question', atMs: Date.now(), title: t('questionTitle'), summary: clipText(summary, 170), tokens: {}, total: 0, key: null } }
        }
        const toolName = typeof interaction.toolName === 'string' ? interaction.toolName : ''
        const reason = (typeof interaction.reason === 'string' && interaction.reason.trim() !== '')
          ? interaction.reason
          : (toolName !== '' ? t('approvalSummary', { toolName }) : '')
        if (reason === '' && toolName === '') return null
        const sid = typeof interaction.sessionId === 'string' && interaction.sessionId !== '' ? interaction.sessionId : ''
        const key = 'pend:a:' + sid + ':' + ((typeof interaction.callId === 'string' && interaction.callId !== '') ? interaction.callId : (toolName + ':' + reason))
        return { type: 'approval', key, frame: { id: key, type: 'approval', atMs: Date.now(), title: t('approvalTitle'), summary: clipText(reason, 150), tokens: {}, total: 0, key: null } }
      }

      const notifyPending = () => {
        const cfg = store.get().config || DEFAULT_CFG
        const pending = ctx.get('uiSession')
        if (pending === undefined || pending === null || typeof pending.pendingInteractions !== 'object' || pending.pendingInteractions === null) return
        const snap = pending.pendingInteractions.getSnapshot()
        if (snap === undefined || snap === null || typeof snap.values !== 'function') return
        const now = Date.now()
        for (const interaction of snap.values()) {
          const info = describePending(interaction)
          if (!info) continue
          if (info.type === 'approval' && cfg.notifyOnApproval === false) continue
          if (info.type === 'question' && cfg.notifyOnQuestion === false) continue
          const last = interactionSeen.get(info.key)
          if (last !== undefined && now - last < 60000) continue
          interactionSeen.set(info.key, now)
          pushFrame(info.frame)
        }
        if (interactionSeen.size > 128) {
          for (const [k, ts] of interactionSeen) {
            if (now - ts > 120000) interactionSeen.delete(k)
          }
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
        getUsageAnalysis: (fromMs, toMs) => taskNotice.getUsageAnalysis(fromMs, toMs),
        resetPlanCycle: (key, fromMs, toMs) => taskNotice.resetPlanCycle(key, fromMs, toMs),
        getHealth: () => taskNotice.getHealth(),
        getConfig: () => taskNotice.getConfig(),
        getPriceCatalog: () => taskNotice.getPriceCatalog(),
        clearUsage: async () => {
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
