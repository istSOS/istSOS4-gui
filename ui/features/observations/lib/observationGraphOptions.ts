import * as echarts from 'echarts'

import {
  type ChangeRegion,
  type GraphRow,
  GraphSeriesEntry,
  resolvePrimaryAndSecondarySeries,
  withAlpha,
} from './observationGraphUtils'
import { type TooltipReading, compactTooltipHtml } from './observationTooltip'
import {
  QUALITY_CLASSES,
  QUALITY_COLORS,
  type QualityClass,
  type QualitySegment,
} from './resultQuality'
import {
  EMPTY_APPEARANCES,
  type SeriesAppearances,
  resolveAppearance,
} from './seriesAppearance'

import { SELECTION_COLOR, brushToolStyle } from '../../../lib/chartSelection'
import { hoverTooltipTool, resetZoomTool } from '../../../lib/chartToolbar'
import { formatObservationTime } from '../../qc/lib/timezone'

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
  segments: QualitySegment[]
}

/** Series id of the strip itself, so the legend and tooltip can exclude it. */
const QUALITY_SERIES_ID = '__quality_lane__'

/** Series id of the strip's invisible snap targets — see `buildLaneSnapSeries`. */
const QUALITY_SNAP_SERIES_ID = '__quality_lane_snap__'

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
 * chart — the band the date labels and the toolbox live in. The lane
 * block is inserted above it, and the plot gives up exactly that much height.
 */
const AXIS_BAND = 84

/**
 * Room under the toolbox for the icons' hover titles. Without it ECharts puts a
 * title above its icon, over the date labels. AXIS_BAND grows by the same
 * amount so the icons do not reach the dates.
 */
const TOOLBOX_BOTTOM = 20

const TOOLBOX_TITLE_BELOW_ICON = { textPosition: 'bottom' as const }

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
        getComponent?: (
          type: string,
          index: number
        ) => GridComponent | undefined
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
 * Keep series and quality-lane colours consistent across initial options and
 * appearance updates, for both snapshot and property comparisons.
 */
export function resolveSeriesColors(
  seriesEntries: GraphSeriesEntry[],
  activeDatastreamIds: string[],
  primaryColor: string,
  isCompare: boolean,
  styles: SeriesAppearances = EMPTY_APPEARANCES
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
      styles[entry.styleKey ?? entry.id]?.color ??
        (entry.id === primarySeries?.id
          ? primaryColor
          : entry.id === secondarySeries?.id
            ? secondaryColor
            : '#94a3b8')
    )
  }
  return colors
}

/** Appearance-only patches do not replace data or reset the current zoom. */
export function buildSeriesAppearancePatches(
  entries: GraphSeriesEntry[],
  activeIds: string[],
  primaryColor: string,
  isCompare: boolean,
  styles: SeriesAppearances
) {
  const colors = resolveSeriesColors(
    entries,
    activeIds,
    primaryColor,
    isCompare,
    styles
  )
  const { secondarySeries } = resolvePrimaryAndSecondarySeries(
    entries,
    activeIds
  )
  return entries.map((entry) => {
    const comparison = isCompare && entry.id === secondarySeries?.id
    const style = resolveAppearance(
      styles[entry.styleKey ?? entry.id],
      colors.get(entry.id) ?? primaryColor,
      comparison
    )
    return {
      id: entry.id,
      type: style.type,
      // Bar heights retain every recorded value; no line downsampling applies.
      sampling: style.type === 'bar' ? ('none' as const) : ('lttb' as const),
      barMaxWidth: 22,
      barMinWidth: 1,
      showSymbol: style.type === 'line' && style.points,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: {
        color: style.color,
        type: style.line === 'none' ? ('solid' as const) : style.line,
        width: comparison ? COMPARE_B_WIDTH : 2,
        opacity: style.line === 'none' ? 0 : comparison ? COMPARE_B_OPACITY : 1,
      },
      itemStyle: {
        color: style.color,
        opacity: comparison && style.type === 'bar' ? COMPARE_B_OPACITY : 1,
      },
    }
  })
}

/** Bar heights use a zero baseline, including when sharing an axis with a line. */
export function seriesAxisScales(
  entries: GraphSeriesEntry[],
  activeIds: string[],
  isCompare: boolean,
  styles: SeriesAppearances
) {
  const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
    entries,
    activeIds
  )
  const separate =
    !!secondarySeries &&
    !isCompare &&
    primarySeries?.unit !== secondarySeries.unit
  const bars = entries.filter(
    (entry) => styles[entry.styleKey ?? entry.id]?.type === 'bar'
  )
  return [
    !bars.some((entry) => !separate || entry.id !== secondarySeries?.id),
    !bars.some((entry) => separate && entry.id === secondarySeries?.id),
  ]
}

/**
 * The primary series' vertical lines: amber snapshot markers and a magenta
 * line at the selected reading.
 *
 * Exported because the selection line moves on every click, and rebuilding
 * the whole option to move it would discard the viewer's `dataZoom` state. The
 * component merges the result of this back onto the primary series by id
 * instead — so both paths must produce the same shape, which is why there is
 * one function rather than two similar literals.
 */
export function buildMarkLine(
  snapshotMarkers: SnapshotMarker[],
  selectedX: number | null
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
                color: SELECTION_COLOR,
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
 * `tagColor` colours each strip's label to match its observation series.
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
        const centreY = api.coord([
          api.value(0),
          laneCount - laneIndex - 0.5,
        ])[1]
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

/** Read the zoomed UTC span when labels render, without changing the chart view. */
export function visibleTimeSpan(chart: echarts.EChartsType | null): number {
  const extent = visibleTimeExtent(chart)
  return extent ? Math.abs(extent[1] - extent[0]) : Infinity
}

/** The x range currently on screen, after zoom, or null before a layout. */
export function visibleTimeExtent(
  chart: echarts.EChartsType | null
): [number, number] | null {
  const model = (
    chart as unknown as {
      getModel?: () => {
        getComponent: (
          type: string,
          index: number
        ) => { axis?: { scale?: { getExtent: () => number[] } } }
      }
    } | null
  )?.getModel?.()
  const extent = model?.getComponent('xAxis', 0)?.axis?.scale?.getExtent()
  return extent ? [extent[0], extent[1]] : null
}

/** Display-only patches preserve the UTC axis coordinates and current zoom. */
export function timeAxisDisplay(
  utcOffset: number,
  alignedAxis: boolean,
  getVisibleSpan: () => number = () => Infinity
) {
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  return {
    ...(alignedAxis
      ? { name: 'Δt', nameLocation: 'middle' as const, nameGap: 46 }
      : {}),
    axisPointer: {
      label: {
        formatter: (params: { value: unknown }) =>
          alignedAxis
            ? `${Math.round(Number(params.value) / 36000) / 100} h`
            : formatObservationTime(
                new Date(Number(params.value)).toISOString(),
                utcOffset
              ),
      },
    },
    axisLabel: {
      hideOverlap: true,
      rotate: 0,
      interval: 'auto' as const,
      margin: 12,
      formatter: (value: number) => {
        if (alignedAxis) return `${Math.round((value / 86400000) * 100) / 100}d`
        const date = new Date(value + utcOffset * 60000)
        const iso = date.toISOString()
        const span = getVisibleSpan()
        if (span >= 7 * 86400000) return dateLabel.format(date)
        if (span >= 86400000)
          return `${dateLabel.format(date)} ${iso.slice(11, 16)}`
        return iso.slice(11, span < 1000 ? 23 : span < 60000 ? 19 : 16)
      },
    },
  }
}

export function buildObservationGraphOption({
  seriesEntries,
  activeDatastreamIds,
  primaryColor,
  t,
  onDownloadAllDatastreams,
  onResetZoom,
  onZoomToSelection,
  renderTooltip,
  hoverTooltips = true,
  onToggleHoverTooltips,
  utcOffset = 0,
  getVisibleTimeSpan,
  snapshotMarkers = [],
  windowStart,
  windowEnd,
  alignedAxis = false,
  isCompare = false,
  changeRegions = [],
  selectedX = null,
  qualityLanes = [],
  seriesStyles = EMPTY_APPEARANCES,
}: {
  seriesEntries: GraphSeriesEntry[]
  activeDatastreamIds: string[]
  primaryColor: string
  t: (key: string) => string
  onResetZoom?: () => void
  onZoomToSelection?: () => void
  renderTooltip?: (readings: TooltipReading[]) => HTMLElement
  hoverTooltips?: boolean
  onToggleHoverTooltips?: () => void
  utcOffset?: number
  getVisibleTimeSpan?: () => number
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
   * x-coordinate of the selected reading, or null.
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
  seriesStyles?: SeriesAppearances
}): echarts.EChartsOption {
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
  const showSecondaryAxis =
    !!secondarySeries &&
    !isCompare &&
    primarySeries?.unit !== secondarySeries.unit
  // Live property comparison keeps amber; only snapshot-vs-snapshot goes red,
  // where amber would collide with this chart's own snapshot markLine.
  const seriesColors = resolveSeriesColors(
    seriesEntries,
    activeDatastreamIds,
    primaryColor,
    isCompare,
    seriesStyles
  )
  const secondaryColor = secondarySeries
    ? (seriesColors.get(secondarySeries.id) ?? SNAPSHOT_COLOR)
    : SNAPSHOT_COLOR
  const appearancePatches = buildSeriesAppearancePatches(
    seriesEntries,
    activeDatastreamIds,
    primaryColor,
    isCompare,
    seriesStyles
  )

  const axisScales = seriesAxisScales(
    seriesEntries,
    activeDatastreamIds,
    isCompare,
    seriesStyles
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
        alignedAxis && entry.anchorTs != null
          ? row.ts - entry.anchorTs
          : row.ts,
        row
      )
    }
    rowsByPlottedX.set(entry.id, byX)
  }
  const laneBlock = laneBlockHeight(laneCount)
  const plotBottom = hasLanes ? AXIS_BAND + laneBlock + LANE_OFFSET : AXIS_BAND

  const xAxisScale = {
    // Keep epoch milliseconds on a numeric scale and format dates explicitly.
    // ECharts' time scale adds bar overflow padding independently of the quality
    // grid, shifting dates and zoom extents when a line becomes a bar.
    type: 'value' as const,
    scale: true,
    ...(windowStart != null ? { min: windowStart } : {}),
    ...(windowEnd != null ? { max: windowEnd } : {}),
    splitNumber: 7,
    minInterval: 1,
    splitLine: { show: false },
    minorSplitLine: { show: false },
  }

  const xAxisLabels = timeAxisDisplay(
    utcOffset,
    alignedAxis,
    getVisibleTimeSpan
  )

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
    hoverLayerThreshold: Infinity,
    useUTC: true,
    // One crosshair across both grids, so inspecting the plot also points at the
    // strip below it and the two read as one chart rather than two.
    ...(hasLanes ? { axisPointer: { link: [{ xAxisIndex: 'all' }] } } : {}),
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
      triggerOn: hoverTooltips ? 'mousemove|click' : 'click',
      borderColor: primaryColor,
      formatter: (params: unknown) => {
        const items = (Array.isArray(params) ? params : [params]) as Array<{
          seriesName?: string
          data?: unknown
          value?: unknown
        }>
        const readings: TooltipReading[] = []
        for (const item of items) {
          const entry = seriesEntries.find(
            (entry) => entry.id === String(item.seriesName ?? '')
          )
          const data = Array.isArray(item.data)
            ? item.data
            : Array.isArray(item.value)
              ? item.value
              : null
          const row =
            entry && data
              ? rowsByPlottedX.get(entry.id)?.get(Number(data[0]))
              : null
          if (!entry || !row) continue
          readings.push({
            entry,
            row,
            tag: isCompare
              ? t(
                  entry.id === primarySeries?.id
                    ? 'as_of.chart.marker_primary'
                    : 'as_of.chart.marker_compare'
                )
              : undefined,
          })
        }
        return renderTooltip
          ? renderTooltip(readings)
          : compactTooltipHtml(readings, utcOffset, t)
      },
      confine: true,
      enterable: true,
      hideDelay: 400,
      transitionDuration: 0,
      extraCssText:
        'max-width:min(440px,calc(100vw - 24px));max-height:70vh;overflow-y:auto;white-space:normal;padding:8px 10px;',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: primaryColor,
          width: 1,
        },
      },
    },
    toolbox: {
      bottom: TOOLBOX_BOTTOM,
      // Hover titles below the icons. Features inherit it from the toolbox;
      // the toolbox-level type just omits the text fields.
      emphasis: {
        iconStyle: { borderColor: primaryColor, ...TOOLBOX_TITLE_BELOW_ICON },
      },
      feature: {
        brush: {
          ...brushToolStyle(primaryColor),
          type: ['lineX', 'clear'],
          title: {
            lineX: t('observations.select_range'),
            clear: t('qc.clear_selection'),
          },
        },
        myResetZoom: resetZoomTool(
          t('observations.reset_zoom'),
          () => onResetZoom?.(),
          primaryColor
        ),
        myHoverTooltips: hoverTooltipTool(
          hoverTooltips,
          t('observations.show_on_hover'),
          () => onToggleHoverTooltips?.(),
          primaryColor
        ),
        myZoomToSelection: {
          show: true,
          title: t('observations.zoom_selection'),
          icon: 'path://M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6M8 12h8M12 8v8',
          iconStyle: { borderColor: primaryColor, opacity: 0.35 },
          onclick: () => onZoomToSelection?.(),
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
      show: false,
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
            axisPointer: xAxisLabels.axisPointer,
            axisTick: { show: false },
          },
          { ...xAxisScale, ...xAxisLabels, gridIndex: 1, axisLine },
        ]
      : { ...xAxisScale, ...xAxisLabels, axisLine },
    yAxis: [
      {
        type: 'value',
        name:
          secondarySeries && !showSecondaryAxis ? primarySeries?.unit : yLabel,
        nameLocation: 'middle',
        nameGap: 42,
        scale: axisScales[0],
        position: 'left',
        gridIndex: 0,
        axisLine: {
          lineStyle: {
            color: primarySeries
              ? seriesColors.get(primarySeries.id)
              : primaryColor,
          },
        },
        splitLine: {
          lineStyle: {
            color: withAlpha(primaryColor, 0.12),
          },
        },
      },
      {
        type: 'value',
        name: secondaryYLabel,
        nameLocation: 'middle',
        nameGap: 48,
        scale: axisScales[1],
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
    brush: {
      xAxisIndex: 0,
      brushMode: 'single',
      throttleType: 'debounce',
      throttleDelay: 120,
    },
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
        return {
          // `id` is what lets the component merge a new markLine onto the primary
          // series without rebuilding the option — ECharts matches series by index
          // otherwise, which is not stable across legend changes.
          id: entry.id,
          name: entry.id,
          data: entry.rows.map((row) => [
            alignedAxis && entry.anchorTs != null
              ? row.ts - entry.anchorTs
              : row.ts,
            row.value,
          ]),
          connectNulls: false,
          smooth: false,
          // B above A. Where the two agree exactly, A's solid stroke would hide a
          // lower B completely and the chart would claim there is only one series
          // — indistinguishable from a comparison that failed to load. Riding B's
          // dashes on top instead makes a perfect overlap legible AS an overlap.
          z: isCompare && isSecondary ? 4 : 3,
          ...appearancePatches.find((patch) => patch.id === entry.id),
          // Always the plot grid — with lanes present, grid 1 belongs to the strips.
          xAxisIndex: 0,
          // Compare mode keeps both snapshots on the shared left axis.
          yAxisIndex: isSecondary && showSecondaryAxis ? 1 : 0,
          // Amber dashed vertical lines at the snapshot dates, plus the magenta line
          // marking the selected reading — drawn once on the
          // primary series (avoids N overlapping lines/labels).
          markLine: isPrimary
            ? buildMarkLine(snapshotMarkers, selectedX)
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
      ...seriesEntries.map((entry) => ({
        id: `__selected__${entry.id}`,
        name: `__selected__${entry.id}`,
        type: 'scatter' as const,
        xAxisIndex: 0,
        yAxisIndex:
          entry.id === secondarySeries?.id && showSecondaryAxis ? 1 : 0,
        data: [],
        symbolSize: 11,
        z: 8,
        progressive: 0,
        progressiveThreshold: Infinity,
        itemStyle: {
          color: SELECTION_COLOR,
          borderColor: '#ffffff',
          borderWidth: 1.5,
        },
        tooltip: { show: false },
        silent: true,
      })),
      ...laneSeries,
    ],
  }
}
