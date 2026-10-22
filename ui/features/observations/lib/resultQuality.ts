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
 * the only one shipped in this project: `ftp2istsos4` packs two bits per check
 * and sends "3" to mean "every check passed", while `mqtt2istsos4` sends "11".
 * Under the index below both would classify as OUT_OF_RANGE. Nothing in a stored
 * value distinguishes the scales, so the viewer can say which one a datastream
 * uses: a `QualityScheme` is an ordered list of rules, and the istSOS index is
 * simply the scheme used when nobody has chosen another. This module is still
 * the only file that knows what a value means — callers hand it a scheme, they
 * never test a code themselves.
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
 */
export type QualityClass = 'pass' | 'suspect' | 'outlier' | 'range' | 'none'

/** Fixed order for legends and tallies, best-to-worst then the non-verdict. */
export const QUALITY_CLASSES: QualityClass[] = [
  'pass',
  'suspect',
  'outlier',
  'range',
  'none',
]

/**
 * Lane colours.
 *
 * These are *status* roles, not series colours: reserved, never reassigned to a
 * datastream, and always shipped with the label beside them so the lane is never
 * read by hue alone. 90 and 91 deliberately share the warning tone — both mean
 * "suspect, not impossible" — which keeps the lane inside four reserved roles
 * rather than inventing a fifth hue that no longer separates under CVD.
 */
export const QUALITY_COLORS: Record<QualityClass, string> = {
  pass: '#0ca30c',
  suspect: '#fab219',
  outlier: '#ec835a',
  range: '#d03b3b',
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
  none: 'quality.none',
}

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
 * was not run" (ftp2istsos4's 0), and that reading has not been judged any more
 * than one with no value at all.
 */
export type QualityRule = {
  op: QualityOp
  /** The compared value; the lower bound for `between`. Null while unset. */
  value: number | null
  /** `between` only — the upper bound, inclusive. */
  max?: number | null
  /** `in` only. */
  values?: number[]
  verdict: QualityClass
}

/**
 * What a datastream's quality values mean.
 *
 * Rules are tried in order and the first match decides. A value no rule
 * matches gets `fallback`, which is always a verdict: an index that is present
 * but unexplained is still a reading someone flagged, and dropping it to "not
 * checked" would hide it. A reading with NO index is never judged, whatever the
 * scheme says — that rule is not in the list because it is not negotiable.
 */
export type QualityScheme = {
  version: 1
  rules: QualityRule[]
  fallback: Exclude<QualityClass, 'none'>
  /** Viewer's own names for the verdicts. The colours never change with them. */
  labels?: Partial<Record<QualityClass, string>>
}

/**
 * The istSOS quality index, as a scheme.
 *
 * Exactly the classifier this module shipped before schemes existed: 100 and
 * above passes, 90–93 are the SaQC codes, and anything else below 100 is a
 * failure.
 */
export const ISTSOS_QUALITY_SCHEME: QualityScheme = {
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

/**
 * Starting points for the conventions this project itself ships.
 *
 * ftp2istsos4 packs two bits per check (11 OK, 10 problem, 01 remaining, 00 not
 * executed) and sends the decimal, so one check reads 3/2/1/0. mqtt2istsos4
 * sends the literal "11" for OK; its "00" cannot be stored at all (leading zeros
 * are not JSON), so 0 is what reaches the column.
 */
export const QUALITY_PRESETS = {
  istsos: ISTSOS_QUALITY_SCHEME,
  ftp: {
    version: 1,
    rules: [
      { op: 'eq', value: 3, verdict: 'pass' },
      { op: 'eq', value: 1, verdict: 'suspect' },
      { op: 'eq', value: 2, verdict: 'range' },
      { op: 'eq', value: 0, verdict: 'none' },
    ],
    fallback: 'suspect',
  },
  mqtt: {
    version: 1,
    rules: [
      { op: 'eq', value: 11, verdict: 'pass' },
      { op: 'eq', value: 0, verdict: 'none' },
    ],
    fallback: 'suspect',
  },
  blank: { version: 1, rules: [], fallback: 'suspect' },
} satisfies Record<string, QualityScheme>

export type QualityPresetKey = keyof typeof QUALITY_PRESETS

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
 * rule matched, or `'unset'` when there was no index to judge.
 */
export type QualityRuleRef = number | 'fallback' | 'unset'

export type QualityMatch = {
  qualityClass: QualityClass
  rule: QualityRuleRef
}

/** Judge an index under a scheme, and say which rule did it. */
export function matchQuality(
  index: number | null,
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME
): QualityMatch {
  if (index === null) return { qualityClass: 'none', rule: 'unset' }
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
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME
): QualityClass {
  return matchQuality(index, scheme).qualityClass
}

/** Convenience for callers holding a raw value. */
export function qualityClassOf(
  raw: unknown,
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME
): QualityClass {
  return classifyQuality(parseResultQuality(raw), scheme)
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
function representativeIndexes(scheme: QualityScheme): number[] {
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
export function findShadowedRules(scheme: QualityScheme): (number[] | null)[] {
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
  return {
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
  return { pass: 0, suspect: 0, outlier: 0, range: 0, none: 0 }
}

export function tallyQuality(
  rows: Array<{ qualityClass: QualityClass }>
): QualityTally {
  const tally = emptyQualityTally()
  for (const row of rows) tally[row.qualityClass] += 1
  return tally
}

/** Readings that carry a verdict — the denominator the pass rate is out of. */
export function judgedCount(tally: QualityTally): number {
  return tally.pass + tally.suspect + tally.outlier + tally.range
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
