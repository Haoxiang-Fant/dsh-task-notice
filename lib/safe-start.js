/**
 * 安全启动(Safe start)检测模块。
 *
 * 目标:检测到插件冲突或与当前 DSH 版本不兼容时,取消插件的运行,避免导致
 * DSH 无法启动。本模块只做「判定」,不做任何有副作用的操作;判定结果由
 * lib/index.js 的门控逻辑消费。
 *
 * 检测项:
 *  1. DSH 宿主版本兼容性(默认要求 >=0.1.0-rc.5,可在配置中覆盖);
 *  2. 已知冲突插件(config.conflictingPlugins)已挂载;
 *  3. 本插件被重复挂载(同一 loader 行出现多次,如 cordis.patch.yml 与
 *     package.json bundles 同时引入);
 *  4. 其他插件已占用 taskNotice Typert 命名空间(端点冲突,注册会失败)。
 *
 * 所有检测均被 try/catch 包裹:即使检测代码本身出错,也只报告一条
 * internal-check-failed,绝不让检测失败拖垮 DSH 启动。
 */
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { satisfies } from './semver.js'

/** The npm package name of the DSH host. */
export const DSH_PACKAGE = '@deepseek-ai/dsh'
/** This plugin's package name (as loader entries name it). */
export const PLUGIN_PACKAGE = 'dsh-task-notice'
/** Typert wire namespace owned by this plugin. */
export const SERVICE_NAMESPACE = 'taskNotice'
/** Schema typeSymbol prefix owned by this plugin. */
export const TYPERT_SYMBOL_PREFIX = 'dsh-task-notice#'

function realpathOf(entry) {
  try {
    return realpathSync(entry)
  } catch {
    return entry
  }
}

function readDshManifest(directory) {
  try {
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    return manifest.name === DSH_PACKAGE
      ? { name: manifest.name, version: typeof manifest.version === 'string' ? manifest.version : '' }
      : null
  } catch {
    return null
  }
}

function isDshPackage(directory) {
  return readDshManifest(directory) !== null
}

/**
 * Locate the running DSH host package by walking up from the CLI entry, the
 * same technique dshmarket uses (a global/npx install resolves argv[1]
 * through symlinks to the real package directory).
 * @param {string} [entry] - CLI entry path, defaults to process.argv[1].
 * @returns {{version: string, directory: string} | null}
 */
export function findDshHostInfo(entry = process.argv[1]) {
  if (entry !== undefined) {
    let directory = resolve(dirname(realpathOf(entry)))
    for (let depth = 0; depth < 12; depth += 1) {
      if (isDshPackage(directory)) {
        const manifest = readDshManifest(directory)
        return { version: manifest.version || 'unknown', directory }
      }
      const parent = dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }
  return null
}

/**
 * Collect safe-start violations. Returns a list of
 * { code, message, detail? } — empty list means the plugin may run.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {object} config - resolved plugin config (requiredDshVersion, conflictingPlugins).
 * @returns {Array<{code: string, message: string, detail?: string}>}
 */
export function checkSafeStart(ctx, config, hostInfo) {
  const reasons = []
  const required = typeof config?.requiredDshVersion === 'string' && config.requiredDshVersion.trim() !== ''
    ? config.requiredDshVersion.trim()
    : '>=0.1.0-rc.5'

  // 1) DSH version compatibility -------------------------------------------------
  try {
    const host = hostInfo !== undefined ? hostInfo : findDshHostInfo()
    if (host === null) {
      reasons.push({
        code: 'dsh-host-not-found',
        message: '无法定位 DSH 宿主包(@deepseek-ai/dsh),安全起见已取消插件运行。',
        detail: '未能在启动入口所在目录树中找到 @deepseek-ai/dsh/package.json。',
      })
    } else if (!satisfies(host.version, required)) {
      reasons.push({
        code: 'dsh-version-incompatible',
        message: '当前 DSH 版本 ' + host.version + ' 不满足插件要求 ' + required + ',已取消插件运行。',
        detail: 'DSH host: ' + host.version + ' @ ' + host.directory,
      })
    }
  } catch (error) {
    reasons.push({ code: 'version-check-failed', message: '版本检测异常,已取消插件运行。', detail: String(error?.message ?? error) })
  }

  // 2) known conflicting plugins + self duplication ------------------------------
  try {
    const conflicts = Array.isArray(config?.conflictingPlugins) ? config.conflictingPlugins.filter((n) => typeof n === 'string') : []
    const loader = typeof ctx?.get === 'function' ? ctx.get('loader') : ctx?.loader
    if (loader && typeof loader.entries === 'function') {
      let selfCount = 0
      for (const entry of loader.entries()) {
        const name = entry?.options?.name
        if (typeof name !== 'string' || name === '') continue
        if (name === PLUGIN_PACKAGE) {
          selfCount += 1
          continue
        }
        if (conflicts.includes(name)) {
          reasons.push({
            code: 'plugin-conflict',
            message: '检测到冲突插件「' + name + '」已挂载,已取消插件运行。',
            detail: 'conflictingPlugins 配置中声明了 ' + name,
          })
        }
      }
      if (selfCount > 1) {
        reasons.push({
          code: 'duplicate-self',
          message: '检测到本插件被重复挂载(' + selfCount + ' 处 loader 条目),已取消插件运行以避免重复计费/重复弹窗。',
          detail: '请检查 cordis.patch.yml 与 dsh.profile.bundles 中是否同时引入了 dsh-task-notice。',
        })
      }
    }
  } catch (error) {
    reasons.push({ code: 'conflict-check-failed', message: '冲突检测异常,已取消插件运行。', detail: String(error?.message ?? error) })
  }

  // 3) Typert endpoint/namespace collision ---------------------------------------
  try {
    const typert = typeof ctx?.get === 'function' ? ctx.get('typert') : ctx?.typert
    const local = typert?.local
    if (local && typeof local.list === 'function') {
      for (const descriptor of local.list()) {
        const ns = descriptor?.namespace
        const id = descriptor?.id
        if (ns === SERVICE_NAMESPACE && typeof id === 'string' && !id.startsWith(TYPERT_SYMBOL_PREFIX)) {
          reasons.push({
            code: 'typert-namespace-conflict',
            message: '其他插件已占用 taskNotice 服务命名空间,已取消插件运行。',
            detail: '冲突端点: ' + id,
          })
        }
      }
    }
  } catch (error) {
    reasons.push({ code: 'typert-check-failed', message: '服务命名空间检测异常,已取消插件运行。', detail: String(error?.message ?? error) })
  }

  return reasons
}
