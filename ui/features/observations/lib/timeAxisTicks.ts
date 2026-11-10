const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const STEPS = [
  SECOND,
  5 * SECOND,
  15 * SECOND,
  30 * SECOND,
  MINUTE,
  5 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
]
const MONTH_STEPS = [1, 3, 6, 12]
// The epoch was a Thursday; weeks start on Monday.
const MONDAY_ANCHOR = 4 * DAY

/**
 * Tick positions (UTC epoch ms) on round calendar times in the viewer's UTC
 * offset: midnights, whole hours, month starts. The x axis is a plain value
 * axis, whose own "nice" steps are round in milliseconds (1e8 ms ≈ 27.8 h) and
 * so land between days.
 */
export function calendarTicks(
  start: number,
  end: number,
  utcOffsetMinutes: number,
  maxTicks = 7
): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return []
  const span = end - start
  const offset = utcOffsetMinutes * MINUTE
  const ticks: number[] = []

  const step = STEPS.find((candidate) => span / candidate <= maxTicks)
  if (step) {
    const anchor = step === 7 * DAY ? MONDAY_ANCHOR : 0
    const first =
      Math.ceil((start + offset - anchor) / step) * step + anchor - offset
    for (let tick = first; tick <= end; tick += step) ticks.push(tick)
    return ticks
  }

  const months =
    MONTH_STEPS.find(
      (candidate) => span / (candidate * 30 * DAY) <= maxTicks
    ) ?? Math.ceil(span / (365 * DAY) / maxTicks) * 12
  const local = new Date(start + offset)
  let index = local.getUTCFullYear() * 12 + local.getUTCMonth()
  const monthStart =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset
  if (monthStart < start) index += 1
  index = Math.ceil(index / months) * months
  for (;;) {
    const tick = Date.UTC(Math.floor(index / 12), index % 12, 1) - offset
    if (tick > end) break
    ticks.push(tick)
    index += months
  }
  return ticks
}

/**
 * The x axis range and initial zoom for a set of readings.
 *
 * Readings spanning up to `maxSpan` set the axis to their own extent, so they
 * fill the plot with no zoom applied. Longer ones keep the requested window
 * (or their extent without one) and open zoomed on the most recent `maxSpan`;
 * reset zoom shows the rest.
 */
export function initialTimeRange(
  xs: number[],
  windowStart: number | null | undefined,
  windowEnd: number | null | undefined,
  maxSpan = 7 * DAY
): {
  axisStart: number | null
  axisEnd: number | null
  zoom: { startValue: number; endValue: number } | null
  /** The axis spans the readings themselves rather than the window. */
  fromData: boolean
} {
  let min = Infinity
  let max = -Infinity
  for (const x of xs) {
    if (!Number.isFinite(x)) continue
    if (x < min) min = x
    if (x > max) max = x
  }
  if (min > max)
    return {
      axisStart: windowStart ?? null,
      axisEnd: windowEnd ?? null,
      zoom: null,
      fromData: false,
    }
  if (max - min <= maxSpan) {
    // A lone reading still needs a range around it.
    const padding = max === min ? MINUTE : 0
    return {
      axisStart: min - padding,
      axisEnd: max + padding,
      zoom: null,
      fromData: true,
    }
  }
  return {
    axisStart: windowStart ?? min,
    axisEnd: windowEnd ?? max,
    zoom: { startValue: max - maxSpan, endValue: max },
    fromData: false,
  }
}
