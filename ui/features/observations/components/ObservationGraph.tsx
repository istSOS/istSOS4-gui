'use client'

// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { Datastream, Observation } from '@/types/domain'
import * as echarts from 'echarts'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import CompactObservationTooltip from './CompactObservationTooltip'
import ObservationDataTable, {
  type ObservationDataRow,
} from './ObservationDataTable'
import { PAGE_SIZE } from './ObservationTable'
import QualityLegend, { type QualityLegendLane } from './QualityLegend'

import { SELECTION_COLOR } from '../../../lib/chartSelection'
import { hoverTooltipTool } from '../../../lib/chartToolbar'
import { plotTooltipPreference } from '../../../lib/plotTooltipPreference'
import { failedChecks, needsAttention } from '../../qc/lib/checks'
import { selectionZoom } from '../../qc/lib/selectionZoom'
import {
  type QualityLane,
  type SnapshotMarker,
  buildMarkLine,
  buildObservationGraphOption,
  buildQualityLaneSeries,
  buildSeriesAppearancePatches,
  resolveSeriesColors,
  seriesAxisScales,
  syncLaneGridToPlotGrid,
  timeAxisDisplay,
  visibleTimeExtent,
  visibleTimeSpan,
} from '../lib/observationGraphOptions'
import {
  type ChangeRegion,
  type GraphSeriesEntry,
  type SeriesSource,
  buildRows,
  buildSeriesEntries,
  plottedX,
  resolvePrimaryAndSecondarySeries,
} from '../lib/observationGraphUtils'
import type { TooltipReading } from '../lib/observationTooltip'
import { selectBrushRows } from '../lib/plotSelection'
import {
  buildQualitySegments,
  qualityConstraintsOf,
  qualityModeOf,
  tallyQuality,
} from '../lib/resultQuality'
import {
  EMPTY_APPEARANCES,
  type SeriesAppearances,
} from '../lib/seriesAppearance'
import { calendarTicks, initialTimeRange } from '../lib/timeAxisTicks'

const EMPTY_OBSERVATIONS: Observation[] = []
const EMPTY_SERIES: SeriesSource[] = []
const EMPTY_IDS: string[] = []
const EMPTY_MARKERS: SnapshotMarker[] = []
const EMPTY_REGIONS: ChangeRegion[] = []

type ObservationGraphProps = {
  utcOffset?: number
  datastream?: Datastream | null
  observations?: Observation[]
  comparisonDatastream?: Datastream | null
  comparisonObservations?: Observation[]
  allSeries?: SeriesSource[]
  activeDatastreamIds?: string[]
  seriesStyles?: SeriesAppearances
  loading?: boolean
  error?: string | null
  onDownloadAllDatastreams?: () => Promise<{
    filename: string
    bytes: ArrayBuffer
  } | null>
  height?: number | string
  /** The readings' own range when the axis fits them (up to 7 days), else null. */
  onDataRangeChange?: (range: { start: number; end: number } | null) => void
  className?: string
  /** Amber dashed vertical lines — the snapshot(s) this chart is about. */
  snapshotMarkers?: SnapshotMarker[]
  /** Window bounds in the x-axis' own space (offset ms when `alignedAxis`,
   *  epoch ms otherwise). Pins the axis so sparse/empty data still renders the
   *  full queried window. */
  windowStart?: number | null
  windowEnd?: number | null
  /** As-Of compare mode, default state — plot offsets from each series' own
   *  snapshot so two different 7-day windows overlay. */
  alignedAxis?: boolean
  /** As-Of compare mode — one datastream at two snapshots: shared y-axis,
   *  dashed second series. */
  isCompare?: boolean
  /** Spans (epoch ms) where the two snapshots disagree — shaded on the chart so
   *  the eye lands on the change instead of scanning the whole series. Empty
   *  unless comparing over a shared window. */
  changeRegions?: ChangeRegion[]
  /** ISO-8601 snapshot a single As-Of chart was read at; null for live data.
   *  Compare mode reads each series' own snapshot instead. */
  asOfDate?: string | null
}

export default function ObservationGraph({
  utcOffset = 0,
  datastream = null,
  observations = EMPTY_OBSERVATIONS,
  comparisonDatastream = null,
  comparisonObservations = EMPTY_OBSERVATIONS,
  allSeries = EMPTY_SERIES,
  activeDatastreamIds = EMPTY_IDS,
  seriesStyles = EMPTY_APPEARANCES,
  loading = false,
  error = null,
  onDownloadAllDatastreams,
  className = '',
  height = '100%',
  onDataRangeChange,
  snapshotMarkers = EMPTY_MARKERS,
  windowStart = null,
  windowEnd = null,
  alignedAxis = false,
  isCompare = false,
  changeRegions = EMPTY_REGIONS,
  asOfDate = null,
}: ObservationGraphProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hoverTooltips = useSyncExternalStore(
    plotTooltipPreference.subscribe,
    plotTooltipPreference.getSnapshot,
    plotTooltipPreference.getServerSnapshot
  )
  const hoverTooltipsRef = useRef(hoverTooltips)
  useEffect(() => {
    hoverTooltipsRef.current = hoverTooltips
  }, [hoverTooltips])
  const tooltipPinnedRef = useRef(false)
  const utcOffsetRef = useRef(utcOffset)
  useEffect(() => {
    utcOffsetRef.current = utcOffset
  }, [utcOffset])
  const tooltipRoot = useMemo(
    () =>
      typeof window === 'undefined' ? null : document.createElement('div'),
    []
  )
  const [tooltipReadings, setTooltipReadings] = useState<TooltipReading[]>([])
  const renderTooltip = useCallback(
    (readings: TooltipReading[]) => {
      setTooltipReadings((previous) =>
        previous.length === readings.length &&
        previous.every(
          (reading, i) =>
            reading.entry === readings[i].entry &&
            reading.row === readings[i].row
        )
          ? previous
          : readings
      )
      return tooltipRoot!
    },
    [tooltipRoot]
  )
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const getVisibleTimeSpan = useCallback(
    () => visibleTimeSpan(chartRef.current),
    []
  )
  /**
   * Whether the chart currently holds the real series, rather than a "Loading"
   * / "No data" / "Select a datastream" message.
   *
   * The marker effect merges `{ id, markLine }` onto the primary series. When
   * the chart is showing a message it has NO series, and a merge by an id that
   * does not exist makes ECharts try to CREATE that series — from an object
   * with no `type`, which fails with "Unknown series undefined".
   */
  const chartHasSeriesRef = useRef(false)

  const [selectedX, setSelectedX] = useState<number | null>(null)

  const [selection, setSelection] = useState<{
    keys: string[]
    origin: 'graph' | 'table'
  }>({ keys: [], origin: 'graph' })
  const selectionRef = useRef(selection.keys)
  useEffect(() => {
    selectionRef.current = selection.keys
  }, [selection])
  const [showTable, setShowTable] = useState(true)
  const [page, setPage] = useState(0)
  const [tableFilter, setTableFilter] = useState<'all' | 'A' | 'B'>('all')
  const [qualityFilter, setQualityFilter] = useState<
    'all' | 'pending' | 'failed'
  >('all')
  const stylesRef = useRef(seriesStyles)
  useEffect(() => {
    stylesRef.current = seriesStyles
  }, [seriesStyles])
  const draggingRef = useRef(false)
  const selectionToolRef = useRef(false)

  // Resolve the theme colour once for the chart and selection highlights.
  const primaryColor = useMemo(() => {
    if (typeof window === 'undefined') return '#008374'
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#008374'
    )
  }, [])

  const chartData = useMemo(() => {
    return buildRows(
      observations,
      qualityConstraintsOf(datastream),
      qualityModeOf(datastream)
    )
  }, [observations, datastream])

  const comparisonChartData = useMemo(() => {
    return buildRows(
      comparisonObservations,
      qualityConstraintsOf(comparisonDatastream),
      qualityModeOf(comparisonDatastream)
    )
  }, [comparisonObservations, comparisonDatastream])

  const seriesEntries = useMemo(() => {
    return buildSeriesEntries({
      allSeries,
      datastream,
      comparisonDatastream,
      chartData,
      comparisonChartData,
    })
  }, [
    allSeries,
    datastream,
    comparisonDatastream,
    chartData,
    comparisonChartData,
  ])

  /**
   * The strips to draw beneath the plot, and the rows the legend counts.
   *
   * Compare mode plots one datastream at two snapshots and already labels them
   * A and B on the markLine, so both get a strip under those same names.
   * Everywhere else each plotted series gets its own strip, lettered A, B, C…
   * in plotting order, and the legend row spells out which property each
   * letter stands for. A lone series stays unlettered, as there is nothing to
   * tell it apart from.
   *
   * Bitmask series use the Edit/QC palette. Service catalog codes stay in the
   * table and tooltips; they are categories without severity colours.
   */
  const { qualityLanes, qualityLegendLanes } = useMemo(() => {
    const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
      seriesEntries,
      activeDatastreamIds
    )
    // In compare mode each series carries its own snapshot; otherwise every
    // strip describes the chart's snapshot, or live data when there is none.
    let sources: {
      entry: GraphSeriesEntry | null | undefined
      tag?: string
      label?: string
      asOf: string | null
    }[]
    if (isCompare) {
      sources = [
        {
          entry: primarySeries,
          tag: t('as_of.chart.marker_primary'),
          asOf: primarySeries?.asOf ?? null,
        },
        {
          entry: secondarySeries,
          tag: t('as_of.chart.marker_compare'),
          asOf: secondarySeries?.asOf ?? null,
        },
      ]
    } else {
      const plotted = seriesEntries.filter((entry) =>
        activeDatastreamIds.includes(entry.id)
      )
      const shown = plotted.length ? plotted : [primarySeries]
      const lettered = shown.length > 1
      sources = shown.map((entry, index) => ({
        entry,
        tag: lettered ? String.fromCharCode(65 + index) : undefined,
        label: lettered
          ? entry?.observedProperty || entry?.name || undefined
          : undefined,
        asOf: asOfDate,
      }))
    }

    const lanes: QualityLane[] = []
    const legend: QualityLegendLane[] = []

    for (const { entry, tag, label, asOf } of sources) {
      if (!entry || entry.rows.length === 0 || entry.qualityMode !== 'bitmask')
        continue
      const tally = tallyQuality(entry.rows)
      lanes.push({
        id: entry.id,
        tag,
        segments: buildQualitySegments(
          entry.rows.map((row) => ({
            x: plottedX(entry, row.ts, alignedAxis),
            qualityClass: row.qualityClass,
          }))
        ),
      })
      // Legend only names the snapshot(s); on live data the strips speak for themselves.
      if (isCompare || asOf) legend.push({ tag, label, tally, asOf })
    }

    return {
      qualityLanes: lanes,
      qualityLegendLanes: legend,
    }
  }, [seriesEntries, activeDatastreamIds, isCompare, alignedAxis, asOfDate, t])

  const tableRows = useMemo<ObservationDataRow[]>(() => {
    const { primarySeries } = resolvePrimaryAndSecondarySeries(
      seriesEntries,
      activeDatastreamIds
    )
    const entries = seriesEntries.filter((entry) =>
      activeDatastreamIds.includes(entry.id)
    )
    return (entries.length ? entries : primarySeries ? [primarySeries] : [])
      .flatMap((entry) =>
        entry.rows.map((row) => ({
          key: JSON.stringify([entry.id, row.key]),
          time: row.time,
          x: plottedX(entry, row.ts, alignedAxis),
          row,
          entry,
        }))
      )
      .sort((a, b) => a.x - b.x || a.entry.id.localeCompare(b.entry.id))
  }, [seriesEntries, activeDatastreamIds, alignedAxis])

  // Same "Needs attention" / "Failed" rules as the QC editor, on stored quality.
  const qualityRows = useMemo(() => {
    const pending: ObservationDataRow[] = []
    const failed: ObservationDataRow[] = []
    for (const item of tableRows) {
      const { row, entry } = item
      const count = entry.qualityConstraints?.length ?? 0
      const encoded = entry.qualityMode === 'bitmask' && count > 0 && count <= 4
      const draft = {
        result: row.rawValue,
        resultQuality: row.rawQuality,
        staleSlots: [],
      }
      if (needsAttention(draft, count, encoded)) pending.push(item)
      if (failedChecks(draft, count, encoded, entry.qualityMode === 'service'))
        failed.push(item)
    }
    return { all: tableRows, pending, failed }
  }, [tableRows])

  const pinTooltip = useCallback((open: boolean) => {
    tooltipPinnedRef.current = open
    const chart = chartRef.current
    if (!chart || !chartHasSeriesRef.current) return
    chart.setOption({
      tooltip: {
        alwaysShowContent: open,
        triggerOn: open
          ? 'none'
          : hoverTooltipsRef.current
            ? 'mousemove|click'
            : 'click',
      },
    })
    if (!open) chart.dispatchAction({ type: 'hideTip' })
  }, [])
  // The aligned (Δt) axis is relative time, so the window does not apply there.
  const timeRange = useMemo(
    () =>
      alignedAxis
        ? {
            axisStart: windowStart,
            axisEnd: windowEnd,
            zoom: null,
            fromData: false,
          }
        : initialTimeRange(
            tableRows.map((item) => item.x),
            windowStart,
            windowEnd
          ),
    [alignedAxis, tableRows, windowStart, windowEnd]
  )
  useEffect(() => {
    onDataRangeChange?.(
      timeRange.fromData &&
        timeRange.axisStart != null &&
        timeRange.axisEnd != null
        ? { start: timeRange.axisStart, end: timeRange.axisEnd }
        : null
    )
  }, [timeRange, onDataRangeChange])
  const laneCount = qualityLanes.length
  // Recomputed on every zoom: the tick step follows the visible span.
  const applyCalendarTicks = useCallback(
    (utcOffsetMinutes: number) => {
      const chart = chartRef.current
      if (!chart || chart.isDisposed() || !chartHasSeriesRef.current) return
      if (alignedAxis) return
      const extent = visibleTimeExtent(chart)
      if (!extent) return
      const ticks = calendarTicks(extent[0], extent[1], utcOffsetMinutes)
      const custom = {
        axisTick: { customValues: ticks },
        axisLabel: { customValues: ticks },
      }
      chart.setOption({ xAxis: laneCount ? [custom, custom] : [custom] })
    },
    [alignedAxis, laneCount]
  )
  const resetZoom = useCallback(() => {
    chartRef.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
  }, [])
  const zoomToSelection = useCallback(() => {
    if (!selectionRef.current.length) return
    const range = selectionZoom(
      tableRows.map((item) => ({ key: item.key, ts: item.x })),
      selectionRef.current
    )
    if (range) chartRef.current?.dispatchAction({ type: 'dataZoom', ...range })
    else resetZoom()
  }, [tableRows, resetZoom])

  // Reset selection with its data during render, before chart effects synchronize.
  const [selectionRows, setSelectionRows] = useState(tableRows)
  if (selectionRows !== tableRows) {
    setSelectionRows(tableRows)
    setSelection({ keys: [], origin: 'graph' })
    setSelectedX(null)
    setPage(0)
    setTableFilter('all')
    setQualityFilter('all')
  }

  const focusRows = useCallback(
    (keys: string[], origin: 'graph' | 'table') => {
      setSelection({ keys, origin })
      if (origin === 'graph' && keys.length) {
        setTableFilter('all')
        setQualityFilter('all')
        const index = tableRows.findIndex((row) => row.key === keys[0])
        if (index >= 0) setPage(Math.floor(index / PAGE_SIZE))
      }
    },
    [tableRows]
  )

  /** Select the nearest readings without changing the plot layout. */
  const selectReadingsAt = useCallback(
    (
      axisValue: number,
      keys?: string[],
      origin: 'graph' | 'table' = 'graph'
    ) => {
      const visible = activeDatastreamIds.length
        ? seriesEntries.filter((entry) =>
            activeDatastreamIds.includes(entry.id)
          )
        : seriesEntries
      if (visible.length === 0) return

      // The x the click resolves to, taken from whichever visible series has a
      // reading closest to it.
      let anchorX: number | null = null
      let anchorDist = Infinity
      for (const entry of visible) {
        for (const row of entry.rows) {
          const x = plottedX(entry, row.ts, alignedAxis)
          const dist = Math.abs(x - axisValue)
          if (dist < anchorDist) {
            anchorDist = dist
            anchorX = x
          }
        }
      }
      if (anchorX === null) return

      const matchedKeys: string[] = []
      for (const entry of visible) {
        if (entry.rows.length === 0) continue

        let nearest = entry.rows[0]
        let nearestDist = Infinity
        for (const row of entry.rows) {
          const dist = Math.abs(plottedX(entry, row.ts, alignedAxis) - anchorX)
          if (dist < nearestDist) {
            nearestDist = dist
            nearest = row
          }
        }

        // A snapshot whose window does not reach this instant has no reading
        // here, and its nearest row could be days away. Selecting it would claim
        // a value that snapshot never held, so it is left out entirely — the
        // selection includes only snapshots that have a reading here.
        const spacing =
          entry.rows.length > 1
            ? Math.abs(entry.rows[1].ts - entry.rows[0].ts)
            : Number.POSITIVE_INFINITY
        if (nearestDist > spacing) continue

        matchedKeys.push(JSON.stringify([entry.id, nearest.key]))
      }
      if (!matchedKeys.length) return
      setSelectedX(anchorX)
      focusRows(keys ?? matchedKeys, origin)
    },
    [seriesEntries, activeDatastreamIds, alignedAxis, focusRows]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el)
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      chart.resize()
      // A narrower chart can tick the y-axis differently, changing how much room
      // its labels need and so where the plot grid starts. Re-pin the lane to it.
      syncLaneGridToPlotGrid(chart)
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const showMessage = (text: string) => {
      // No series on the chart now, so the marker effect must not try to merge
      // onto one — see chartHasSeriesRef.
      chartHasSeriesRef.current = false
      chart.clear()
      chart.setOption(
        {
          title: {
            text,
            left: 'center',
            top: 'middle',
            textStyle: {
              fontSize: 14,
              fontWeight: 'normal',
            },
          },
        },
        { notMerge: true }
      )
    }

    if (!datastream) {
      showMessage(t('general.select_datastream'))
      return
    }

    if (loading) {
      showMessage(t('general.loading'))
      return
    }

    if (error) {
      showMessage(error)
      return
    }

    const hasAnyData = seriesEntries.some((entry) => entry.rows.length > 0)
    if (!hasAnyData) {
      showMessage(t('general.no_data'))
      return
    }

    const option = buildObservationGraphOption({
      seriesEntries,
      activeDatastreamIds,
      primaryColor,
      t: (key: string) => t(key),
      onDownloadAllDatastreams,
      onResetZoom: resetZoom,
      onZoomToSelection: zoomToSelection,
      snapshotMarkers,
      windowStart: timeRange.axisStart,
      windowEnd: timeRange.axisEnd,
      alignedAxis,
      isCompare,
      changeRegions,
      selectedX: null,
      qualityLanes,
      seriesStyles: stylesRef.current,
      utcOffset: utcOffsetRef.current,
      getVisibleTimeSpan,
      renderTooltip: tooltipRoot ? renderTooltip : undefined,
      hoverTooltips: hoverTooltipsRef.current,
      onToggleHoverTooltips: () =>
        plotTooltipPreference.set(!plotTooltipPreference.getSnapshot()),
    })

    chart.clear()
    chart.setOption(option, { notMerge: true })
    // The plot grid widens itself to fit the y-axis labels; the lane grid, having
    // no axis, does not. Re-pin the lane to wherever the plot actually landed so
    // a strip starts under the reading it describes.
    syncLaneGridToPlotGrid(chart)
    chartHasSeriesRef.current = true

    chart.off('datazoom')
    chart.on('datazoom', () => applyCalendarTicks(utcOffsetRef.current))
    if (timeRange.zoom)
      chart.dispatchAction({ type: 'dataZoom', ...timeRange.zoom })
    else applyCalendarTicks(utcOffsetRef.current)

    selectionToolRef.current = false
    chart.off('globalcursortaken')
    chart.on('globalcursortaken', (event: unknown) => {
      const cursor = event as {
        key?: string
        brushOption?: { brushType?: unknown }
        dataZoomSelectActive?: boolean
      }
      selectionToolRef.current =
        cursor.key === 'brush'
          ? !!cursor.brushOption?.brushType
          : !!cursor.dataZoomSelectActive
    })
    chart.off('brush')
    chart.off('brushEnd')
    chart.on('brush', (event: unknown) => {
      if ((event as { command?: string }).command === 'clear') {
        chart.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'brush',
          brushOption: { brushType: false },
        })
        focusRows([], 'graph')
        setSelectedX(null)
      }
    })
    chart.on('brushEnd', (event: unknown) => {
      draggingRef.current = true
      const rows = tableRows.map((item) => ({ key: item.key, ts: item.x }))
      focusRows(selectBrushRows(chart, event, rows), 'graph')
      setSelectedX(null)
      // Mouse-up emits a click too; it must not replace the brushed selection.
      queueMicrotask(() => {
        draggingRef.current = false
      })
    })
    const zr = chart.getZr()
    const onPlotClick = (event: { offsetX?: number; offsetY?: number }) => {
      if (draggingRef.current || selectionToolRef.current) return
      const point = [event.offsetX ?? 0, event.offsetY ?? 0]
      if (!chart.containPixel({ gridIndex: [0, 1] }, point)) return

      const converted = chart.convertFromPixel({ gridIndex: 0 }, point)
      const axisValue = Array.isArray(converted) ? Number(converted[0]) : NaN
      if (!Number.isFinite(axisValue)) return
      selectReadingsAt(axisValue)
    }
    zr.on('click', onPlotClick)

    const detachSelection = () => {
      zr.off('click', onPlotClick)
      if (!chart.isDisposed()) {
        chart.off('brush')
        chart.off('brushEnd')
        chart.off('globalcursortaken')
        chart.off('datazoom')
      }
    }

    chart.resize()

    // Only the paths that actually reached the click wiring return this; the
    // early "no data"/"loading" exits above register nothing to detach.
    return detachSelection
  }, [
    datastream,
    chartData,
    comparisonDatastream,
    comparisonChartData,
    seriesEntries,
    activeDatastreamIds,
    loading,
    error,
    onDownloadAllDatastreams,
    resetZoom,
    zoomToSelection,
    snapshotMarkers,
    timeRange,
    alignedAxis,
    isCompare,
    changeRegions,
    qualityLanes,
    primaryColor,
    selectReadingsAt,
    focusRows,
    tableRows,
    renderTooltip,
    getVisibleTimeSpan,
    tooltipRoot,
    applyCalendarTicks,
    t,
  ])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !chartHasSeriesRef.current) return
    chart.setOption({
      toolbox: {
        feature: {
          myHoverTooltips: hoverTooltipTool(
            hoverTooltips,
            t('observations.show_on_hover'),
            () =>
              plotTooltipPreference.set(!plotTooltipPreference.getSnapshot()),
            primaryColor
          ),
        },
      },
      tooltip: {
        triggerOn: tooltipPinnedRef.current
          ? 'none'
          : hoverTooltips
            ? 'mousemove|click'
            : 'click',
      },
    })
    if (!tooltipPinnedRef.current) chart.dispatchAction({ type: 'hideTip' })
  }, [hoverTooltips, primaryColor, t])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !chartHasSeriesRef.current) return
    const display = timeAxisDisplay(utcOffset, alignedAxis, getVisibleTimeSpan)
    chart.setOption({
      xAxis: qualityLanes.length
        ? [{ axisPointer: display.axisPointer }, display]
        : [display],
    })
    applyCalendarTicks(utcOffset)
  }, [
    utcOffset,
    alignedAxis,
    qualityLanes,
    seriesEntries,
    getVisibleTimeSpan,
    applyCalendarTicks,
  ])

  /**
   * Move the marker line to the selected reading.
   *
   * A merge onto the primary series by id, NOT a rebuilt option: this chart has
   * `dataZoom: 'inside'`, so rebuilding would throw away whatever the viewer had
   * zoomed to every time they clicked a point.
   */
  useEffect(() => {
    const chart = chartRef.current
    // Nothing to merge onto while the chart is showing a message: ECharts would
    // read the id as a new series to create, and fail on its missing `type`.
    if (!chart || !chartHasSeriesRef.current) return
    const { primarySeries } = resolvePrimaryAndSecondarySeries(
      seriesEntries,
      activeDatastreamIds
    )
    if (!primarySeries) return
    chart.setOption({
      series: [
        {
          id: primarySeries.id,
          markLine: buildMarkLine(snapshotMarkers, selectedX),
        },
      ],
    })
  }, [
    selectedX,
    seriesEntries,
    activeDatastreamIds,
    snapshotMarkers,
    primaryColor,
  ])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !chartHasSeriesRef.current) return
    if (!selection.keys.length)
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: false },
      })
    const keys = new Set(selection.keys)
    const targets = tableRows.filter((item) => keys.has(item.key))
    chart.setOption({
      series: seriesEntries.map((entry) => ({
        id: `__selected__${entry.id}`,
        data: targets
          .filter((item) => item.entry.id === entry.id)
          .map((item) => [item.x, item.row.value]),
        itemStyle: { color: SELECTION_COLOR },
      })),
    })
    chart.setOption({
      toolbox: {
        feature: {
          myZoomToSelection: {
            iconStyle: { opacity: selection.keys.length ? 1 : 0.35 },
          },
        },
      },
    })
    if (selection.origin === 'table')
      chart.dispatchAction({ type: 'brush', areas: [] }, { silent: true })
  }, [
    selection,
    tableRows,
    seriesEntries,
    activeDatastreamIds,
    primaryColor,
    isCompare,
    seriesStyles,
  ])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !chartHasSeriesRef.current) return
    const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
      seriesEntries,
      activeDatastreamIds
    )
    const colors = resolveSeriesColors(
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
    const currentSeries = chart.getOption().series as Array<{
      id?: string
      type?: string
    }>
    const appearances = buildSeriesAppearancePatches(
      seriesEntries,
      activeDatastreamIds,
      primaryColor,
      isCompare,
      seriesStyles
    )
    chart.setOption({
      series: [
        ...appearances.map((patch) => {
          if (
            currentSeries.find((entry) => entry.id === patch.id)?.type ===
            patch.type
          )
            return patch
          // A new series model needs its data when switching between lines and bars.
          const entry = seriesEntries.find((entry) => entry.id === patch.id)!
          return {
            ...patch,
            data: entry.rows.map((row) => [
              plottedX(entry, row.ts, alignedAxis),
              row.value,
            ]),
          }
        }),
        ...(qualityLanes.length
          ? [
              buildQualityLaneSeries(
                qualityLanes,
                (lane) => colors.get(lane.id) ?? primaryColor
              ),
            ]
          : []),
      ],
      yAxis: [
        {
          scale: axisScales[0],
          axisLine: {
            lineStyle: {
              color: primarySeries
                ? colors.get(primarySeries.id)
                : primaryColor,
            },
          },
        },
        {
          scale: axisScales[1],
          axisLine: {
            lineStyle: {
              color: secondarySeries
                ? colors.get(secondarySeries.id)
                : primaryColor,
            },
          },
        },
      ],
    })
    syncLaneGridToPlotGrid(chart)
  }, [
    seriesStyles,
    seriesEntries,
    activeDatastreamIds,
    primaryColor,
    isCompare,
    qualityLanes,
    alignedAxis,
  ])

  const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
    seriesEntries,
    activeDatastreamIds
  )
  const filteredRows = qualityRows[qualityFilter].filter(
    (row) =>
      !secondarySeries ||
      tableFilter === 'all' ||
      row.entry.id ===
        (tableFilter === 'A' ? primarySeries?.id : secondarySeries.id)
  )

  const selectFromTable = (keys: string[]) => {
    if (keys.length === 1) {
      const item = tableRows.find((row) => row.key === keys[0])
      if (item) selectReadingsAt(item.x, keys, 'table')
    } else {
      focusRows(keys, 'table')
      setSelectedX(null)
    }
  }
  const clearSelection = () => {
    focusRows([], 'table')
    setSelectedX(null)
    chartRef.current?.dispatchAction({
      type: 'brush',
      command: 'clear',
      areas: [],
    })
  }

  return (
    <div
      className={`flex min-h-0 flex-col gap-2 ${className}`}
      style={{ height, width: '100%' }}
    >
      {tooltipRoot &&
        tooltipReadings.length > 0 &&
        !loading &&
        !error &&
        createPortal(
          <CompactObservationTooltip
            readings={tooltipReadings}
            utcOffset={utcOffset}
            onExplainOpenChange={pinTooltip}
          />,
          tooltipRoot
        )}
      <div className="flex min-h-[260px] flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={containerRef} className="min-h-0 flex-1" />
          {!loading && !error && <QualityLegend lanes={qualityLegendLanes} />}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {(['all', 'pending', 'failed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={qualityFilter === value}
            onClick={() => {
              setQualityFilter(value)
              setPage(0)
              setShowTable(true)
              focusRows(
                qualityRows[value].map((row) => row.key),
                'table'
              )
              setSelectedX(null)
            }}
            className={`rounded-full border px-3 py-1 text-xs ${qualityFilter === value ? 'border-primary bg-primary-50 text-primary' : 'border-default-200 text-default-600'}`}
          >
            {t(`qc.workflow.filters.${value}`)} · {qualityRows[value].length}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          className="text-primary"
          aria-expanded={showTable}
          onClick={() => setShowTable(!showTable)}
        >
          {t(showTable ? 'qc.workflow.hide_table' : 'qc.workflow.show_table')}
        </button>
        {secondarySeries && (
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={t('observations.table_streams')}
          >
            {(['all', 'A', 'B'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={tableFilter === filter}
                className="rounded border border-default-200 px-2 py-1 text-xs aria-pressed:bg-primary aria-pressed:text-white"
                title={
                  filter === 'A'
                    ? primarySeries?.name
                    : filter === 'B'
                      ? secondarySeries.name
                      : undefined
                }
                onClick={() => {
                  setTableFilter(filter)
                  setPage(0)
                }}
              >
                {filter === 'all' ? t('observations.both') : filter}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <span>
            {selection.keys.length} {t('qc.selected')}
          </span>
          <button
            type="button"
            className="text-primary"
            onClick={clearSelection}
          >
            {t('qc.clear_selection')}
          </button>
        </div>
      </div>
      {showTable && (
        <div className="shrink-0">
          <ObservationDataTable
            utcOffset={utcOffset}
            rows={loading || error ? [] : filteredRows}
            selected={selection.keys}
            onSelect={selectFromTable}
            page={page}
            onPage={setPage}
            focusKey={selection.origin === 'graph' ? selection.keys[0] : null}
          />
        </div>
      )}
    </div>
  )
}
