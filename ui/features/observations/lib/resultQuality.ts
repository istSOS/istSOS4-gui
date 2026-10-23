// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file features/observations/lib/resultQuality.ts
 *
 * The one place that decides what an Observation's `resultQuality` means.
 *
 * The API stores the field as raw `jsonb` with no validation, no default and no
 * declared scale — a bare number with nothing recording which scale it is on.
 * The reading applied here is the istSOS quality index used by the quality
 * tutorial, every API payload example and the docs: **100 is good, and lower
 * values are flag codes**, with 90-93 produced by the SaQC checks the tutorial
 * runs.
 *
 * That reading is a convention, not something the record asserts, and it is not
 * the only one istSOS writes. The istSOS4 QC jobs (Flink, `qc_historical`) and
 * ingest tools (`ftp2istsos`, `mqtt2istsos`) write a bitmask of 2-bit pairs whose
 * meaning depends on the datastream's `properties.constraints`; the maintainers
 * define it in `istsos4_client.quality`. Under the index below its values would
 * classify as OUT_OF_RANGE. Nothing in a stored value distinguishes the scales,
 * so the viewer can say which one a datastream uses: a `QualityScheme` is either
 * an ordered list of rules or the bitmask, and the istSOS index is simply the
 * scheme used when nobody has chosen another. This module is still the only
 * file that knows what a value means — callers hand it a scheme and the
 * datastream's constraints, they never test a code themselves.
 */

/** At or above this, the reading passed. The whole convention, in one constant. */
export const QUALITY_PASS = 100

/** The SaQC checks the quality tutorial writes back. */
export const QUALITY_CODES = {
  MISSING: 90,
  CONSTANT: 91,
  OUTLIER: 92,
  OUT_OF_RANGE: 93,
} as const

/**
 * What a reading's quality says about it.
 *
 * `none` is not a verdict — it is the absence of one. A reading nothing has
 * checked must never render as passing, and must never be counted against the
 * pass rate either.
 *
 * Rule schemes judge into the first set. The bitmask scheme judges into OASI
 * scores instead, named by score (`oasi10` … `oasi0`), plus `undecodable`; the
 * two share only `none`.
 */
export type RuleQualityClass = 'pass' | 'suspect' | 'outlier' | 'range' | 'none'
export type BitmaskQualityClass =
  | 'oasi10'
  | 'oasi3'
  | 'oasi2'
  | 'oasi1'
  | 'oasi6'
  | 'undecodable'
  | 'oasi0'
  | 'none'
export type QualityClass = RuleQualityClass | BitmaskQualityClass

/** The verdicts a rule can give, best-to-worst then the non-verdict. */
export const RULE_QUALITY_CLASSES: RuleQualityClass[] = [
  'pass',
  'suspect',
  'outlier',
  'range',
  'none',
]

/**
 * The bitmask scheme's verdicts: good after a human review, then good after the
 * automatic checks, suspect, and the two corrupted; then a value the constraints
 * cannot explain; then the two that are not verdicts — raw data no check has
 * run on (OASI 0), and no value at all.
 */
export const BITMASK_QUALITY_CLASSES: BitmaskQualityClass[] = [
  'oasi10',
  'oasi3',
  'oasi2',
  'oasi1',
  'oasi6',
  'undecodable',
  'oasi0',
  'none',
]

/**
 * Every class, in legend order. A lane is judged under one scheme, so it only
 * ever holds one of the two sets, and filtering this keeps that set's order.
 */
export const QUALITY_CLASSES: QualityClass[] = [
  ...RULE_QUALITY_CLASSES.filter((key) => key !== 'none'),
  ...BITMASK_QUALITY_CLASSES,
]

/** The verdicts a scheme can give, for lists that offer every one of them. */
export function qualityClassesOf(scheme: QualityScheme): QualityClass[] {
  return scheme.kind === 'bitmask'
    ? BITMASK_QUALITY_CLASSES
    : RULE_QUALITY_CLASSES
}

const PASSING = new Set<QualityClass>(['pass', 'oasi10', 'oasi3'])
// OASI 0 is raw data no check has run on: as unjudged as no value at all.
const UNJUDGED = new Set<QualityClass>(['none', 'oasi0'])

/** Counts towards the pass rate's numerator. */
export const isPassing = (qualityClass: QualityClass) =>
  PASSING.has(qualityClass)

/** A verdict, as opposed to the absence of one. */
export const isJudged = (qualityClass: QualityClass) =>
  !UNJUDGED.has(qualityClass)

/**
 * Lane colours.
 *
 * These are *status* roles, not series colours: reserved, never reassigned to a
 * datastream, and always shipped with the label beside them so the lane is never
 * read by hue alone. 90 and 91 deliberately share the warning tone — both mean
 * "suspect, not impossible" — which keeps the lane inside four reserved roles
 * rather than inventing a fifth hue that no longer separates under CVD.
 *
 * The OASI colours are the maintainers' own (`OASI_QUALITY` in
 * `istsos4_client.quality`), used as given so the lane matches their plots.
 */
export const QUALITY_COLORS: Record<QualityClass, string> = {
  pass: '#0ca30c',
  suspect: '#fab219',
  outlier: '#ec835a',
  range: '#d03b3b',
  oasi10: '#2e7d32',
  oasi3: '#81c784',
  oasi2: '#f9a825',
  oasi1: '#e57373',
  oasi6: '#b71c1c',
  // Not an OASI colour, and darker than any of them: a value that does not fit
  // the datastream's constraints usually means the wrong scheme is chosen, and
  // it must not pass for a score.
  undecodable: '#3f3f46',
  oasi0: '#9e9e9e',
  // Matches the tertiary-series grey already used by the chart, and clears the
  // white plotting surface well enough to read as a filled block.
  none: '#94a3b8',
}

/** i18n keys, resolved by the caller that holds `t`. */
export const QUALITY_LABEL_KEYS: Record<QualityClass, string> = {
  pass: 'quality.pass',
  suspect: 'quality.suspect',
  outlier: 'quality.outlier',
  range: 'quality.range',
  oasi10: 'quality.oasi10',
  oasi3: 'quality.oasi3',
  oasi2: 'quality.oasi2',
  oasi1: 'quality.oasi1',
  oasi6: 'quality.oasi6',
  undecodable: 'quality.undecodable',
  oasi0: 'quality.oasi0',
  none: 'quality.none',
}

/** The OASI score and level behind each scored verdict (`OASI_QUALITY`). */
export const OASI_SCORES = {
  oasi10: { score: 10, level: 'HQC' },
  oasi3: { score: 3, level: 'AQC1' },
  oasi2: { score: 2, level: 'AQC1' },
  oasi1: { score: 1, level: 'AQC0' },
  oasi6: { score: 6, level: 'HQC' },
  oasi0: { score: 0, level: 'AQC0' },
} as const

export type OasiQualityClass = keyof typeof OASI_SCORES

/**
 * The quality index behind a raw `resultQuality`, or null when there isn't one.
 *
 * The column is untyped `jsonb`, so this has to cope with whatever an ingest
 * put there:
 *  - a number (`100`) — the shape a JSON literal round-trips as;
 *  - a numeric string (`"100"`), which is what the API examples POST;
 *  - an object, the OGC `DQ_Element` shape, where a numeric `quality` /
 *    `value` / `result` member is the only part this chart can read;
 *  - anything else — a free-text verdict, an array — which is a value the lane
 *    cannot place on the index and so reports as "not checked" rather than
 *    guessing a verdict for it.
 */
export function parseResultQuality(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>
    for (const key of ['quality', 'value', 'result', 'index']) {
      const nested = parseResultQuality(record[key])
      if (nested !== null) return nested
    }
  }

  return null
}

/** How a rule compares a reading's index with its own value(s). */
export type QualityOp =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'le'
  | 'gt'
  | 'ge'
  | 'between'
  | 'in'

export const QUALITY_OPS: QualityOp[] = [
  'eq',
  'ne',
  'lt',
  'le',
  'gt',
  'ge',
  'between',
  'in',
]

/**
 * One line of a scheme: "if the index <op> <value>, the reading is <verdict>".
 *
 * `verdict` may be `none`: some ingests store a value that means "this check
 * was not run", and that reading has not been judged any more than one with no
 * value at all.
 */
export type QualityRule = {
  op: QualityOp
  /** The compared value; the lower bound for `between`. Null while unset. */
  value: number | null
  /** `between` only — the upper bound, inclusive. */
  max?: number | null
  /** `in` only. */
  values?: number[]
  verdict: RuleQualityClass
}

/**
 * What a datastream's quality values mean, as rules.
 *
 * Rules are tried in order and the first match decides. A value no rule
 * matches gets `fallback`, which is always a verdict: an index that is present
 * but unexplained is still a reading someone flagged, and dropping it to "not
 * checked" would hide it. A reading with NO index is never judged, whatever the
 * scheme says — that rule is not in the list because it is not negotiable.
 */
export type QualityRulesScheme = {
  version: 1
  /** Absent on rules saved before there was another kind. */
  kind?: 'rules'
  rules: QualityRule[]
  fallback: Exclude<RuleQualityClass, 'none'>
  /** Viewer's own names for the verdicts. The colours never change with them. */
  labels?: Partial<Record<QualityClass, string>>
}

/**
 * What a datastream's quality values mean, as the istSOS4 QC bitmask.
 *
 * Nothing to configure: what each pair means comes from the datastream's own
 * constraints, so one scheme reads every datastream, whatever its checks.
 */
export type QualityBitmaskScheme = {
  version: 1
  kind: 'bitmask'
  labels?: Partial<Record<QualityClass, string>>
}

export type QualityScheme = QualityRulesScheme | QualityBitmaskScheme

/**
 * The istSOS quality index, as a scheme.
 *
 * Exactly the classifier this module shipped before schemes existed: 100 and
 * above passes, 90–93 are the SaQC codes, and anything else below 100 is a
 * failure.
 */
export const ISTSOS_QUALITY_SCHEME: QualityRulesScheme = {
  version: 1,
  rules: [
    { op: 'ge', value: QUALITY_PASS, verdict: 'pass' },
    { op: 'eq', value: QUALITY_CODES.OUT_OF_RANGE, verdict: 'range' },
    { op: 'eq', value: QUALITY_CODES.OUTLIER, verdict: 'outlier' },
    {
      op: 'in',
      value: null,
      values: [QUALITY_CODES.MISSING, QUALITY_CODES.CONSTANT],
      verdict: 'suspect',
    },
  ],
  fallback: 'range',
}

export const QUALITY_BITMASK_SCHEME: QualityBitmaskScheme = {
  version: 1,
  kind: 'bitmask',
}

/**
 * Starting points for the conventions istSOS itself writes.
 *
 * The bitmask is also what ftp2istsos and mqtt2istsos mean: ftp2istsos writes 3
 * (raw data, no check run yet) and 0 (no data). Value rules once offered here
 * read that 3 as "every check passed", which it is not. mqtt2istsos sends the
 * binary digits "11" and "00", but the column keeps 11 as the number eleven,
 * which the bitmask reads as raw data a human review failed; and "00" is not
 * valid JSON, so it is never stored at all.
 */
export const QUALITY_PRESETS = {
  istsos: ISTSOS_QUALITY_SCHEME,
  bitmask: QUALITY_BITMASK_SCHEME,
  blank: { version: 1, rules: [], fallback: 'suspect' },
} satisfies Record<string, QualityScheme>

export type QualityPresetKey = keyof typeof QUALITY_PRESETS

// ── the istSOS4 QC bitmask ───────────────────────────────────────────────
// A port of `decode_result_quality` and `oasi_quality` from the maintainers'
// istsos4_client (src/istsos4_client/quality.py), so the chart reads a value
// exactly as their Python client and its JavaScript port do.

/** One entry of a datastream's `properties.constraints`: a SaQC check. */
export type QualityConstraint = { type: unknown } & Record<string, unknown>

/** What one 2-bit pair says. The first four only occur in the data-state pair. */
export type QualityCheckStatus =
  | 'raw'
  | 'filled'
  | 'no_data'
  | 'digital'
  | 'passed'
  | 'failed'
  | 'not_executed'
  | 'unused'

// Indexed by the pair's value, 0b00 … 0b11.
const DATA_STATUS: QualityCheckStatus[] = ['no_data', 'digital', 'filled', 'raw']
const CHECK_STATUS: QualityCheckStatus[] = [
  'not_executed',
  'unused',
  'failed',
  'passed',
]

/** The maintainers' legend colour for each pair status (`STATUS_COLORS`). */
export const QUALITY_STATUS_COLORS: Record<QualityCheckStatus, string> = {
  raw: '#9e9e9e',
  filled: '#f9a825',
  no_data: '#9e9e9e',
  digital: '#1565c0',
  passed: '#2e7d32',
  failed: '#c62828',
  not_executed: '#000000',
  unused: '#616161',
}

/** One decoded pair: the data state, one constraint, or the human review. */
export type QualityCheck = {
  /** The pair's position, lowest first: 0 data, 1…N constraints, N+1 human. */
  id: number
  kind: 'data' | 'constraint' | 'human'
  status: QualityCheckStatus
  /** The constraint the pair reports on, for `kind: 'constraint'` only. */
  constraint?: QualityConstraint
}

/**
 * A datastream's constraints, from `properties.constraints`.
 *
 * None at all is a valid answer — no checks are configured, and a value then
 * holds only the data state and, maybe, the human review — so a missing key
 * reads as an empty list. A list stored as a JSON string is read as the client
 * reads it. Anything that is not a list of objects each naming its `type` gives
 * null: without it the pairs cannot be told apart, so nothing on that
 * datastream can be decoded.
 */
export function qualityConstraintsOf(
  datastream:
    | { properties?: Record<string, unknown> | null }
    | null
    | undefined
): QualityConstraint[] | null {
  let raw = datastream?.properties?.constraints
  if (raw === undefined || raw === null) return []
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!Array.isArray(raw)) return null
  const named = raw.every(
    (entry) =>
      !!entry &&
      typeof entry === 'object' &&
      !Array.isArray(entry) &&
      'type' in entry
  )
  return named ? (raw as QualityConstraint[]) : null
}

/**
 * The pairs of `index`, lowest first: the data state, one per constraint in
 * list order, then the human review — left out when its pair is 00, which
 * means nobody has reviewed the reading.
 *
 * Null when `index` cannot be such a mask: negative, fractional, or with bits
 * set beyond the human pair. The client raises there; a chart has to go on
 * drawing, so the caller shows the value as undecodable instead.
 *
 * Plain arithmetic rather than the client's BigInt: by the time a value gets
 * here it is a JS number, exact only up to 2^53 (26 pairs, so 24 constraints),
 * and anything past that is reported as undecodable rather than misread.
 */
export function decodeResultQuality(
  index: number,
  constraints: QualityConstraint[]
): QualityCheck[] | null {
  const pairCount = constraints.length + 2
  if (!Number.isSafeInteger(index) || index < 0 || index >= 4 ** pairCount) {
    return null
  }
  const checks: QualityCheck[] = []
  for (let i = 0; i < pairCount; i++) {
    const pair = Math.floor(index / 4 ** i) % 4
    if (i === 0) {
      checks.push({ id: 0, kind: 'data', status: DATA_STATUS[pair] })
    } else if (i <= constraints.length) {
      checks.push({
        id: i,
        kind: 'constraint',
        status: CHECK_STATUS[pair],
        constraint: constraints[i - 1],
      })
    } else if (pair !== 0) {
      checks.push({ id: i, kind: 'human', status: CHECK_STATUS[pair] })
    }
  }
  return checks
}

/**
 * The OASI verdict a decoded value maps to, or null when it has none: data that
 * is not raw with no check run, or a pair holding the reserved `unused`. Human
 * review wins over the constraints, as in `oasi_quality`.
 */
export function oasiVerdict(checks: QualityCheck[]): OasiQualityClass | null {
  const human = checks.find((check) => check.kind === 'human')
  if (human) {
    if (human.status === 'passed') return 'oasi10'
    if (human.status === 'failed') return 'oasi6'
    return null
  }
  const statuses = new Set(
    checks
      .filter((check) => check.kind === 'constraint')
      .map((check) => check.status)
  )
  const only = (...wanted: QualityCheckStatus[]) =>
    statuses.size === wanted.length &&
    wanted.every((status) => statuses.has(status))
  if (only('failed')) return 'oasi1'
  if (only('passed')) return 'oasi3'
  if (statuses.has('failed') || only('passed', 'not_executed')) return 'oasi2'
  if (
    checks[0]?.status === 'raw' &&
    [...statuses].every((status) => status === 'not_executed')
  ) {
    return 'oasi0'
  }
  return null
}

/**
 * `index` written as its pairs, human review first as the maintainers draw it
 * ("11 10 11 11" for 239 with two constraints), or null when it does not fit.
 */
export function formatQualityPairs(
  index: number,
  constraints: QualityConstraint[]
): string | null {
  if (!decodeResultQuality(index, constraints)) return null
  const digits = index.toString(2).padStart(2 * (constraints.length + 2), '0')
  return (digits.match(/../g) ?? []).join(' ')
}

/** A constraint as the client describes it: "flagRange: min=0, max=10". */
export function describeConstraint(constraint: QualityConstraint): string {
  const params = Object.entries(constraint)
    .filter(([key]) => key !== 'type')
    .map(([key, value]) =>
      // Objects as JSON rather than "[object Object]".
      value !== null && typeof value === 'object'
        ? `${key}=${JSON.stringify(value)}`
        : `${key}=${value}`
    )
    .join(', ')
  return params ? `${constraint.type}: ${params}` : String(constraint.type)
}

/** A rule that can be evaluated — its operands are filled in. */
export function isRuleComplete(rule: QualityRule): boolean {
  if (rule.op === 'in') return (rule.values?.length ?? 0) > 0
  if (rule.value === null || !Number.isFinite(rule.value)) return false
  if (rule.op === 'between') {
    return rule.max != null && Number.isFinite(rule.max)
  }
  return true
}

function ruleMatches(rule: QualityRule, index: number): boolean {
  const value = rule.value as number
  switch (rule.op) {
    case 'eq':
      return index === value
    case 'ne':
      return index !== value
    case 'lt':
      return index < value
    case 'le':
      return index <= value
    case 'gt':
      return index > value
    case 'ge':
      return index >= value
    case 'between': {
      const max = rule.max as number
      return index >= Math.min(value, max) && index <= Math.max(value, max)
    }
    case 'in':
      return (rule.values ?? []).includes(index)
  }
}

/**
 * Which rule decided an index: its position in the scheme, `'fallback'` when no
 * rule matched, or `'unset'` when there was no index to judge. The bitmask has
 * no rules: `'decoded'` when the index fits the datastream's constraints, and
 * `'undecodable'` when it does not.
 */
export type QualityRuleRef =
  | number
  | 'fallback'
  | 'unset'
  | 'decoded'
  | 'undecodable'

export type QualityMatch = {
  qualityClass: QualityClass
  rule: QualityRuleRef
}

/**
 * Judge an index under a scheme, and say which rule did it.
 *
 * `constraints` are the datastream's (see `qualityConstraintsOf`), and only the
 * bitmask reads them. A value that decodes but has no OASI score is not judged,
 * as the client returns no score for it either.
 */
export function matchQuality(
  index: number | null,
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME,
  constraints: QualityConstraint[] | null = []
): QualityMatch {
  if (index === null) return { qualityClass: 'none', rule: 'unset' }
  if (scheme.kind === 'bitmask') {
    const checks = constraints && decodeResultQuality(index, constraints)
    if (!checks) return { qualityClass: 'undecodable', rule: 'undecodable' }
    return { qualityClass: oasiVerdict(checks) ?? 'none', rule: 'decoded' }
  }
  for (let i = 0; i < scheme.rules.length; i++) {
    const rule = scheme.rules[i]
    if (isRuleComplete(rule) && ruleMatches(rule, index)) {
      return { qualityClass: rule.verdict, rule: i }
    }
  }
  return { qualityClass: scheme.fallback, rule: 'fallback' }
}

/** Where an index sits on the lane. */
export function classifyQuality(
  index: number | null,
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME,
  constraints: QualityConstraint[] | null = []
): QualityClass {
  return matchQuality(index, scheme, constraints).qualityClass
}

/** Convenience for callers holding a raw value. */
export function qualityClassOf(
  raw: unknown,
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME,
  constraints: QualityConstraint[] | null = []
): QualityClass {
  return classifyQuality(parseResultQuality(raw), scheme, constraints)
}

/**
 * Whether a scheme accounts for an index: a rule names it, or it fits the
 * bitmask. A value left to a rule scheme's fallback is not explained.
 */
export function explainsQuality(
  index: number,
  scheme: QualityScheme,
  constraints: QualityConstraint[] | null = []
): boolean {
  const { rule } = matchQuality(index, scheme, constraints)
  return typeof rule === 'number' || rule === 'decoded'
}

/**
 * Indexes that stand for every region of the number line the scheme's rules
 * distinguish.
 *
 * Every operator is constant between two consecutive thresholds, so testing
 * each threshold, each midpoint between two, and one point past either end
 * covers every case a rule can tell apart. That makes the reachability check
 * below exact rather than a sample.
 */
function representativeIndexes(scheme: QualityRulesScheme): number[] {
  const thresholds = new Set<number>()
  for (const rule of scheme.rules) {
    if (!isRuleComplete(rule)) continue
    if (rule.op === 'in') {
      for (const value of rule.values ?? []) thresholds.add(value)
      continue
    }
    thresholds.add(rule.value as number)
    if (rule.op === 'between') thresholds.add(rule.max as number)
  }
  const sorted = [...thresholds].sort((a, b) => a - b)
  if (sorted.length === 0) return [0]
  const points = [sorted[0] - 1, sorted[sorted.length - 1] + 1]
  for (let i = 0; i < sorted.length; i++) {
    points.push(sorted[i])
    if (i < sorted.length - 1) points.push((sorted[i] + sorted[i + 1]) / 2)
  }
  return points
}

/**
 * For each rule, the earlier rules that together catch every index it could
 * match — so it can never decide anything — or null when it is reachable.
 *
 * Returned as 0-based positions. An incomplete rule is reported as reachable:
 * it is flagged for its missing operand instead.
 */
export function findShadowedRules(
  scheme: QualityRulesScheme
): (number[] | null)[] {
  const points = representativeIndexes(scheme)
  return scheme.rules.map((rule, index) => {
    if (!isRuleComplete(rule)) return null
    const earlier = new Set<number>()
    for (const point of points) {
      if (!ruleMatches(rule, point)) continue
      const catcher = scheme.rules
        .slice(0, index)
        .findIndex((other) => isRuleComplete(other) && ruleMatches(other, point))
      if (catcher === -1) return null
      earlier.add(catcher)
    }
    return earlier.size > 0 ? [...earlier].sort((a, b) => a - b) : null
  })
}

/** Two schemes that judge every reading the same way and name verdicts alike. */
export function sameQualityScheme(a: QualityScheme, b: QualityScheme): boolean {
  return JSON.stringify(normalizeScheme(a)) === JSON.stringify(normalizeScheme(b))
}

function normalizeScheme(scheme: QualityScheme) {
  const labels = Object.fromEntries(
    Object.entries(scheme.labels ?? {})
      .filter(([, label]) => !!label?.trim())
      .sort(([a], [b]) => a.localeCompare(b))
  )
  if (scheme.kind === 'bitmask') return { kind: 'bitmask', labels }
  return {
    kind: 'rules',
    rules: scheme.rules.map((rule) => ({
      op: rule.op,
      value: rule.op === 'in' ? null : rule.value,
      max: rule.op === 'between' ? (rule.max ?? null) : null,
      values: rule.op === 'in' ? (rule.values ?? []) : null,
      verdict: rule.verdict,
    })),
    fallback: scheme.fallback,
    labels,
  }
}

/** A rule's condition in symbols ("≤ 95", "90–93", "∈ 90, 91"), for tight spots. */
export function describeRuleCondition(rule: QualityRule): string {
  const symbols: Record<Exclude<QualityOp, 'between' | 'in'>, string> = {
    eq: '=',
    ne: '≠',
    lt: '<',
    le: '≤',
    gt: '>',
    ge: '≥',
  }
  if (rule.op === 'in') return `∈ ${(rule.values ?? []).join(', ')}`
  if (rule.op === 'between') return `${rule.value ?? '?'}–${rule.max ?? '?'}`
  return `${symbols[rule.op]} ${rule.value ?? '?'}`
}

/** A verdict's display name under a scheme: the viewer's own, else the stock one. */
export function qualityLabel(
  qualityClass: QualityClass,
  scheme: QualityScheme | null | undefined,
  t: (key: string) => string
): string {
  const custom = scheme?.labels?.[qualityClass]?.trim()
  return custom || t(QUALITY_LABEL_KEYS[qualityClass])
}

export type QualityTally = Record<QualityClass, number>

export function emptyQualityTally(): QualityTally {
  return Object.fromEntries(
    QUALITY_CLASSES.map((key) => [key, 0])
  ) as QualityTally
}

export function tallyQuality(
  rows: Array<{ qualityClass: QualityClass }>
): QualityTally {
  const tally = emptyQualityTally()
  for (const row of rows) tally[row.qualityClass] += 1
  return tally
}

const sumOf = (tally: QualityTally, keep: (key: QualityClass) => boolean) =>
  QUALITY_CLASSES.reduce((sum, key) => sum + (keep(key) ? tally[key] : 0), 0)

/** Readings that carry a verdict — the denominator the pass rate is out of. */
export function judgedCount(tally: QualityTally): number {
  return sumOf(tally, isJudged)
}

/** Readings that passed — the pass rate's numerator. */
export function passedCount(tally: QualityTally): number {
  return sumOf(tally, isPassing)
}

/** Readings with no verdict: no value, or raw data no check has run on. */
export function uncheckedCount(tally: QualityTally): number {
  return sumOf(tally, (key) => !isJudged(key))
}

/**
 * A run of consecutive readings sharing one class.
 *
 * `startTs`/`endTs` are the first and last plotted x of the run, in whatever
 * space the axis is in.
 */
export type QualitySegment = {
  qualityClass: QualityClass
  startX: number
  endX: number
}

/**
 * Collapse a series into runs, so a 2000-point window draws a handful of
 * rectangles instead of 2000 abutting ones.
 *
 * Single-reading runs would be zero-width, so each segment is extended by half
 * the gap to its neighbour — the same widening `computeChangeRegions` applies,
 * and for the same reason: a band with no width paints nothing.
 */
export function buildQualitySegments(
  points: Array<{ x: number; qualityClass: QualityClass }>
): QualitySegment[] {
  if (points.length === 0) return []

  const gaps: number[] = []
  for (let i = 1; i < points.length; i++) {
    gaps.push(Math.abs(points[i].x - points[i - 1].x))
  }
  gaps.sort((a, b) => a - b)
  const pad = gaps.length
    ? Math.max(gaps[Math.floor(gaps.length / 2)] / 2, 1)
    : 1

  const segments: QualitySegment[] = []
  let open: QualitySegment | null = null

  for (const point of points) {
    if (open && open.qualityClass === point.qualityClass) {
      open.endX = point.x + pad
      continue
    }
    if (open) segments.push(open)
    open = {
      qualityClass: point.qualityClass,
      startX: point.x - pad,
      endX: point.x + pad,
    }
  }
  if (open) segments.push(open)

  return segments
}
