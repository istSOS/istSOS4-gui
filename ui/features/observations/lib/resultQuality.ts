import {
  VERDICT_COLORS,
  type Verdict,
  maskVerdict,
  numericValue,
} from '../../qc/lib/bitmask'
import { qualityFlagDescription } from '../../qc/lib/qualityFlags'
import type { Constraint } from '../../qc/lib/types'

/** Browsing uses the same fixed interpretation and palette as Edit/QC. */
export type QualityClass = Verdict
export type QualityConstraint = Constraint
export type QualityMode = 'bitmask' | 'service'
export const QUALITY_COLORS = VERDICT_COLORS
export const QUALITY_CLASSES = Object.keys(VERDICT_COLORS) as QualityClass[]
export const QUALITY_LABEL_KEYS = Object.fromEntries(
  QUALITY_CLASSES.map((key) => [key, `qc.verdict.${key}`])
) as Record<QualityClass, string>
export const parseResultQuality = numericValue

export const QUALITY_STATUS_COLORS: Record<string, string> = {
  raw: '#9e9e9e',
  filled: '#f9a825',
  no_data: '#9e9e9e',
  digital: '#1565c0',
  passed: '#2e7d32',
  failed: '#c62828',
  not_executed: '#000000',
  unused: '#616161',
}

export function qualityConstraintsOf(
  datastream: { properties?: Record<string, unknown> | null } | null | undefined
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
      typeof (entry as QualityConstraint).type === 'string' &&
      String((entry as QualityConstraint).type).trim().length > 0
  )
  return named ? (raw as QualityConstraint[]) : null
}

/** Ordered checks identify the stored bitmask; streams without checks use the service catalog. */
export function qualityModeOf(
  datastream: Parameters<typeof qualityConstraintsOf>[0]
): QualityMode {
  const constraints = qualityConstraintsOf(datastream)
  return constraints === null ||
    constraints.length > 0 ||
    datastream?.properties?.resultQualityEncoding === 'bitmask'
    ? 'bitmask'
    : 'service'
}

export function qualityClassOf(
  raw: unknown,
  constraints: QualityConstraint[] | null,
  mode: QualityMode
): QualityClass {
  if (raw == null) return 'none'
  return mode === 'bitmask' && constraints !== null
    ? maskVerdict(raw, constraints.length)
    : 'unknown'
}

export function qualityLabel(
  value: QualityClass,
  t: (key: string) => string
): string {
  return t(QUALITY_LABEL_KEYS[value])
}

export function qualitySummary(
  raw: unknown,
  constraints: QualityConstraint[] | null,
  mode: QualityMode,
  t: (key: string, options?: { defaultValue?: string }) => string
): string {
  const description = qualityFlagDescription(raw, t)
  if (mode === 'service' || description) {
    if (raw == null) return t('qc.explain.no_quality')
    return description || t('qc.workflow.unknown_code')
  }
  return qualityLabel(qualityClassOf(raw, constraints, mode), t)
}

export type QualityTally = Record<QualityClass, number>
export function tallyQuality(
  rows: Array<{ qualityClass: QualityClass }>
): QualityTally {
  const tally = Object.fromEntries(
    QUALITY_CLASSES.map((key) => [key, 0])
  ) as QualityTally
  for (const row of rows) tally[row.qualityClass]++
  return tally
}
export type QualitySegment = {
  qualityClass: QualityClass
  startX: number
  endX: number
}
export function buildQualitySegments(
  points: Array<{ x: number; qualityClass: QualityClass }>
): QualitySegment[] {
  if (!points.length) return []
  const gaps = points
    .slice(1)
    .map((point, i) => Math.abs(point.x - points[i].x))
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b)
  const pad = gaps.length
    ? Math.max(gaps[Math.floor(gaps.length / 2)] / 2, 1)
    : 1
  const segments: QualitySegment[] = []
  for (const point of points) {
    const last = segments.at(-1)
    if (last && last.qualityClass === point.qualityClass)
      last.endX = point.x + pad
    else
      segments.push({
        qualityClass: point.qualityClass,
        startX: point.x - pad,
        endX: point.x + pad,
      })
  }
  return segments
}
