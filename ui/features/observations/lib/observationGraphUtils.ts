import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Datastream, Observation } from '@/types/domain'

dayjs.extend(utc)

export type GraphSeriesEntry = {
  id: string
  name: string
  unit: string
  observedProperty: string
  rows: Array<{ ts: number; value: number }>
}

export function toNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const n = Number(x)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function extractTimestamp(obs: Observation): number | null {
  const raw = obs?.phenomenonTime
  const d = dayjs.utc(raw)
  const ts = d.valueOf()
  return Number.isFinite(ts) ? ts : null
}

export function withAlpha(color: string, alpha: number) {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const isShort = hex.length === 3
    const isLong = hex.length === 6
    if (!isShort && !isLong) return color

    const normalized = isShort
      ? hex
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : hex
    const int = Number.parseInt(normalized, 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

export function buildRows(observations: Observation[]) {
  const rows: Array<{ ts: number; value: number }> = []
  for (const obs of Array.isArray(observations) ? observations : []) {
    const ts = extractTimestamp(obs)
    const value = toNumber(obs?.result)
    if (ts === null || value === null) continue
    rows.push({ ts, value })
  }
  rows.sort((a, b) => a.ts - b.ts)
  return rows
}

export function buildSeriesEntries({
  allSeries,
  datastream,
  comparisonDatastream,
  chartData,
  comparisonChartData,
}: {
  allSeries: Array<{ datastream: Datastream; observations: Observation[] }>
  datastream: Datastream | null
  comparisonDatastream: Datastream | null
  chartData: Array<{ ts: number; value: number }>
  comparisonChartData: Array<{ ts: number; value: number }>
}): GraphSeriesEntry[] {
  if (Array.isArray(allSeries) && allSeries.length > 0) {
    return allSeries.map((entry) => {
      const ds = entry?.datastream
      const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
      const dsName = String(ds?.name ?? dsId)
      const dsUnit = String(ds?.unitOfMeasurement?.symbol ?? '')
      const dsObservedProperty = String(ds?.ObservedProperty?.name ?? '')
      return {
        id: dsId,
        name: dsName,
        unit: dsUnit,
        observedProperty: dsObservedProperty,
        rows: buildRows(entry?.observations),
      }
    })
  }

  return [
    {
      id: String(datastream?.['@iot.id'] ?? datastream?.id ?? ''),
      name: String(datastream?.name ?? ''),
      unit: String(datastream?.unitOfMeasurement?.symbol ?? ''),
      observedProperty: String(datastream?.ObservedProperty?.name ?? ''),
      rows: chartData,
    },
    ...(comparisonDatastream
      ? [
          {
            id: String(
              comparisonDatastream?.['@iot.id'] ??
                comparisonDatastream?.id ??
                ''
            ),
            name: String(comparisonDatastream?.name ?? ''),
            unit: String(comparisonDatastream?.unitOfMeasurement?.symbol ?? ''),
            observedProperty: String(
              comparisonDatastream?.ObservedProperty?.name ?? ''
            ),
            rows: comparisonChartData,
          },
        ]
      : []),
  ]
}

export function resolvePrimaryAndSecondarySeries(
  seriesEntries: GraphSeriesEntry[],
  activeDatastreamIds: string[]
) {
  const selectedSeries = seriesEntries.filter((entry) =>
    activeDatastreamIds.includes(entry.id)
  )
  const primarySeries =
    selectedSeries[0] ??
    seriesEntries.find((entry) => activeDatastreamIds.includes(entry.id)) ??
    seriesEntries[0]
  const secondarySeries = selectedSeries[1] ?? null
  return { primarySeries, secondarySeries }
}
