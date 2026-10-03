import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Datastream, Observation, RecordCommit } from '@/types/domain'

import {
  ISTSOS_QUALITY_SCHEME,
  matchQuality,
  parseResultQuality,
  type QualityClass,
  type QualityRuleRef,
  type QualityScheme,
} from './resultQuality'

dayjs.extend(utc)

/**
 * One plotted point, with the commit that produced the reading behind it.
 *
 * `commit` is null when the backend does not report one — versioning disabled,
 * or a record written before commits were kept. The chart must stay readable in
 * that case, so nothing downstream may assume it is present.
 */
export type GraphRow = {
  ts: number
  value: number
  commit: RecordCommit | null
  /**
   * The quality index behind this reading, or null when it carries none.
   *
   * Kept alongside `qualityClass` because the raw code is what someone
   * debugging an ingest needs to see — the class is the chart's reading of it,
   * not the record's own value.
   */
  quality: number | null
  qualityClass: QualityClass
  /** The rule of the series' scheme that decided `qualityClass`. */
  qualityRule: QualityRuleRef
}

export type GraphSeriesEntry = {
  id: string
  name: string
  unit: string
  observedProperty: string
  rows: GraphRow[]
  /** How this series' quality values are read — see `qualitySchemeStore`. */
  qualityScheme: QualityScheme
  /**
   * ISO-8601 snapshot this series was read at — set only in As-Of *compare*
   * mode, where two series share one datastream and differ only by `$as_of`.
   * Null everywhere else (live mode, and plain As-Of property comparison).
   */
  asOf?: string | null
  /**
   * Epoch ms of `asOf`. In compare mode each series is anchored to its own
   * snapshot, so the aligned x-axis can plot `ts - anchorTs` and lay two
   * different 7-day windows on top of each other.
   */
  anchorTs?: number | null
  /**
   * Data source the datastream was read from, so a commit author on one of its
   * readings is looked up where that user exists. Null means the primary one.
   */
  endpoint?: string | null
}

/** One fetched series, before it is turned into a `GraphSeriesEntry`. */
export type SeriesSource = {
  datastream: Datastream
  observations: Observation[]
  /** ISO-8601 snapshot this series was read at (As-Of compare mode only). */
  asOf?: string | null
  /**
   * ISO-8601 instant the aligned x-axis pins this series' right edge to.
   *
   * Defaults to `asOf`, and must differ whenever the snapshot's own window came
   * up empty and fell back to the latest data available at that snapshot: the
   * points then sit weeks before `asOf`, and anchoring there would push them off
   * the −7d…0 axis instead of laying the two windows on top of each other.
   */
  anchorIso?: string | null
}

/**
 * Series identity.
 *
 * Everything downstream — legend keys, `activeDatastreamIds`, tooltip lookup,
 * y-axis assignment — addresses a series by this id. Keying on the datastream
 * id alone is enough while every series is a *different* datastream, but in
 * As-Of compare mode both series ARE the same datastream and would collide,
 * silently dropping one. Qualifying by `$as_of` keeps them distinct.
 */
export function makeSeriesId(datastreamId: string, asOf?: string | null) {
  const id = String(datastreamId ?? '')
  return asOf ? `${id}@${asOf}` : id
}

/**
 * x-coordinate a plotted row sits at — offset ms on the aligned axis, epoch ms
 * everywhere else.
 *
 * The tooltip is handed this by ECharts and has to find the row again from it,
 * and the click handler has to turn a pixel back into it, so all three must
 * agree. Hence one definition rather than the same expression written out at
 * each site.
 */
export function plottedX(
  entry: Pick<GraphSeriesEntry, 'anchorTs'>,
  ts: number,
  alignedAxis: boolean
) {
  return alignedAxis && entry.anchorTs != null ? ts - entry.anchorTs : ts
}

/** The datastream id behind a (possibly snapshot-qualified) series id. */
export function datastreamIdFromSeriesId(seriesId: string) {
  return String(seriesId ?? '').split('@')[0] ?? ''
}

/** Legend/tooltip label for a snapshot — both series share a datastream name. */
export function formatSnapshotLabel(asOf: string) {
  return `${dayjs.utc(asOf).format('MMM D, YYYY HH:mm')} UTC`
}

/** A span of phenomenon time where two snapshots disagree. Epoch ms. */
export type ChangeRegion = { start: number; end: number }

/** What a comparison of two snapshots found. */
export type SnapshotDiff = {
  /**
   * Spans where the measured VALUES differ — what the red wash shades.
   *
   * Quality-only differences deliberately do not produce regions: they are
   * already legible in the stacked A/B quality lanes, and a second wash over the
   * plot would compete with this one for the same pixels while saying something
   * different.
   */
  regions: ChangeRegion[]
  /** Readings whose value differs, or that exist in only one snapshot. */
  valueChanged: number
  /** Readings present in both whose quality verdict differs. */
  qualityChanged: number
  /** True when neither the values nor the quality moved anywhere in the window. */
  unchanged: boolean
}

/**
 * Where two snapshots of one datastream disagree.
 *
 * Only meaningful on a SHARED window: aligned mode puts each series on its own
 * date range, so equal timestamps are not comparable and the caller must not
 * ask. A timestamp counts as changed when the values differ, when the quality
 * verdict differs, or when the reading exists in only one snapshot (inserted or
 * deleted between them).
 *
 * Quality is counted separately and on purpose. A QC pass rewrites
 * `resultQuality` and leaves every `result` untouched, so a comparison that only
 * looked at values would find nothing and report that the two snapshots agree —
 * which is exactly wrong about the one kind of revision `$as_of` exists to show.
 *
 * Consecutive changed timestamps collapse into one region so the chart shades a
 * span rather than N stripes. Isolated points are widened to half a sample
 * interval either side — a zero-width band would paint nothing.
 */
export function computeChangeRegions(
  primaryRows: Array<{ ts: number; value: number; qualityClass?: QualityClass }>,
  compareRows: Array<{ ts: number; value: number; qualityClass?: QualityClass }>
): SnapshotDiff {
  const a = new Map(primaryRows.map((r) => [r.ts, r]))
  const b = new Map(compareRows.map((r) => [r.ts, r]))
  const stamps = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y)
  if (stamps.length === 0) {
    return { unchanged: false, regions: [], valueChanged: 0, qualityChanged: 0 }
  }

  // Half the median gap, used to give isolated changed points a visible width.
  const gaps: number[] = []
  for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1])
  gaps.sort((x, y) => x - y)
  const pad = gaps.length ? Math.max(gaps[Math.floor(gaps.length / 2)] / 2, 1) : 1

  const regions: ChangeRegion[] = []
  let open: number | null = null
  let last = 0
  let valueChanged = 0
  let qualityChanged = 0

  for (const ts of stamps) {
    const rowA = a.get(ts)
    const rowB = b.get(ts)
    const valueDiffers = !rowA || !rowB || rowA.value !== rowB.value
    if (valueDiffers) valueChanged += 1
    // Only comparable when the reading exists on both sides; a reading present
    // in one snapshot alone is a presence change, already counted above.
    if (rowA && rowB && rowA.qualityClass !== rowB.qualityClass) {
      qualityChanged += 1
    }

    if (valueDiffers) {
      if (open === null) open = ts
      last = ts
    } else if (open !== null) {
      regions.push({ start: open - pad, end: last + pad })
      open = null
    }
  }
  if (open !== null) regions.push({ start: open - pad, end: last + pad })

  return {
    regions,
    valueChanged,
    qualityChanged,
    unchanged: valueChanged === 0 && qualityChanged === 0,
  }
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

export function buildRows(
  observations: Observation[],
  scheme: QualityScheme = ISTSOS_QUALITY_SCHEME
): GraphRow[] {
  const rows: GraphRow[] = []
  for (const obs of Array.isArray(observations) ? observations : []) {
    const ts = extractTimestamp(obs)
    const value = toNumber(obs?.result)
    if (ts === null || value === null) continue
    // Only kept when the expand actually returned one — an empty object would
    // render as a commit block with every field blank.
    const commit = obs?.Commit
    // resultQuality already rides along on the request the chart makes: it is in
    // the API's default $select for Observation and ObservationTravelTime alike,
    // so a snapshot returns the quality in effect at that instant for free.
    const quality = parseResultQuality(obs?.resultQuality)
    const match = matchQuality(quality, scheme)
    rows.push({
      ts,
      value,
      commit: commit && commit['@iot.id'] != null ? commit : null,
      quality,
      qualityClass: match.qualityClass,
      qualityRule: match.rule,
    })
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
  schemeFor = () => ISTSOS_QUALITY_SCHEME,
}: {
  allSeries: SeriesSource[]
  datastream: Datastream | null
  comparisonDatastream: Datastream | null
  chartData: GraphRow[]
  comparisonChartData: GraphRow[]
  /**
   * The scheme each datastream's quality is read under. `chartData` and
   * `comparisonChartData` must already have been built with the same one.
   */
  schemeFor?: (datastream: Datastream | null) => QualityScheme
}): GraphSeriesEntry[] {
  if (Array.isArray(allSeries) && allSeries.length > 0) {
    return allSeries.map((entry) => {
      const ds = entry?.datastream
      const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
      const dsUnit = String(ds?.unitOfMeasurement?.symbol ?? '')
      const dsObservedProperty = String(ds?.ObservedProperty?.name ?? '')
      const asOf = entry?.asOf ?? null
      // In compare mode both series carry the same datastream name, so the
      // snapshot is what tells them apart in the legend and tooltip.
      const dsName = asOf
        ? formatSnapshotLabel(asOf)
        : String(ds?.name ?? dsId)
      // The aligned axis pins each series' right edge to its own window end,
      // which is `asOf` unless that snapshot fell back to older data.
      const anchorIso = entry?.anchorIso ?? asOf
      const qualityScheme = schemeFor(ds ?? null)
      return {
        id: makeSeriesId(dsId, asOf),
        name: dsName,
        unit: dsUnit,
        observedProperty: dsObservedProperty,
        rows: buildRows(entry?.observations, qualityScheme),
        qualityScheme,
        asOf,
        anchorTs: anchorIso ? dayjs.utc(anchorIso).valueOf() : null,
        endpoint: ds?.__sourceEndpoint ?? null,
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
      qualityScheme: schemeFor(datastream),
      endpoint: datastream?.__sourceEndpoint ?? null,
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
            qualityScheme: schemeFor(comparisonDatastream),
            endpoint: comparisonDatastream?.__sourceEndpoint ?? null,
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
