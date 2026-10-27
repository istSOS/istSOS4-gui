const MINUTE = 60000

export const UTC_OFFSETS = Array.from(
  { length: 105 },
  (_, index) => -720 + index * 15
)
export const validUtcOffset = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= -720 &&
  value <= 840 &&
  value % 15 === 0

export function formatUtcOffset(minutes: number): string {
  const absolute = Math.abs(minutes)
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

// Editor state remains UTC. Only datetime-local controls use the selected offset.
export function toOffsetInput(utc: string, minutes: number): string {
  if (!utc) return ''
  const timestamp = Date.parse(`${utc}Z`)
  return Number.isFinite(timestamp)
    ? new Date(timestamp + minutes * MINUTE).toISOString().slice(0, -1)
    : ''
}

export function fromOffsetInput(local: string, minutes: number): string {
  if (!local) return ''
  const timestamp = Date.parse(`${local}Z`)
  return Number.isFinite(timestamp)
    ? new Date(timestamp - minutes * MINUTE).toISOString().slice(0, -1)
    : ''
}

export function formatObservationTime(value: string, minutes: number): string {
  return value
    .split('/')
    .map((instant) => {
      const timestamp = Date.parse(instant)
      if (!Number.isFinite(timestamp)) return instant
      if (minutes === 0 && instant.endsWith('Z')) return instant
      const iso = new Date(timestamp + minutes * MINUTE).toISOString()
      // Minute offsets do not change fractional seconds; retain source precision.
      const fraction = instant.match(/\.(\d+)/)?.[1]
      return (
        iso.slice(0, 19) +
        (fraction ? `.${fraction}` : '') +
        formatUtcOffset(minutes)
      )
    })
    .join('/')
}

export function chartTimeLabel(
  timestamp: number,
  minutes: number,
  wide: boolean
): string {
  const iso = new Date(timestamp + minutes * MINUTE).toISOString()
  return wide ? iso.slice(0, 16).replace('T', ' ') : iso.slice(11, 16)
}
