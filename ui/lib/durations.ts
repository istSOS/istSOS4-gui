// Parse ISO 8601 durations like PT10M, PT1H30M, PT45S -> ms
export function isoDurationToMs(d?: string): number | null {
  if (!d || typeof d !== 'string') return null

  const m =
    /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(
      d.trim()
    )
  if (!m) return null

  const hours = m[1] ? Number(m[1]) : 0
  const mins = m[2] ? Number(m[2]) : 0
  const secs = m[3] ? Number(m[3]) : 0

  if (![hours, mins, secs].every((x) => Number.isFinite(x))) return null
  return (hours * 3600 + mins * 60 + secs) * 1000
}

// SensorThings phenomenonTime can be instant OR "start/end" interval.
// We use the END of the interval.
export function parsePhenomenonTimeMs(t?: string): number | null {
  if (!t || typeof t !== 'string') return null
  const s = t.includes('/') ? t.split('/')[1]?.trim() : t.trim()
  if (!s) return null
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : null
}
