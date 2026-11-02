export type SeriesLine = 'solid' | 'dashed' | 'dotted' | 'none'
export type SeriesAppearance = {
  type?: 'line' | 'bar'
  color?: string
  line?: SeriesLine
  points?: boolean
}
export type SeriesAppearances = Record<string, SeriesAppearance>
export const EMPTY_APPEARANCES: SeriesAppearances = {}
export const SERIES_COLORS = [
  '#008374',
  '#2563eb',
  '#c2410c',
  '#7c3aed',
  '#be123c',
  '#374151',
  '#0891b2',
  '#a16207',
]
export const SERIES_APPEARANCE_KEY = 'istsos:series-appearance:v1'

export function validAppearance(raw: unknown): SeriesAppearance {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const value = raw as SeriesAppearance
  const style: SeriesAppearance = {}
  if (value.type === 'line' || value.type === 'bar') style.type = value.type
  if (typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color))
    style.color = value.color
  if (['solid', 'dashed', 'dotted', 'none'].includes(value.line ?? ''))
    style.line = value.line
  if (typeof value.points === 'boolean') style.points = value.points
  if (style.line === 'none') style.points = true
  return style
}
export function readAppearances(raw: string | null): SeriesAppearances {
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).map(([key, style]) => [key, validAppearance(style)])
    )
  } catch {
    return {}
  }
}
export function resolveAppearance(
  style: SeriesAppearance | undefined,
  color: string,
  comparison = false
) {
  return {
    type: style?.type ?? 'line',
    color: style?.color ?? color,
    line: style?.line ?? (comparison ? 'dashed' : 'solid'),
    points: style?.points ?? false,
  }
}
