import type { Constraint } from './types'

export const NO_DATA_VALUES = new Set([999.9, -999, -9999, -999.9, -999.99])

export function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === 'boolean')
    return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function isMissing(value: unknown): boolean {
  const number = numericValue(value)
  return number === null || NO_DATA_VALUES.has(number)
}

// Up to four existing checks plus data state and a separate human pair.
export function parseMask(value: unknown): number | null {
  const number = numericValue(value)
  return number !== null &&
    Number.isInteger(number) &&
    number >= 0 &&
    number <= 4095
    ? number
    : null
}

export function slotState(mask: number, slot: number): number {
  return (mask >> (2 * slot)) & 3
}

export function setSlot(mask: number, slot: number, state: number): number {
  return (mask & ~(3 << (2 * slot))) | ((state & 3) << (2 * slot))
}

export type Verdict =
  | 'pass'
  | 'failed'
  | 'partial'
  | 'none'
  | 'missing'
  | 'unknown'
  | 'stale'
  | 'accepted'
  | 'rejected'
export const VERDICT_COLORS: Record<Verdict, string> = {
  pass: '#0ca30c',
  failed: '#d03b3b',
  partial: '#fab219',
  none: '#94a3b8',
  missing: '#64748b',
  unknown: '#a78bfa',
  stale: '#eb6834',
  accepted: '#00897b',
  rejected: '#b71c1c',
}

export function fitsMask(raw: unknown, checks: number): boolean {
  const mask = parseMask(raw)
  return (
    mask !== null &&
    checks >= 0 &&
    checks <= 4 &&
    mask < 2 ** (2 * (checks + 2))
  )
}

export function binaryMask(raw: unknown, checks: number): string {
  const mask = parseMask(raw)
  if (mask === null) return '—'
  return (
    mask
      .toString(2)
      .padStart(2 * (checks + 2), '0')
      .match(/.{1,2}(?=(.{2})*$)/g)
      ?.join(' ') ?? '—'
  )
}

export const dataStatus = (mask: number) =>
  ['missing', 'digital', 'filled', 'raw'][slotState(mask, 0)]
export const checkStatus = (state: number) =>
  ['not_run', 'reserved', 'failed', 'passed'][state]
export const humanStatus = (state: number) =>
  ['not_reviewed', 'reserved', 'rejected', 'accepted'][state]

export function oasiQuality(raw: unknown, checks: number): number | null {
  if (!fitsMask(raw, checks)) return null
  const mask = parseMask(raw)!
  const human = slotState(mask, checks + 1)
  if (human) return human === 3 ? 10 : human === 2 ? 6 : null
  const states = new Set(
    Array.from({ length: checks }, (_, i) => slotState(mask, i + 1))
  )
  if (states.size === 1 && states.has(2)) return 1
  if (states.size === 1 && states.has(3)) return 3
  if (states.has(2) || (states.size === 2 && states.has(0) && states.has(3)))
    return 2
  if (slotState(mask, 0) === 3 && [...states].every((state) => state === 0))
    return 0
  return null
}

export function inspectQuality(
  rows: Array<{ resultQuality: unknown }>,
  checks: number
) {
  let candidate = 0,
    raw = 0
  for (const row of rows) {
    if (!fitsMask(row.resultQuality, checks)) continue
    candidate++
    const mask = parseMask(row.resultQuality)!
    if (mask === 0 || mask === 3) raw++
  }
  return {
    total: rows.length,
    candidate,
    raw,
    unknown: rows.length - candidate,
  }
}

export function maskVerdict(
  raw: unknown,
  checks: number,
  stale: number[] = []
): Verdict {
  const mask = parseMask(raw)
  if (mask === null) return raw == null ? 'none' : 'unknown'
  if (!fitsMask(raw, checks)) return 'unknown'
  const human = slotState(mask, checks + 1)
  if (human === 3) return 'accepted'
  if (human === 2) return 'rejected'
  if (stale.length) return 'stale'
  if (slotState(mask, 0) === 0) return 'missing'
  if (
    [...Array.from({ length: checks }, (_, i) => i + 1), checks + 1].some(
      (slot) => slotState(mask, slot) === 1
    )
  )
    return 'unknown'
  const states = Array.from({ length: Math.min(checks, 4) }, (_, i) =>
    slotState(mask, i + 1)
  )
  if (states.includes(2)) return 'failed'
  if (states.includes(0)) return 'partial'
  // Raw data passing slot 0 alone does not mean any QC has been performed.
  return states.length ? 'pass' : 'none'
}

export function windowMs(window: unknown): number | null {
  if (typeof window !== 'string') return null
  const match = window.match(/^\s*(\d+)\s*(s|min|h|d)\s*$/i)
  if (!match || Number(match[1]) <= 0) return null
  return (
    Number(match[1]) *
    { s: 1000, min: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()]
  )
}

export function samplingMs(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  )
  if (!match) return null
  const ms =
    (Number(match[1] || 0) * 86400 +
      Number(match[2] || 0) * 3600 +
      Number(match[3] || 0) * 60 +
      Number(match[4] || 0)) *
    1000
  return ms > 0 ? ms : null
}

export function bufferSize(
  constraints: Constraint[],
  sampling?: string
): number {
  const step = samplingMs(sampling)
  const windows = constraints
    .map((c) => windowMs(c.window))
    .filter((w): w is number => w !== null)
  return windows.length && step
    ? Math.ceil(Math.max(...windows) / step) + 3
    : 50
}

export function rawText(value: unknown): string {
  if (value === undefined || value === null) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
