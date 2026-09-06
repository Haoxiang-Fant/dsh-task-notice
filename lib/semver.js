/**
 * Minimal semantic-version parsing and range matching used by the safe-start
 * gate. Deliberately self-contained (no external deps) so the plugin can never
 * fail to load because of a missing dependency.
 *
 * Supported range grammar:
 *   - comparators: >=, >, <=, <, =, bare exact, ^, ~  (v-prefix allowed)
 *   - AND: whitespace / comma separated comparators
 *   - OR: `||` separated alternatives
 *   - wildcards: *, x, X, and partial forms (1.x / 1.2.x / 1 / 1.2)
 * Prerelease handling follows node-semver's practical rule: a version with a
 * prerelease tag only matches when at least one comparator in the matching
 * alternative carries a prerelease tag of its own (a stable comparator set
 * never matches a prerelease version).
 */

export function parseVersion(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(text)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.') : [],
  }
}

function cmp(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  if (a.pre.length === 0 && b.pre.length === 0) return 0
  if (a.pre.length === 0) return 1 // release > prerelease
  if (b.pre.length === 0) return -1
  const len = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < len; i += 1) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) {
      const d = BigInt(x) < BigInt(y) ? -1 : BigInt(x) > BigInt(y) ? 1 : 0
      if (d !== 0) return d
      continue
    }
    if (xn) return -1 // numeric identifiers sort before alphanumeric
    if (yn) return 1
    const s = x < y ? -1 : x > y ? 1 : 0
    if (s !== 0) return s
  }
  return 0
}

function compare(version, target) {
  return cmp(version, target)
}

/** Expand ^ / ~ / partial / wildcard tokens into one or two operator comparators. */
function expandToken(token) {
  if (token === '*' || token === '' || token === 'x' || token === 'X') return null // any
  const match = /^(\^|~|>=|<=|>|<|=)?\s*v?(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?$/.exec(token.trim())
  if (!match) return null
  const op = match[1] ?? ''
  const major = Number(match[2])
  const minorRaw = match[3]
  const patchRaw = match[4]
  const pre = match[5] ? match[5].split('.') : []
  const minor = minorRaw !== undefined && !/^[xX*]$/.test(minorRaw) ? Number(minorRaw) : undefined
  const patch = patchRaw !== undefined && !/^[xX*]$/.test(patchRaw) ? Number(patchRaw) : undefined

  if (op === '^' || op === '~') {
    if (minor === undefined || patch === undefined) {
      // ^1, ^1.2, ~1, ~1.2 → treat as >= partial with next-minor ceiling
      const base = { major, minor: minor ?? 0, patch: patch ?? 0, pre: pre }
      const upper = { major, minor: (minor ?? 0) + 1, patch: 0, pre: [] }
      return [{ op: '>=', target: base }, { op: '<', target: upper }]
    }
    if (op === '^') {
      const upper = major > 0
        ? { major: major + 1, minor: 0, patch: 0, pre: [] }
        : minor > 0
          ? { major: 0, minor: minor + 1, patch: 0, pre: [] }
          : { major: 0, minor: 0, patch: patch + 1, pre: [] }
      return [{ op: '>=', target: { major, minor, patch, pre } }, { op: '<', target: upper }]
    }
    // ~
    const upper = { major, minor: minor + 1, patch: 0, pre: [] }
    return [{ op: '>=', target: { major, minor, patch, pre } }, { op: '<', target: upper }]
  }

  if (minor === undefined) {
    // bare partial: "1" or "1.x"
    return [{ op: '>=', target: { major, minor: 0, patch: 0, pre } }, { op: '<', target: { major: major + 1, minor: 0, patch: 0, pre: [] } }]
  }
  if (patch === undefined) {
    return [{ op: '>=', target: { major, minor, patch: 0, pre } }, { op: '<', target: { major, minor: minor + 1, patch: 0, pre: [] } }]
  }
  const target = { major, minor, patch, pre }
  if (op === '') return [{ op: '=', target }]
  return [{ op, target }]
}

function matchesComparator(version, comp) {
  if (comp === null) return true
  const c = compare(version, comp.target)
  switch (comp.op) {
    case '>': return c > 0
    case '>=': return c >= 0
    case '<': return c < 0
    case '<=': return c <= 0
    case '=': return c === 0
    default: return false
  }
}

/** Parse one whitespace/comma separated comparator list into expanded comparators. */
function parseAlternative(alternative) {
  const tokens = alternative.trim().split(/[\s,]+/).filter(Boolean)
  const expanded = []
  for (const token of tokens) {
    const parts = expandToken(token)
    if (parts === null) continue // wildcard: no constraint
    expanded.push(...parts)
  }
  return expanded
}

/**
 * Whether `version` satisfies `range`.
 * @param {string} version - e.g. "0.1.2-rc.1"
 * @param {string} range - e.g. ">=0.1.0-rc.5 <0.2.0"
 * @returns {boolean}
 */
export function satisfies(version, range) {
  const v = parseVersion(version)
  if (v === null) return false
  if (typeof range !== 'string') return false
  const alternatives = range.split('||')
  for (const alternative of alternatives) {
    const comps = parseAlternative(alternative)
    // Prerelease versions need at least one prerelease comparator in the set.
    if (v.pre.length > 0 && !comps.some((c) => c !== null && c.target.pre.length > 0)) continue
    if (comps.every((c) => matchesComparator(v, c))) return true
  }
  return false
}

export { parseVersion as parse }
