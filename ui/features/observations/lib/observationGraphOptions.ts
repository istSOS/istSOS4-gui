import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as echarts from 'echarts'

import {
  GraphSeriesEntry,
  resolvePrimaryAndSecondarySeries,
  withAlpha,
  type ChangeRegion,
  type GraphRow,
} from './observationGraphUtils'
import {
  QUALITY_CLASSES,
  QUALITY_COLORS,
  qualityLabel,
  type QualityClass,
  type QualitySegment,
} from './resultQuality'

dayjs.extend(utc)

/** For text that lands in a tooltip's HTML — verdict names are the viewer's own. */
export function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char
  )
}

/** Snapshot chrome — the markLine, matching the amber As-Of badge and banner. */
const SNAPSHOT_COLOR = '#f59e0b'

/**
 * One quality strip beneath the plot: a series' readings, collapsed into runs.
 *
 * `tag` is the row's left-hand label — absent in live mode (there is only one
 * strip and the legend below names it), "A"/"B" when comparing snapshots.
 */
export type QualityLane = {
  id: string
  tag?: string
  /** The tag's colour, where no series colour decides it (the rules preview). */
  tagColor?: string
  segments: QualitySegment[]
}

/** Series id of the strip itself, so the legend and tooltip can exclude it. */
const QUALITY_SERIES_ID = '__quality_lane__'

/** Series id of the strip's invisible snap targets — see `buildLaneSnapSeries`. */
const QUALITY_SNAP_SERIES_ID = '__quality_lane_snap__'

/** True for the series that exist only to draw or steer the strips. */
function isLaneSeries(seriesName: unknown) {
  const name = String(seriesName ?? '')
  return name === QUALITY_SERIES_ID || name === QUALITY_SNAP_SERIES_ID
}

/** Height of one strip, and the gap between two of them. */
const LANE_HEIGHT = 14
const LANE_GAP = 4

/**
 * Class index that marks a strip's label item rather than a run of readings.
 *
 * The label rides in the same custom series as the rects, as one extra data
 * item per tagged lane, so it is placed by the same coordinate system and
 * moves with the strip when the lane grid is re-pinned. The item spans the
 * lane's whole data extent so that `weakFilter` keeps it through any zoom that
 * keeps any part of the strip.
 */
const LANE_TAG_ITEM = -1

/** Pixels between a strip's label and its left edge. */
const LANE_TAG_GAP = 6

/**
 * Distance from the container bottom to the plot's lower edge in the laneless
 * chart — the band the rotated date labels and the toolbox live in. The lane
 * block is inserted above it, and the plot gives up exactly that much height.
 */
const AXIS_BAND = 110

/** Breathing room between the plot's lower edge and the first strip. */
const LANE_OFFSET = 10

function laneBlockHeight(laneCount: number) {
  if (laneCount === 0) return 0
  return laneCount * LANE_HEIGHT + (laneCount - 1) * LANE_GAP
}

/**
 * Pin the lane grid's horizontal extent to the plot grid's.
 *
 * Both grids are declared with the same `left`/`right`, but only the plot grid
 * carries a y-axis, and ECharts widens a grid to fit its axis' labels and name.
 * The plot therefore resolves to a wider left inset than the lane — 62px against
 * the declared 50 for a two-digit scale, ~93 for a seven-digit one — so a strip
 * drawn at the declared inset starts left of the line it describes and every
 * segment boundary is off by that difference.
 *
 * How much the axis needs depends on the rendered label text, so it cannot be
 * computed while the option is being built. Reading the resolved rect back and
 * re-pinning the lane to it is exact for any data and settles in a single pass:
 * the lane grid has no axis furniture of its own, so moving it cannot change what
 * the plot needs. Both values are insets rather than coordinates, which keeps
 * them correct across a resize.
 *
 * Safe to call when there is no lane grid — it returns without touching the
 * chart.
 */
export function syncLaneGridToPlotGrid(chart: echarts.EChartsType): void {
  // `getModel`, and the `coordinateSystem` hanging off a component model, are
  // runtime API that ECharts does not surface in its published types.
  type GridComponent = { coordinateSystem?: { getRect?: () => Rect } }
  type Rect = { x: number; y: number; width: number; height: number }
  const model = (
    chart as unknown as {
      getModel?: () => {
        getComponent?: (type: string, index: number) => GridComponent | undefined
      }
    }
  ).getModel?.()

  const plot = model?.getComponent?.('grid', 0)
  const lane = model?.getComponent?.('grid', 1)
  if (!plot || !lane) return

  const rect = plot.coordinateSystem?.getRect?.()
  if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.width)) return

  const containerWidth = chart.getWidth()
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return

  const right = containerWidth - (rect.x + rect.width)
  if (!Number.isFinite(right)) return

  // An empty object for grid 0 leaves the plot exactly as laid out; only the
  // lane moves. A merge, not `notMerge`, so the viewer's dataZoom survives.
  chart.setOption({
    grid: [{}, { left: rect.x, right: Math.max(right, 0) }],
  })
}

/**
 * Series B when comparing two snapshots.
 *
 * Amber is the As-Of mode's own colour (badge, banner, map pins, the snapshot
 * markLine right here on this chart), so an amber *series* reads as chrome
 * rather than as data.
 *
 * A light orange, chosen for how it reads against the teal primary. Separation
 * from teal is comfortable (worst-case CVD ΔE 16.4, normal-vision 31.2), but at
 * 2.2:1 it sits under the 3:1 floor for a mark on this white surface.
 * `#ea580c` is the drop-in if it ever needs to clear 3:1 on its own.
 */
const COMPARE_B_COLOR = '#fb923c'

/**
 * B's stroke in compare mode.
 *
 * B is the *reference* being checked against, so it is thinner, slightly
 * transparent and dashed, drawn on top of A. Where the snapshots match, B's
 * dashes ride along A's line; where they diverge, B separates out and becomes
 * visible on its own.
 */
const COMPARE_B_WIDTH = 1.5
const COMPARE_B_OPACITY = 0.9

/** Wash marking spans where the two snapshots disagree. */
const CHANGE_BAND_COLOR = '#ef4444'

export type SnapshotMarker = {
  /** x-coordinate in the axis' own space (offset ms when aligned, else epoch ms) */
  value: number
  label: string
}

/**
 * Series id -> the colour it is drawn in.
 *
 * Shared with the details rail so its dots match the lines exactly. Keeping one
 * definition matters more than it looks: the secondary colour depends on
 * whether this is a snapshot comparison or a property comparison, and a rail
 * that guessed would mislabel which series it is describing.
 */
export function resolveSeriesColors(
  seriesEntries: GraphSeriesEntry[],
  activeDatastreamIds: string[],
  primaryColor: string,
  isCompare: boolean
) {
  const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
    seriesEntries,
    activeDatastreamIds
  )
  const secondaryColor = isCompare ? COMPARE_B_COLOR : SNAPSHOT_COLOR
  const colors = new Map<string, string>()
  for (const entry of seriesEntries) {
    colors.set(
      entry.id,
      entry.id === primarySeries?.id
        ? primaryColor
        : entry.id === secondarySeries?.id
          ? secondaryColor
          : '#94a3b8'
    )
  }
  return colors
}

/**
 * The primary series' vertical lines: the amber snapshot markers, plus a teal
 * line at the reading the details rail is currently describing.
 *
 * Exported because the rail's line has to move on every click, and rebuilding
 * the whole option to move it would discard the viewer's `dataZoom` state. The
 * component merges the result of this back onto the primary series by id
 * instead — so both paths must produce the same shape, which is why there is
 * one function rather than two similar literals.
 */
export function buildMarkLine(
  snapshotMarkers: SnapshotMarker[],
  selectedX: number | null,
  primaryColor: string
) {
  return {
    silent: true,
    symbol: 'none' as const,
    lineStyle: {
      color: SNAPSHOT_COLOR,
      type: 'dashed' as const,
      width: 2,
    },
    data: [
      ...snapshotMarkers.map((marker) => ({
        xAxis: marker.value,
        label: {
          show: true,
          formatter: marker.label,
          position: 'insideStartTop' as const,
          color: '#b45309',
          fontSize: 11,
        },
      })),
      ...(selectedX !== null
        ? [
            {
              xAxis: selectedX,
              label: { show: false },
              lineStyle: {
                color: primaryColor,
                type: 'solid' as const,
                width: 1.5,
                opacity: 0.9,
              },
            },
          ]
        : []),
    ],
  }
}

/**
 * The strips, as one custom series over the lane grid (x axis 1, y axis 2).
 *
 * A custom series rather than a bar or heatmap because a segment spans an
 * arbitrary x range — it is a run of readings already collapsed by
 * `buildQualitySegments`, so a window of 2000 points draws a handful of rects
 * instead of 2000 abutting ones.
 *
 * `silent` keeps it out of hover and click handling entirely: the strip is a
 * readout of the series above it, never a thing to select in its own right.
 *
 * Shared by the observation chart and the rules preview, so a strip reads the
 * same wherever it is drawn. `tagColor` colours each strip's label.
 */
export function buildQualityLaneSeries(
  qualityLanes: QualityLane[],
  tagColor: (lane: QualityLane) => string,
  axes: { xAxisIndex: number; yAxisIndex: number } = {
    xAxisIndex: 1,
    yAxisIndex: 2,
  }
): echarts.CustomSeriesOption {
  const laneCount = qualityLanes.length
  return {
    id: QUALITY_SERIES_ID,
    name: QUALITY_SERIES_ID,
    type: 'custom',
    ...axes,
    silent: true,
    animation: false,
    // Out of the axis tooltip as well. Left in, its runs are what the crosshair
    // snaps to while the cursor is over the strips, so the chip there named the
    // reading at the nearest run boundary — hours or days from the cursor on a
    // long uniform run. `buildLaneSnapSeries` gives that axis readings instead.
    tooltip: { show: false },
    // [ startX, endX, laneIndex, classIndex ]
    data: qualityLanes.flatMap((lane, laneIndex) => {
      const runs = lane.segments.map((segment) => [
        segment.startX,
        segment.endX,
        laneIndex,
        QUALITY_CLASSES.indexOf(segment.qualityClass),
      ])
      // The label beside the strip. Absent when there is one strip and the
      // legend below names it.
      if (!lane.tag || lane.segments.length === 0) return runs
      const first = lane.segments[0]
      const last = lane.segments[lane.segments.length - 1]
      return [...runs, [first.startX, last.endX, laneIndex, LANE_TAG_ITEM]]
    }),
    encode: { x: [0, 1], y: 2 },
    renderItem: (
      params: echarts.CustomSeriesRenderItemParams,
      api: echarts.CustomSeriesRenderItemAPI
    ) => {
      const laneIndex = Number(api.value(2))
      const classIndex = Number(api.value(3))
      const coordSys = params.coordSys as unknown as {
        x: number
        y: number
        width: number
        height: number
      }
      if (classIndex === LANE_TAG_ITEM) {
        const lane = qualityLanes[laneIndex]
        // In the gutter left of the strip, on the lane's centre line, in the
        // colour of the series it describes — so the strip and the line above
        // it pair by colour as well as by letter.
        const centreY = api.coord([api.value(0), laneCount - laneIndex - 0.5])[1]
        return {
          type: 'text',
          style: {
            text: lane?.tag ?? '',
            x: coordSys.x - LANE_TAG_GAP,
            y: centreY,
            align: 'right',
            verticalAlign: 'middle',
            fontSize: 10,
            fontWeight: 'bold',
            fill: lane ? tagColor(lane) : '#94a3b8',
          },
        }
      }
      // Lane 0 sits at the top, so it takes the highest band on an axis that
      // runs 0..laneCount. The 0.08 inset leaves a hairline between two
      // stacked strips without needing a separate spacer.
      const topLeft = api.coord([api.value(0), laneCount - laneIndex - 0.08])
      const bottomRight = api.coord([
        api.value(1),
        laneCount - laneIndex - 0.92,
      ])
      const clipped = echarts.graphic.clipRectByRect(
        {
          x: topLeft[0],
          y: topLeft[1],
          // Never below a hairline: a run of one reading would otherwise be a
          // zero-width rect and paint nothing at all.
          width: Math.max(bottomRight[0] - topLeft[0], 1),
          height: bottomRight[1] - topLeft[1],
        },
        coordSys
      )
      if (!clipped) return undefined
      return {
        type: 'rect',
        shape: clipped,
        style: {
          fill: QUALITY_COLORS[
            (QUALITY_CLASSES[classIndex] ?? 'none') as QualityClass
          ],
        },
      }
    },
  }
}

/**
 * Invisible points on the lane grid, one per plotted reading, for the crosshair
 * to snap to while the cursor is over the strips.
 *
 * The axis under the cursor snaps to the nearest data item of its own series,
 * and the linked axis follows that value unsnapped. Over the plot that is a
 * reading, which the strip's axis then follows. Over the strips it would be
 * nothing — the line would sit at the raw cursor position and the chip's header
 * name an instant no reading has. With these points both grids snap alike, so
 * the chip reads the same wherever along the line the cursor is.
 */
export function buildLaneSnapSeries(
  plottedXs: Iterable<number>,
  laneCount: number,
  axes: { xAxisIndex: number; yAxisIndex: number } = {
    xAxisIndex: 1,
    yAxisIndex: 2,
  }
): echarts.LineSeriesOption {
  const xs = Array.from(new Set(plottedXs)).sort((a, b) => a - b)
  return {
    id: QUALITY_SNAP_SERIES_ID,
    name: QUALITY_SNAP_SERIES_ID,
    type: 'line',
    ...axes,
    silent: true,
    animation: false,
    // 'none' rather than `showSymbol: false`, which still pops a hover symbol
    // onto the strip at the snapped reading.
    symbol: 'none',
    lineStyle: { opacity: 0 },
    emphasis: { disabled: true },
    data: xs.map((x) => [x, laneCount / 2]),
  }
}

/** Height of the preview's date band — one unrotated row of labels. */
const PREVIEW_AXIS_BAND = 26

/**
 * The quality rules editor's preview: one series over two or more strips, with
 * none of the observation chart's furniture.
 *
 * It exists to show how a draft scheme re-reads the same readings, so it keeps
 * only what that comparison needs — the line, the strips, a date axis and a
 * tooltip — and drops the toolbox, legend, zoom and rotated labels, which would
 * take most of a 200px-high chart for themselves.
 */
export function buildQualityPreviewOption({
  entry,
  lanes,
  primaryColor,
  tooltip,
}: {
  entry: GraphSeriesEntry
  /** Top to bottom. Each lane's `id` names the scheme it was drawn under. */
  lanes: QualityLane[]
  primaryColor: string
  /** Tooltip body for the reading at a plotted x. */
  tooltip: (row: GraphRow) => string
}): echarts.EChartsOption {
  const laneBlock = laneBlockHeight(lanes.length)
  const rowsByTs = new Map(entry.rows.map((row) => [row.ts, row]))
  const xScale = { type: 'time' as const, minInterval: 60 * 60 * 1000 }
  return {
    animation: false,
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      {
        left: 50,
        right: 20,
        top: 10,
        bottom: PREVIEW_AXIS_BAND + laneBlock + LANE_OFFSET,
      },
      { left: 50, right: 20, height: laneBlock, bottom: PREVIEW_AXIS_BAND },
    ],
    tooltip: {
      trigger: 'axis',
      borderColor: primaryColor,
      extraCssText: 'max-width:340px;white-space:normal;',
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params : [params])[0] as
          | { data?: unknown }
          | undefined
        const ts = Array.isArray(first?.data) ? Number(first.data[0]) : NaN
        const row = rowsByTs.get(ts)
        return row ? tooltip(row) : ''
      },
      axisPointer: { type: 'line', lineStyle: { color: primaryColor, width: 1 } },
    },
    xAxis: [
      {
        ...xScale,
        gridIndex: 0,
        axisLine: { lineStyle: { color: primaryColor } },
        axisLabel: { show: false },
        axisTick: { show: false },
      },
      {
        ...xScale,
        gridIndex: 1,
        axisLine: { lineStyle: { color: primaryColor } },
        axisLabel: {
          hideOverlap: true,
          fontSize: 10,
          formatter: (value: number) => dayjs.utc(value).format('DD/MM HH:mm'),
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        scale: true,
        gridIndex: 0,
        splitNumber: 3,
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { color: withAlpha(primaryColor, 0.15) } },
      },
      {
        type: 'value',
        gridIndex: 1,
        min: 0,
        max: lanes.length,
        show: false,
      },
    ],
    series: [
      {
        id: entry.id,
        name: entry.id,
        type: 'line',
        data: entry.rows.map((row) => [row.ts, row.value]),
        showSymbol: false,
        sampling: 'lttb',
        lineStyle: { color: primaryColor, width: 1.5 },
        itemStyle: { color: primaryColor },
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      buildQualityLaneSeries(
        lanes,
        (lane) => lane.tagColor ?? '#94a3b8',
        { xAxisIndex: 1, yAxisIndex: 1 }
      ),
      buildLaneSnapSeries(rowsByTs.keys(), lanes.length, {
        xAxisIndex: 1,
        yAxisIndex: 1,
      }),
    ],
  }
}

export function buildObservationGraphOption({
  seriesEntries,
  activeDatastreamIds,
  primaryColor,
  t,
  onDownloadAllDatastreams,
  snapshotMarkers = [],
  windowStart,
  windowEnd,
  alignedAxis = false,
  isCompare = false,
  changeRegions = [],
  selectedX = null,
  qualityLanes = [],
}: {
  seriesEntries: GraphSeriesEntry[]
  activeDatastreamIds: string[]
  primaryColor: string
  t: (key: string) => string
  onDownloadAllDatastreams?: () => Promise<{
    filename: string
    bytes: ArrayBuffer
  } | null>
  /** Amber dashed vertical lines. In As-Of compare mode there are two (one per
   *  snapshot) on the real-date axis, and one (at offset 0) on the aligned axis. */
  snapshotMarkers?: SnapshotMarker[]
  /** Pins the x-axis to the queried window so sparse/empty data still renders
   *  the full range and a markLine can't stretch the axis. Same space as the
   *  axis: offset ms when `alignedAxis`, epoch ms otherwise. */
  windowStart?: number | null
  windowEnd?: number | null
  /**
   * As-Of compare mode, default state: each series is anchored to its own
   * snapshot, so points are plotted as `ts - anchorTs` (−7d → 0) and two
   * different 7-day windows lie on top of each other. Off once the user picks
   * an explicit range — both series then share one real window.
   */
  alignedAxis?: boolean
  /**
   * As-Of compare mode. Both series are the same datastream at two snapshots:
   * same unit, so they share ONE y-axis (dual axes would fake a difference),
   * and the second is dashed so a perfect overlap is still readable.
   */
  isCompare?: boolean
  /**
   * Spans (epoch ms) where the two snapshots disagree, shaded so the eye lands
   * on the change instead of scanning the series. Only ever populated on a
   * shared window — aligned mode has no comparable timestamps.
   */
  changeRegions?: ChangeRegion[]
  /**
   * x-coordinate of the reading the details rail is describing, or null.
   *
   * Only the INITIAL value: afterwards the component merges a new markLine onto
   * the primary series rather than rebuilding the option, so that clicking a
   * point does not reset `dataZoom`.
   */
  selectedX?: number | null
  /**
   * Quality strips to draw beneath the plot — one per series being shown, and
   * EMPTY when nothing in the window carries a `resultQuality`.
   *
   * Empty is the common case (a stock deployment stores null for every
   * observation), and it must cost nothing: with no lanes the option below is
   * built exactly as it was before the lane existed — one grid, one x-axis
   * carrying its own labels. A permanently blank strip under every chart would
   * be worse than not having the feature.
   */
  qualityLanes?: QualityLane[]
}): echarts.EChartsOption {
  const tableBorderColor = withAlpha(primaryColor, 0.35)
  const tableHeaderBg = withAlpha(primaryColor, 0.12)
  const tableRowAltBg = withAlpha(primaryColor, 0.06)
  const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
    seriesEntries,
    activeDatastreamIds
  )

  const yLabel = primarySeries?.unit
    ? `${primarySeries.observedProperty} (${primarySeries.unit})`
    : (primarySeries?.observedProperty ?? '')
  // Compare mode plots one datastream at two snapshots — same observed property,
  // same unit — so a right-hand axis would invent a distinction that isn't there.
  const secondaryYLabel =
    secondarySeries && !isCompare
      ? secondarySeries.unit
        ? `${secondarySeries.observedProperty} (${secondarySeries.unit})`
        : secondarySeries.observedProperty
      : ''
  const showSecondaryAxis = !!secondarySeries && !isCompare
  // Live property comparison keeps amber; only snapshot-vs-snapshot goes red,
  // where amber would collide with this chart's own snapshot markLine.
  const secondaryColor = isCompare ? COMPARE_B_COLOR : SNAPSHOT_COLOR

  const seriesDataRows: Array<{ date: string; stream: string; value: string }> =
    []
  for (const entry of seriesEntries) {
    for (const row of entry.rows) {
      seriesDataRows.push({
        // Always the real timestamp — the aligned axis is a display device, the
        // exported/tabulated data must stay in absolute time.
        date: dayjs.utc(row.ts).format('YYYY-MM-DD HH:mm'),
        stream: entry.name,
        value: entry.unit ? `${row.value} ${entry.unit}` : String(row.value),
      })
    }
  }
  seriesDataRows.sort(
    (a, b) => dayjs.utc(a.date).valueOf() - dayjs.utc(b.date).valueOf()
  )

  // ── quality lane geometry ────────────────────────────────────────────────
  // With lanes the chart becomes two stacked grids sharing one x scale. The
  // date labels move onto the LANE grid's axis: they belong under the bottom-
  // most thing on screen, and left on the plot's own axis they would be drawn
  // straight over the strips.
  const laneCount = qualityLanes.length
  const hasLanes = laneCount > 0

  /**
   * Plotted x → the reading there, per series, so the tooltip can name a
   * reading's quality without rescanning every row on each hover.
   */
  const rowsByPlottedX = new Map<string, Map<number, GraphRow>>()
  for (const entry of seriesEntries) {
    const byX = new Map<number, GraphRow>()
    for (const row of entry.rows) {
      byX.set(
        alignedAxis && entry.anchorTs != null ? row.ts - entry.anchorTs : row.ts,
        row
      )
    }
    rowsByPlottedX.set(entry.id, byX)
  }
  const laneBlock = laneBlockHeight(laneCount)
  const plotBottom = hasLanes ? AXIS_BAND + laneBlock + LANE_OFFSET : AXIS_BAND

  const xAxisScale = {
    // Aligned mode plots offsets from each series' own snapshot, not instants,
    // so the axis is a plain value scale there.
    type: (alignedAxis ? 'value' : 'time') as 'value' | 'time',
    ...(windowStart != null ? { min: windowStart } : {}),
    ...(windowEnd != null ? { max: windowEnd } : {}),
    minInterval: 60 * 60 * 1000,
    ...(alignedAxis ? {} : { maxInterval: 60 * 60 * 1000 }),
  }

  const xAxisLabels = {
    ...(alignedAxis
      ? {
          name: t('as_of.chart.aligned_axis_name'),
          nameLocation: 'middle' as const,
          nameGap: 46,
        }
      : {}),
    axisLabel: {
      hideOverlap: true,
      rotate: alignedAxis ? 0 : 35,
      interval: 'auto' as const,
      margin: 16,
      formatter: (value: number) => {
        if (alignedAxis) {
          // Offsets run −7d → 0; label whole days only, 0 being the snapshot.
          const hours = Math.round(value / (60 * 60 * 1000))
          if (hours % 24 !== 0) return ''
          const days = hours / 24
          return days === 0 ? '0' : `${days}d`
        }
        const d = dayjs.utc(value)
        if (d.hour() % 6 !== 0) return ''
        return d.format('DD/MM HH:mm')
      },
    },
  }

  const axisLine = { lineStyle: { color: primaryColor } }

  const laneSeries: echarts.SeriesOption[] = hasLanes
    ? [
        buildQualityLaneSeries(qualityLanes, (lane) =>
          lane.id === primarySeries?.id
            ? primaryColor
            : lane.id === secondarySeries?.id
              ? secondaryColor
              : '#94a3b8'
        ),
        buildLaneSnapSeries(
          qualityLanes.flatMap((lane) =>
            Array.from(rowsByPlottedX.get(lane.id)?.keys() ?? [])
          ),
          laneCount
        ),
      ]
    : []

  return {
    animation: false,
    // One crosshair across both grids, so hovering the plot also points at the
    // strip below it and the two read as one chart rather than two.
    ...(hasLanes
      ? { axisPointer: { link: [{ xAxisIndex: 'all' }] } }
      : {}),
    grid: hasLanes
      ? [
          { left: 50, right: 50, top: 30, bottom: plotBottom },
          { left: 50, right: 50, height: laneBlock, bottom: AXIS_BAND },
        ]
      : {
          left: 50,
          right: 50,
          top: 30,
          bottom: AXIS_BAND,
        },
    tooltip: {
      trigger: 'axis',
      borderColor: primaryColor,
      formatter: (params: unknown) => {
        const rows = (Array.isArray(params) ? params : [params]) as Array<{
          axisValueLabel?: string
          seriesName?: string | number
          marker?: unknown
          data?: unknown
          value?: unknown
        }>
        const axisLabel = rows[0]?.axisValueLabel ?? ''
        const lines = rows
          // The quality strip is a series to ECharts but not to the reader; it
          // is described by the line it sits under, not listed beside it.
          .filter((row) => !isLaneSeries(row?.seriesName))
          .map((row) => {
            const entry = seriesEntries.find(
              (item) => item.id === String(row?.seriesName ?? '')
            )
            const displayName = entry?.name ?? String(row?.seriesName ?? '')
            const value = Array.isArray(row?.data) ? row.data[1] : row?.value
            // Only worth a line when this window actually carries quality —
            // otherwise every tooltip in a stock deployment would end in a
            // "not checked" that never changes.
            let qualityLine = ''
            if (hasLanes && entry) {
              const plotted = Array.isArray(row?.data) ? Number(row.data[0]) : NaN
              const found = rowsByPlottedX.get(entry.id)?.get(plotted)
              if (found) {
                const swatch =
                  `<span style="display:inline-block;width:8px;height:8px;` +
                  `border-radius:2px;background:${QUALITY_COLORS[found.qualityClass]};` +
                  `margin-right:5px"></span>`
                const code =
                  found.quality !== null
                    ? ` <span style="opacity:0.6">${found.quality}</span>`
                    : ''
                qualityLine =
                  `<br/><span style="opacity:0.85">${swatch}` +
                  `${escapeHtml(qualityLabel(found.qualityClass, entry.qualityScheme, t))}${code}</span>`
              }
            }
            // On the aligned axis the shared header is an offset ("−3d"), which
            // is the same for both series but corresponds to a DIFFERENT real
            // instant in each snapshot's window — so each line carries its own.
            if (alignedAxis && entry?.anchorTs != null) {
              const offset = Array.isArray(row?.data) ? Number(row.data[0]) : NaN
              const realTs = Number.isFinite(offset)
                ? entry.anchorTs + offset
                : null
              const stamp = realTs
                ? ` <span style="opacity:0.65">(${dayjs
                    .utc(realTs)
                    .format('MMM D, HH:mm')})</span>`
                : ''
              return `${String(row?.marker ?? '')}${displayName}: ${value ?? ''}${stamp}${qualityLine}`
            }
            return `${String(row?.marker ?? '')}${displayName}: ${value ?? ''}${qualityLine}`
          })
          .join('<br/>')

        return `<div>${axisLabel}</div><div>${lines}</div>`
      },
      extraCssText: 'max-width:340px;white-space:normal;',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: primaryColor,
          width: 1,
        },
      },
    },
    toolbox: {
      bottom: 'bottom',
      feature: {
        dataView: {
          title: 'DataView',
          readOnly: true,
          lang: ['\u200B', t('general.close'), ''],
          backgroundColor: '#ffffff',
          textareaColor: '#ffffff',
          textareaBorderColor: tableBorderColor,
          textColor: primaryColor,
          buttonColor: primaryColor,
          buttonTextColor: '#ffffff',
          iconStyle: {
            borderColor: primaryColor,
          },
          emphasis: {
            iconStyle: {
              borderColor: primaryColor,
            },
          },
          optionToContent: () => {
            const groupedRows = new Map<
              string,
              Array<{ date: string; value: string }>
            >()
            for (const row of seriesDataRows) {
              const group = groupedRows.get(row.stream) ?? []
              group.push({ date: row.date, value: row.value })
              groupedRows.set(row.stream, group)
            }

            const datastreamNames = Array.from(groupedRows.keys())
            const wrapper = document.createElement('div')
            wrapper.style.display = 'flex'
            wrapper.style.flexDirection = 'column'
            wrapper.style.gap = '10px'

            const tabs = document.createElement('div')
            tabs.style.display = 'flex'
            tabs.style.flexWrap = 'wrap'
            tabs.style.gap = '6px'

            const tableContainer = document.createElement('div')

            const renderTable = (stream: string) => {
              const rows = (groupedRows.get(stream) ?? [])
                .map((row, index) => {
                  const rowBg = index % 2 === 0 ? 'transparent' : tableRowAltBg
                  return `<tr>
                    <td style="padding:6px 10px;border:1px solid ${tableBorderColor};background:${rowBg};">${row.date}</td>
                    <td style="padding:6px 10px;border:1px solid ${tableBorderColor};background:${rowBg};">${row.value}</td>
                  </tr>`
                })
                .join('')

              tableContainer.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;color:${primaryColor};">
                <thead>
                  <tr>
                    <th style="padding:6px 10px;border:1px solid ${tableBorderColor};text-align:left;background:${tableHeaderBg};">Date</th>
                    <th style="padding:6px 10px;border:1px solid ${tableBorderColor};text-align:left;background:${tableHeaderBg};">Value</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>`
            }

            let activeStream = datastreamNames[0] ?? ''
            for (const stream of datastreamNames) {
              const btn = document.createElement('button')
              btn.type = 'button'
              btn.textContent = stream
              btn.style.padding = '4px 10px'
              btn.style.border = `1px solid ${tableBorderColor}`
              btn.style.borderRadius = '9999px'
              btn.style.fontSize = '12px'
              btn.style.cursor = 'pointer'
              btn.style.background = stream === activeStream ? tableHeaderBg : '#fff'
              btn.style.color = primaryColor
              btn.onclick = () => {
                activeStream = stream
                for (const child of Array.from(tabs.children)) {
                  const element = child as HTMLButtonElement
                  element.style.background =
                    element.textContent === activeStream ? tableHeaderBg : '#fff'
                }
                renderTable(activeStream)
              }
              tabs.appendChild(btn)
            }

            if (activeStream) renderTable(activeStream)
            wrapper.appendChild(tabs)
            wrapper.appendChild(tableContainer)
            return wrapper
          },
        },
        dataZoom: {
          // Same pair of axes as the inside zoom, so a box drawn over the plot
          // carries the quality strip along instead of leaving it behind.
          xAxisIndex: hasLanes ? [0, 1] : 0,
          // Was 'none': the box could only ever narrow the time range, so a
          // single outlier flattening the series had no remedy. Naming the
          // axes explicitly matters — left unset this defaults to 'all', which
          // would sweep in the strip's own 0..laneCount scale and crush it.
          yAxisIndex: showSecondaryAxis ? [0, 1] : 0,
          // An axis is filtered by whichever dataZoom claims it first, and that
          // model's filterMode is the one that applies. Matching the inside
          // zoom's keeps the behaviour the same however the two get ordered.
          filterMode: 'weakFilter',
          iconStyle: {
            borderColor: primaryColor,
          },
          emphasis: {
            iconStyle: {
              borderColor: primaryColor,
            },
          },
        },
        myDownloadCsv: {
          show: true,
          title: t('chart.download_xlsx'),
          icon: 'path://M512 64c26.5 0 48 21.5 48 48v432h120c19.4 0 29 23.4 15.3 37.1l-184 184c-8.8 8.8-23 8.8-31.8 0l-184-184C281 567.4 290.6 544 310 544h120V112c0-26.5 21.5-48 48-48h34zM176 848h672c17.7 0 32 14.3 32 32s-14.3 32-32 32H176c-17.7 0-32-14.3-32-32s14.3-32 32-32z',
          iconStyle: {
            borderColor: primaryColor,
          },
          emphasis: {
            iconStyle: {
              borderColor: primaryColor,
            },
          },
          onclick: async () => {
            if (!onDownloadAllDatastreams) return
            const payload = await onDownloadAllDatastreams()
            if (!payload?.bytes) return
            const blob = new Blob([payload.bytes], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = payload.filename || 'datastreams.xlsx'
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
          },
        },
      },
    },
    legend: {
      top: 0,
      // Named explicitly so the quality strip — a series like any other as far
      // as ECharts is concerned — cannot auto-collect into the legend and offer
      // itself as a datastream to toggle.
      data: seriesEntries.map((entry) => entry.id),
      formatter: (id: string) =>
        seriesEntries.find((entry) => entry.id === id)?.name ?? id,
      selected: Object.fromEntries(
        seriesEntries.map((entry) => [
          entry.id,
          activeDatastreamIds.length
            ? activeDatastreamIds.includes(entry.id)
            : entry.id === primarySeries?.id,
        ])
      ),
    },
    xAxis: hasLanes
      ? [
          // Plot axis: same scale, labels suppressed — the lane grid below
          // carries them so they sit under everything rather than over the strips.
          {
            ...xAxisScale,
            gridIndex: 0,
            axisLine,
            axisLabel: { show: false },
            axisTick: { show: false },
          },
          { ...xAxisScale, ...xAxisLabels, gridIndex: 1, axisLine },
        ]
      : { ...xAxisScale, ...xAxisLabels, axisLine },
    yAxis: [
      {
        type: 'value',
        name: yLabel,
        nameLocation: 'middle',
        nameGap: 42,
        scale: true,
        position: 'left',
        gridIndex: 0,
        axisLine: {
          lineStyle: {
            color: primaryColor,
          },
        },
        splitLine: {
          lineStyle: {
            color: withAlpha(primaryColor, 0.2),
          },
        },
      },
      {
        type: 'value',
        name: secondaryYLabel,
        nameLocation: 'middle',
        nameGap: 48,
        scale: true,
        position: 'right',
        gridIndex: 0,
        show: showSecondaryAxis,
        axisLine: {
          lineStyle: {
            color: secondaryColor,
          },
        },
        splitLine: {
          show: false,
        },
      },
      // The strips' own scale: one unit per lane, lane 0 at the top. Invisible —
      // it exists to give renderItem a coordinate system, not to be read.
      ...(hasLanes
        ? [
            {
              type: 'value' as const,
              gridIndex: 1,
              min: 0,
              max: laneCount,
              show: false,
              axisLine: { show: false },
              axisTick: { show: false },
              axisLabel: { show: false },
              splitLine: { show: false },
            },
          ]
        : []),
    ],
    dataZoom: [
      {
        type: 'inside',
        // Both grids zoom together, or the strip would drift out of step with
        // the plot it describes.
        xAxisIndex: hasLanes ? [0, 1] : 0,
        // Zooming x drops the readings outside the window, so the y axis —
        // `scale: true` — recomputes its extent from what is actually on
        // screen and the line fills the plot. Under 'none' the axis kept
        // spanning the whole series, and zooming into a quiet stretch left a
        // flat thread across an otherwise empty chart.
        //
        // 'weakFilter' rather than 'filter' for the quality strip: its items
        // carry TWO x dimensions (a run's start and end), and weakFilter keeps
        // an item whose dimensions straddle the window on both sides. A run of
        // uniform quality longer than the zoomed window therefore survives,
        // where 'filter' would drop it and blank the strip exactly when the
        // viewer zoomed in on it.
        filterMode: 'weakFilter',
      },
    ],
    series: [
      ...seriesEntries.map((entry) => {
      const isPrimary = entry.id === primarySeries?.id
      const isSecondary = entry.id === secondarySeries?.id
      const color = isPrimary ? primaryColor : isSecondary ? secondaryColor : '#94a3b8'
      return {
        // `id` is what lets the component merge a new markLine onto the primary
        // series without rebuilding the option — ECharts matches series by index
        // otherwise, which is not stable across legend changes.
        id: entry.id,
        name: entry.id,
        type: 'line' as const,
        data: entry.rows.map((row) => [
          alignedAxis && entry.anchorTs != null ? row.ts - entry.anchorTs : row.ts,
          row.value,
        ]),
        showSymbol: false,
        sampling: 'lttb' as const,
        smooth: false,
        // B above A. Where the two agree exactly, A's solid stroke would hide a
        // lower B completely and the chart would claim there is only one series
        // — indistinguishable from a comparison that failed to load. Riding B's
        // dashes on top instead makes a perfect overlap legible AS an overlap.
        z: isCompare && isSecondary ? 4 : 3,
        lineStyle: {
          color,
          width: isCompare && isSecondary ? COMPARE_B_WIDTH : 2,
          ...(isCompare && isSecondary ? { opacity: COMPARE_B_OPACITY } : {}),
          // Compare mode: the two snapshots often agree exactly, and two solid
          // lines at identical coordinates are indistinguishable from one. The
          // dash lets the overlap itself be read off the chart.
          ...(isCompare && isSecondary ? { type: 'dashed' as const } : {}),
        },
        itemStyle: {
          color,
        },
        // Always the plot grid — with lanes present, grid 1 belongs to the strips.
        xAxisIndex: 0,
        // Compare mode keeps both snapshots on the shared left axis.
        yAxisIndex: isSecondary && !isCompare ? 1 : 0,
        // Amber dashed vertical lines at the snapshot dates, plus the teal line
        // marking the reading the details rail is describing — drawn once on the
        // primary series (avoids N overlapping lines/labels).
        markLine: isPrimary
          ? buildMarkLine(snapshotMarkers, selectedX, primaryColor)
          : undefined,
        // Wash over the spans where the two snapshots disagree. Drawn once, on
        // the primary series, and behind both lines so it never obscures them.
        markArea:
          changeRegions.length > 0 && isPrimary
            ? {
                silent: true,
                itemStyle: {
                  color: withAlpha(CHANGE_BAND_COLOR, 0.12),
                  borderColor: withAlpha(CHANGE_BAND_COLOR, 0.35),
                  borderWidth: 1,
                },
                data: changeRegions.map(
                  (region) =>
                    [{ xAxis: region.start }, { xAxis: region.end }] as [
                      { xAxis: number },
                      { xAxis: number },
                    ]
                ),
              }
            : undefined,
      }
      }),
      ...laneSeries,
    ],
  }
}

