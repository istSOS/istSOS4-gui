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
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as echarts from 'echarts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Datastream, Observation, Thing } from '@/types/domain'
import {
  buildMarkLine,
  buildObservationGraphOption,
  resolveSeriesColors,
  syncLaneGridToPlotGrid,
  type QualityLane,
  type SnapshotMarker,
} from '../lib/observationGraphOptions'
import {
  ISTSOS_QUALITY_SCHEME,
  buildQualitySegments,
  sameQualityScheme,
  tallyQuality,
} from '../lib/resultQuality'
import { useQualitySchemeResolver } from '../lib/useQualitySchemes'
import QualityLegend, { type QualityLegendLane } from './QualityLegend'
import ReadingDetailsRail, {
  type ReadingDetails,
  type ReadingDetailsEntry,
} from './ReadingDetailsRail'

dayjs.extend(utc)

/** "−3d 4h" — the aligned axis' own units, for the rail header. */
function formatOffset(offsetMs: number) {
  const sign = offsetMs < 0 ? '−' : '+'
  const total = Math.abs(offsetMs)
  const days = Math.floor(total / 86400000)
  const hours = Math.floor((total % 86400000) / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    !days && !hours ? `${minutes}m` : '',
  ].filter(Boolean)
  return `${sign}${parts.join(' ')}`
}
import {
  buildRows,
  buildSeriesEntries,
  plottedX,
  resolvePrimaryAndSecondarySeries,
  type ChangeRegion,
  type GraphSeriesEntry,
  type SeriesSource,
} from '../lib/observationGraphUtils'

type ObservationGraphProps = {
  thing?: Thing | null
  datastream?: Datastream | null
  observations?: Observation[]
  comparisonDatastream?: Datastream | null
  comparisonObservations?: Observation[]
  allSeries?: SeriesSource[]
  activeDatastreamIds?: string[]
  onActiveDatastreamsChange?: (datastreamIds: string[]) => void
  loading?: boolean
  error?: string | null
  onDownloadAllDatastreams?: () => Promise<{
    filename: string
    bytes: ArrayBuffer
  } | null>
  height?: number | string
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
  /** Opens the quality rules editor from the legend. No button when absent. */
  onCustomizeQuality?: () => void
}

export default function ObservationGraph({
  thing = null,
  datastream = null,
  observations = [],
  comparisonDatastream = null,
  comparisonObservations = [],
  allSeries = [],
  activeDatastreamIds = [],
  onActiveDatastreamsChange,
  loading = false,
  error = null,
  onDownloadAllDatastreams,
  className = '',
  height = '100%',
  snapshotMarkers = [],
  windowStart = null,
  windowEnd = null,
  alignedAxis = false,
  isCompare = false,
  changeRegions = [],
  asOfDate = null,
  onCustomizeQuality,
}: ObservationGraphProps) {
  const { t } = useTranslation()
  // Each datastream's quality is read under the viewer's rules for it, and the
  // resolver changes identity when those are saved — so every memo below that
  // lists it re-classifies the rows on screen.
  const resolveScheme = useQualitySchemeResolver()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
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

  /** The reading the rail is describing, or null when it is closed. */
  const [selected, setSelected] = useState<{
    x: number
    details: ReadingDetails
  } | null>(null)

  // Read once per render rather than inside the chart effect: the rail needs it
  // too, for dots that match the series they describe.
  const primaryColor = useMemo(() => {
    if (typeof window === 'undefined') return '#008374'
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#008374'
    )
  }, [])

  const chartData = useMemo(() => {
    return buildRows(observations, resolveScheme(datastream).scheme)
  }, [observations, datastream, resolveScheme])

  const comparisonChartData = useMemo(() => {
    return buildRows(
      comparisonObservations,
      resolveScheme(comparisonDatastream).scheme
    )
  }, [comparisonObservations, comparisonDatastream, resolveScheme])

  const seriesEntries = useMemo(() => {
    return buildSeriesEntries({
      allSeries,
      datastream,
      comparisonDatastream,
      chartData,
      comparisonChartData,
      schemeFor: (ds) => resolveScheme(ds).scheme,
    })
  }, [
    allSeries,
    datastream,
    comparisonDatastream,
    chartData,
    comparisonChartData,
    resolveScheme,
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
   * A strip is drawn even when none of its readings carries a quality value:
   * it is then one grey "not checked" run, and the legend says so in words, for
   * the snapshot it was read at. Hiding it instead left a reader unable to tell
   * "no quality recorded" from "this chart has no quality feature".
   */
  const { qualityLanes, qualityLegendLanes, qualityCustomized } = useMemo(() => {
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
    let customized = false

    for (const { entry, tag, label, asOf } of sources) {
      if (!entry || entry.rows.length === 0) continue
      if (!sameQualityScheme(entry.qualityScheme, ISTSOS_QUALITY_SCHEME)) {
        customized = true
      }
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
      legend.push({ tag, label, tally, asOf, scheme: entry.qualityScheme })
    }

    return {
      qualityLanes: lanes,
      qualityLegendLanes: legend,
      qualityCustomized: customized,
    }
  }, [seriesEntries, activeDatastreamIds, isCompare, alignedAxis, asOfDate, t])

  /**
   * Open the rail on the reading nearest `axisValue`.
   *
   * Snapping rather than requiring a hit on the line itself: the series are
   * drawn with `showSymbol: false` over thousands of points, so an exact hit is
   * not a gesture anyone can perform. Anywhere at that x is what the
   * axis-triggered tooltip already responds to, so it is what people aim at.
   */
  const openRailAt = useCallback(
    (axisValue: number) => {
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

      const colors = resolveSeriesColors(
        seriesEntries,
        activeDatastreamIds,
        primaryColor,
        isCompare
      )

      const entries: ReadingDetailsEntry[] = []
      for (const entry of visible) {
        if (entry.rows.length === 0) continue

        let nearest = entry.rows[0]
        let nearestDist = Infinity
        for (const row of entry.rows) {
          const dist = Math.abs(
            plottedX(entry, row.ts, alignedAxis) - anchorX
          )
          if (dist < nearestDist) {
            nearestDist = dist
            nearest = row
          }
        }

        // A snapshot whose window does not reach this instant has no reading
        // here, and its nearest row could be days away. Listing it would claim
        // a value that snapshot never held, so it is left out entirely — the
        // rail then shows one block instead of two, which is the truth.
        const spacing =
          entry.rows.length > 1
            ? Math.abs(entry.rows[1].ts - entry.rows[0].ts)
            : Number.POSITIVE_INFINITY
        if (nearestDist > spacing) continue

        entries.push({
          seriesId: entry.id,
          seriesName: entry.name,
          color: colors.get(entry.id) ?? primaryColor,
          value: nearest.value,
          unit: entry.unit,
          ts: nearest.ts,
          commit: nearest.commit,
          qualityClass: nearest.qualityClass,
          quality: nearest.quality,
          qualityScheme: entry.qualityScheme,
          qualityRule: nearest.qualityRule,
          qualityCustom: !sameQualityScheme(
            entry.qualityScheme,
            ISTSOS_QUALITY_SCHEME
          ),
        })
      }
      if (entries.length === 0) return

      // On the aligned axis the shared position is an offset, and each series'
      // own instant differs — so the header names the position and every block
      // carries its own real timestamp.
      const axisLabel = alignedAxis
        ? formatOffset(anchorX)
        : dayjs.utc(anchorX).format('YYYY-MM-DD HH:mm:ss')

      setSelected({ x: anchorX, details: { axisLabel, entries } })
    },
    [
      seriesEntries,
      activeDatastreamIds,
      alignedAxis,
      isCompare,
      primaryColor,
    ]
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
    resizeObserverRef.current = ro

    return () => {
      ro.disconnect()
      resizeObserverRef.current = null
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

    // The data underneath just changed, so a selection would point at a reading
    // that may no longer exist. Drop it rather than let it survive onto other
    // data — and keep the rail's marker line off the rebuilt option.
    setSelected(null)

    const option = buildObservationGraphOption({
      seriesEntries,
      activeDatastreamIds,
      primaryColor,
      t: (key: string) => t(key),
      onDownloadAllDatastreams,
      snapshotMarkers,
      windowStart,
      windowEnd,
      alignedAxis,
      isCompare,
      changeRegions,
      selectedX: null,
      qualityLanes,
    })

    chart.clear()
    chart.setOption(option, { notMerge: true })
    // The plot grid widens itself to fit the y-axis labels; the lane grid, having
    // no axis, does not. Re-pin the lane to wherever the plot actually landed so
    // a strip starts under the reading it describes.
    syncLaneGridToPlotGrid(chart)
    chartHasSeriesRef.current = true

    const zr = chart.getZr()
    zr.off('click')
    zr.on('click', (event: { offsetX?: number; offsetY?: number }) => {
      const point = [event.offsetX ?? 0, event.offsetY ?? 0]
      // A click outside the plotting area dismisses — the gesture people
      // already expect for closing a panel. The quality strips count as inside:
      // the crosshair and tooltip reach down through them, so a click there
      // opens the reading they name rather than closing it.
      if (!chart.containPixel({ gridIndex: [0, 1] }, point)) {
        setSelected(null)
        return
      }

      const converted = chart.convertFromPixel({ gridIndex: 0 }, point)
      const axisValue = Array.isArray(converted) ? Number(converted[0]) : NaN
      if (!Number.isFinite(axisValue)) return
      openRailAt(axisValue)
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKeyDown)
    const detachPinning = () => {
      document.removeEventListener('keydown', onKeyDown)
      zr.off('click')
    }

    chart.off('legendselectchanged')
    chart.on('legendselectchanged', (params: unknown) => {
      const event = params as {
        name?: string
        selected?: Record<string, boolean>
      }
      const selectedIds = Object.entries(event.selected ?? {})
        .filter(([, enabled]) => !!enabled)
        .map(([id]) => id)
      if (selectedIds.length === 0) {
        chart.dispatchAction({ type: 'legendSelect', name: event.name })
        return
      }
      if (selectedIds.length > 2) {
        const clickedId = String(event.name ?? '')
        const { primarySeries } = resolvePrimaryAndSecondarySeries(
          seriesEntries,
          activeDatastreamIds
        )
        const primaryId =
          primarySeries?.id ??
          activeDatastreamIds[0] ??
          selectedIds.find((id) => id !== clickedId) ??
          clickedId
        const nextSelectedIds =
          primaryId === clickedId
            ? [
                clickedId,
                selectedIds.find((id) => id !== clickedId) || clickedId,
              ]
            : [primaryId, clickedId]

        for (const entry of seriesEntries) {
          const shouldBeSelected = nextSelectedIds.includes(entry.id)
          chart.dispatchAction({
            type: shouldBeSelected ? 'legendSelect' : 'legendUnSelect',
            name: entry.id,
          })
        }
        onActiveDatastreamsChange?.(nextSelectedIds)
        return
      }
      onActiveDatastreamsChange?.(selectedIds)
    })
    chart.resize()

    // Only the paths that actually reached the click wiring return this; the
    // early "no data"/"loading" exits above register nothing to detach.
    return detachPinning
  }, [
    datastream,
    chartData,
    comparisonDatastream,
    comparisonChartData,
    seriesEntries,
    activeDatastreamIds,
    onActiveDatastreamsChange,
    loading,
    error,
    onDownloadAllDatastreams,
    snapshotMarkers,
    windowStart,
    windowEnd,
    alignedAxis,
    isCompare,
    changeRegions,
    qualityLanes,
    primaryColor,
    openRailAt,
    t,
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
          markLine: buildMarkLine(
            snapshotMarkers,
            selected?.x ?? null,
            primaryColor
          ),
        },
      ],
    })
  }, [
    selected,
    seriesEntries,
    activeDatastreamIds,
    snapshotMarkers,
    primaryColor,
  ])

  // The chart shares the row with the rail, so opening it narrows the plot and
  // the ResizeObserver set up on mount reflows ECharts to match.
  return (
    <div
      className={`flex ${className}`}
      style={{ height, width: '100%' }}
    >
      {/* The chart and the lane's legend are one unit: the legend names the
          colours drawn inside the chart, so it stays with it when the rail
          opens and narrows the column. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={containerRef} className="min-h-0 flex-1" />
        {qualityLegendLanes.length > 0 && (
          <QualityLegend
            lanes={qualityLegendLanes}
            onCustomize={onCustomizeQuality}
            customized={qualityCustomized}
          />
        )}
      </div>
      {selected && (
        <ReadingDetailsRail
          details={selected.details}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
