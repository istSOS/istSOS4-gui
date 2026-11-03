/** Plot an instant at itself and a closed ISO8601 start/end interval at its end.
 * Keep the original phenomenonTime separately for identity, display and export.
 */
function instantTimestamp(value: string): number {
  return Date.parse(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
  )
}

function bounds(value: unknown) {
  if (typeof value !== 'string') return null
  const parts = value
    .trim()
    .split('/')
    .map((part) => part.trim())
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => !part))
    return null
  const start = instantTimestamp(parts[0])
  const end = instantTimestamp(parts[parts.length - 1])
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
    return null
  return { end: parts[parts.length - 1], timestamp: end }
}

export function phenomenonTimeEnd(value: unknown): string | null {
  return bounds(value)?.end ?? null
}

export function phenomenonTimeTimestamp(value: unknown): number | null {
  return bounds(value)?.timestamp ?? null
}

/** istSOS compares lt/le against the end of phenomenonTime intervals, while
 * ge/gt compare against their start. Negating lt keeps buckets ending at the
 * lower boundary, including buckets whose start predates the selected period.
 */
export function phenomenonTimeWindowFilter(
  start?: string | null,
  end?: string | null
): string {
  return [
    end ? `phenomenonTime le ${end}` : '',
    start ? `not (phenomenonTime lt ${start})` : '',
  ]
    .filter(Boolean)
    .join(' and ')
}
