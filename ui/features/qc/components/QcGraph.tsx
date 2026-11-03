'use client'

import * as echarts from 'echarts'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { SELECTION_COLOR, brushToolStyle } from '../../../lib/chartSelection'
import { hoverTooltipTool, resetZoomTool } from '../../../lib/chartToolbar'
import { plotTooltipPreference } from '../../../lib/plotTooltipPreference'
import { selectBrushRows } from '../../observations/lib/plotSelection'
import {
  VERDICT_COLORS,
  type Verdict,
  checkStatus,
  dataStatus,
  fitsMask,
  humanStatus,
  isMissing,
  maskVerdict,
  numericValue,
  parseMask,
  rawText,
  slotState,
} from '../lib/bitmask'
import { changed, rowValue } from '../lib/model'
import { qualityFlagDescription } from '../lib/qualityFlags'
import { selectionZoom } from '../lib/selectionZoom'
import {
  chartTimeLabel,
  formatObservationTime,
  formatUtcOffset,
} from '../lib/timezone'
import type { Constraint, Drafts, QcRow } from '../lib/types'

const verdicts = Object.keys(VERDICT_COLORS) as Verdict[]
// Changing selection must not move the curves between progressive canvas
// layers. The editor bounds the data to 20,000 observations.
const markerRendering = { progressive: 0, progressiveThreshold: Infinity }
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!
  )

const GRID_LEFT = 80
const GRID_RIGHT = 35
const CONNECTOR_SPACING_PX = 4
type Connector = [number, number | null, number | null]

// At most one change connector per few pixels: the rest are skipped evenly,
// so dense edits never merge into a solid block when zoomed out. The stride
// runs over all edits, so panning keeps the same lines.
function drawConnectors(
  chart: echarts.EChartsType,
  connectors: Connector[],
  drawn: { current: string }
) {
  const width = chart.getWidth() - GRID_LEFT - GRID_RIGHT
  const [from, to] = [GRID_LEFT, GRID_LEFT + width].map(
    (x) => chart.convertFromPixel({ xAxisIndex: 0 }, x) as number
  )
  const visible = connectors.filter(([ts]) => ts >= from && ts <= to).length
  const stride = Math.max(
    1,
    Math.ceil(visible / (width / CONNECTOR_SPACING_PX))
  )
  const data = connectors
    .filter(([ts], index) => index % stride === 0 && ts >= from && ts <= to)
    .flatMap(([ts, original, draft]) => [
      [ts, original],
      [ts, draft],
      [ts, null],
    ])
  // Zooming to a selection must not resubmit an unchanged series.
  const signature = JSON.stringify(data)
  if (signature === drawn.current) return
  drawn.current = signature
  chart.setOption({ series: [{ id: 'qc-change-connectors', data }] })
}

export default function QcGraph({
  rows,
  drafts,
  checkCount,
  constraints,
  serviceMode = false,
  selected,
  onSelect,
  encoded,
  originalEncoded,
  utcOffset,
  preview,
  unit,
  editing = false,
}: {
  rows: QcRow[]
  drafts: Drafts
  checkCount: number
  constraints?: Constraint[]
  serviceMode?: boolean
  selected: string[]
  onSelect: (keys: string[]) => void
  encoded: boolean
  originalEncoded: boolean
  utcOffset: number
  preview?: Record<string, number | null>
  unit?: string
  /** Correction step: tooltips open on click only, never on hover. */
  editing?: boolean
}) {
  const { t } = useTranslation()
  const node = useRef<HTMLDivElement>(null)
  const hoverTooltips = useSyncExternalStore(
    plotTooltipPreference.subscribe,
    plotTooltipPreference.getSnapshot,
    plotTooltipPreference.getServerSnapshot
  )
  const hoverTooltipsRef = useRef(hoverTooltips)
  useEffect(() => {
    hoverTooltipsRef.current = hoverTooltips
  }, [hoverTooltips])
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const zoomRef = useRef<{ series: string; selection: string } | null>(null)
  const onSelectRef = useRef(onSelect)
  const rowRef = useRef(rows)
  const brushSelectionRef = useRef<string[] | null>(null)
  const connectorsRef = useRef<Connector[]>([])
  const drawnConnectorsRef = useRef('')
  function resetZoom() {
    // No target index: reset every zoom controller, including the ones added
    // internally by the box-zoom tool. Keep the selected observations intact.
    chartRef.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
  }
  useEffect(() => {
    onSelectRef.current = onSelect
    rowRef.current = rows
  }, [onSelect, rows])

  useEffect(() => {
    if (!node.current) return
    const chart = echarts.init(node.current)
    chartRef.current = chart
    zoomRef.current = null
    const resize = new ResizeObserver(() => {
      chart.resize()
      drawConnectors(chart, connectorsRef.current, drawnConnectorsRef)
    })
    resize.observe(node.current)
    chart.on('datazoom', () =>
      drawConnectors(chart, connectorsRef.current, drawnConnectorsRef)
    )
    chart.on('click', (params) => {
      const data = params.data as unknown as [number, number, string]
      if (Array.isArray(data) && typeof data[2] === 'string')
        onSelectRef.current([data[2]])
    })
    chart.on('brush', (event: unknown) => {
      // The toolbox clear action emits `brush`, not `brushEnd`. Ignore the
      // programmatic brush resets used to update point/table selections.
      if ((event as { command?: string }).command === 'clear') {
        chart.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'brush',
          brushOption: { brushType: false },
        })
        onSelectRef.current([])
      }
    })
    chart.on('brushEnd', (event: unknown) => {
      const keys = selectBrushRows(chart, event, rowRef.current)
      brushSelectionRef.current = keys
      onSelectRef.current(keys)
    })
    return () => {
      resize.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const point = (
      row: QcRow,
      draft: boolean
    ): [number, number | null, string] => {
      const raw = draft ? rowValue(row, drafts).result : row.result
      return [row.ts, isMissing(raw) ? null : numericValue(raw), row.key]
    }
    const editedRows = rows.filter(
      (row) => drafts[row.key] && changed(row, drafts[row.key])
    )
    const rowsByKey = new Map(rows.map((row) => [row.key, row]))
    const qualityDetails = (row: QcRow, useDraft: boolean) => {
      const draft = useDraft ? rowValue(row, drafts) : undefined
      const raw = draft ? draft.resultQuality : row.resultQuality
      const canDecode = useDraft ? encoded : originalEncoded
      const description = qualityFlagDescription(raw, t)
      const summary =
        raw == null
          ? t('qc.explain.no_quality')
          : serviceMode || description
            ? description || t('qc.workflow.unknown_code')
            : t(
                `qc.verdict.${canDecode ? maskVerdict(raw, checkCount, draft?.staleSlots) : 'unknown'}`
              )
      const mask =
        !serviceMode && canDecode && fitsMask(raw, checkCount)
          ? parseMask(raw)
          : null
      const unknown = t('qc.verdict.unknown')
      return {
        summary: `${summary} (${rawText(raw)})`,
        pending: !!draft?.qualityPending,
        dataState:
          mask === null ? unknown : t(`qc.data_state.${dataStatus(mask)}`),
        checks: Array.from({ length: checkCount }, (_, index) =>
          draft?.staleSlots.includes(index + 1)
            ? t('qc.needs_check')
            : mask === null
              ? unknown
              : t(`qc.${checkStatus(slotState(mask, index + 1))}`)
        ),
        humanReview:
          mask === null
            ? unknown
            : t(`qc.${humanStatus(slotState(mask, checkCount + 1))}`),
      }
    }
    connectorsRef.current = editedRows.map((row) => [
      row.ts,
      point(row, false)[1],
      point(row, true)[1],
    ])
    const gaps = rows
      .slice(1)
      .map((row, i) => row.ts - rows[i].ts)
      .filter((gap) => gap > 0)
      .sort((a, b) => a - b)
    const half = (gaps[Math.floor(gaps.length / 2)] ?? 60000) / 2
    // Both grids need the same full extent before percentages can represent
    // the same time window. Quality runs extend half a sample past each end.
    const timeExtent = {
      min: rows.length ? rows[0].ts - half : undefined,
      max: rows.length ? rows[rows.length - 1].ts + half : undefined,
    }
    const lanes: number[][] = []
    if (encoded)
      for (const lane of [0, 1]) {
        let open: number[] | null = null
        for (const row of rows) {
          const draft = rowValue(row, drafts)
          const verdict =
            !lane && !originalEncoded
              ? 'unknown'
              : maskVerdict(
                  lane ? draft.resultQuality : row.resultQuality,
                  checkCount,
                  lane ? draft.staleSlots : []
                )
          const category = verdicts.indexOf(verdict)
          if (open && open[3] === category && row.ts - half <= open[1] + half)
            open[1] = row.ts + half
          else {
            if (open) lanes.push(open)
            open = [row.ts - half, row.ts + half, lane, category]
          }
        }
        if (open) lanes.push(open)
      }
    const quality: echarts.CustomSeriesOption = {
      id: 'qc-quality',
      type: 'custom',
      zlevel: 0,
      name: 'Quality',
      xAxisIndex: 1,
      yAxisIndex: 1,
      silent: true,
      clip: true,
      data: lanes,
      encode: { x: [0, 1], y: 2 },
      renderItem: (params, api) => {
        const start = api.coord([api.value(0), api.value(2)])
        const end = api.coord([api.value(1), api.value(2)])
        const coord = params.coordSys as unknown as {
          x: number
          y: number
          width: number
          height: number
        }
        const shape = echarts.graphic.clipRectByRect(
          {
            x: start[0],
            y: start[1] - 5,
            width: Math.max(end[0] - start[0], 1),
            height: 10,
          },
          coord
        )
        return shape
          ? {
              type: 'rect',
              shape,
              style: { fill: VERDICT_COLORS[verdicts[Number(api.value(3))]] },
            }
          : null
      },
    }
    const proposed = rows.map(
      (row) => !!preview && Object.hasOwn(preview, row.key)
    )
    const proposedEdges = new Set(
      rows
        .filter((_, i) => proposed[i] && (!proposed[i - 1] || !proposed[i + 1]))
        .map((row) => row.key)
    )
    const option: echarts.EChartsOption = {
      animation: false,
      // Keep hover highlights on the same canvas as their current geometry,
      // including when a selection changes the zoomed time/value extents.
      hoverLayerThreshold: Infinity,
      useUTC: true,
      legend: {
        top: 2,
        data: [
          t('qc.original'),
          t('qc.draft'),
          t('qc.edited'),
          ...(preview && Object.keys(preview).length
            ? [t('qc.workflow.proposed')]
            : []),
        ],
      },
      grid: [
        {
          left: GRID_LEFT,
          right: GRID_RIGHT,
          top: 38,
          bottom: encoded ? 80 : 25,
        },
        { left: GRID_LEFT, right: GRID_RIGHT, height: 36, bottom: 27 },
      ],
      toolbox: {
        right: 12,
        top: 0,
        feature: {
          myResetZoom: resetZoomTool(t('qc.zoom_reset'), resetZoom),
          myHoverTooltips: {
            ...hoverTooltipTool(
              hoverTooltipsRef.current,
              t('observations.show_on_hover'),
              () =>
                plotTooltipPreference.set(!plotTooltipPreference.getSnapshot())
            ),
            show: !editing,
          },
          brush: {
            ...brushToolStyle(),
            type: ['lineX', 'clear'],
            title: {
              lineX: t('observations.select_range'),
              clear: t('qc.clear_selection'),
            },
          },
          dataZoom: {
            xAxisIndex: [0, 1],
            yAxisIndex: 'none',
            filterMode: 'weakFilter',
            title: { zoom: t('qc.zoom_region'), back: t('qc.zoom_previous') },
          },
        },
      },
      brush: {
        xAxisIndex: 0,
        brushMode: 'single',
        throttleType: 'debounce',
        throttleDelay: 120,
      },
      tooltip: {
        trigger: 'axis',
        triggerOn:
          !editing && hoverTooltipsRef.current ? 'mousemove|click' : 'click',
        renderMode: 'html',
        confine: true,
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]) as Array<{
            seriesName?: string
            value?: unknown
          }>
          const rowKey = items
            .map((item) =>
              Array.isArray(item.value) ? item.value[2] : undefined
            )
            .find((key) => typeof key === 'string' && rowsByKey.has(key))
          const row =
            typeof rowKey === 'string' ? rowsByKey.get(rowKey) : undefined
          if (!row) return ''
          const original = qualityDetails(row, false)
          const draft = qualityDetails(row, true)
          const value = (raw: unknown) => (isMissing(raw) ? '—' : rawText(raw))
          const tableRows: [string, string, string][] = [
            [
              `${t('qc.value')}${unit ? ` (${unit})` : ''}`,
              value(row.result),
              value(rowValue(row, drafts).result),
            ],
          ]
          if (!serviceMode && (encoded || originalEncoded)) {
            for (let index = 0; index < checkCount; index++) {
              const constraint = constraints?.[index]
              const name = constraint
                ? t(`qc.workflow.tests.${constraint.type}`, {
                    defaultValue: constraint.type,
                  })
                : `${t('qc.check')} ${index + 1}`
              tableRows.push([
                name,
                original.checks[index],
                draft.checks[index],
              ])
            }
            tableRows.push(
              [t('qc.data_state_label'), original.dataState, draft.dataState],
              [t('qc.human_review'), original.humanReview, draft.humanReview]
            )
          }
          tableRows.push([t('qc.quality'), original.summary, draft.summary])
          if (original.pending || draft.pending)
            tableRows.push([
              t('qc.workflow.flag_pending'),
              original.pending ? t('qc.explain.yes') : '—',
              draft.pending ? t('qc.explain.yes') : '—',
            ])
          if (preview && Object.hasOwn(preview, row.key))
            tableRows.push([
              t('qc.workflow.proposed'),
              '—',
              value(preview[row.key]),
            ])
          const cellStyle =
            'padding:4px 8px;text-align:left;vertical-align:top;white-space:normal;overflow-wrap:anywhere;max-width:200px'
          return `<table style="border-collapse:collapse;font-variant-numeric:tabular-nums">
            <caption style="text-align:left;padding:0 8px 8px;font-weight:600">${escapeHtml(formatObservationTime(row.time, utcOffset))}</caption>
            <thead><tr><th></th><th scope="col" style="${cellStyle}">${escapeHtml(t('qc.original'))}</th><th scope="col" style="${cellStyle}">${escapeHtml(t('qc.draft'))}</th></tr></thead>
            <tbody>${tableRows
              .map(
                ([label, originalValue, draftValue]) =>
                  `<tr><th scope="row" style="${cellStyle};font-weight:500">${escapeHtml(label)}</th><td style="${cellStyle}">${escapeHtml(originalValue)}</td><td style="${cellStyle}">${escapeHtml(draftValue)}</td></tr>`
              )
              .join('')}</tbody>
          </table>`
        },
      },
      xAxis: [
        {
          type: 'time',
          ...timeExtent,
          gridIndex: 0,
          axisLabel: {
            hideOverlap: true,
            formatter: (value: number) =>
              chartTimeLabel(
                value,
                utcOffset,
                (rows.at(-1)?.ts ?? 0) - (rows[0]?.ts ?? 0) > 172800000
              ),
          },
          axisPointer: {
            label: {
              formatter: (params: { value: unknown }) => {
                const numeric = Number(params.value)
                const timestamp = Number.isFinite(numeric)
                  ? numeric
                  : Date.parse(String(params.value))
                return Number.isFinite(timestamp)
                  ? formatObservationTime(
                      new Date(timestamp).toISOString(),
                      utcOffset
                    )
                  : ''
              },
            },
          },
        },
        { type: 'time', ...timeExtent, gridIndex: 1, show: false },
      ],
      yAxis: [
        { type: 'value', scale: true, name: unit },
        {
          type: 'category',
          gridIndex: 1,
          data: [t('qc.original'), t('qc.draft')],
          inverse: true,
          show: encoded,
          axisTick: { show: false },
          axisLine: { show: false },
        },
      ],
      dataZoom: [
        {
          id: 'qc-zoom-inside',
          type: 'inside',
          xAxisIndex: [0, 1],
          filterMode: 'weakFilter',
        },
      ],
      series: [
        {
          id: 'qc-original',
          name: t('qc.original'),
          type: 'line',
          data: rows.map((row) => point(row, false)),
          showSymbol: false,
          connectNulls: false,
          itemStyle: { color: '#94a3b8' },
          lineStyle: { width: 1 },
        },
        {
          id: 'qc-draft',
          name: t('qc.draft'),
          type: 'line',
          data: rows.map((row) => point(row, true)),
          showSymbol: rows.length < 500,
          symbolSize: 4,
          connectNulls: false,
          itemStyle: { color: '#2a78d6' },
          lineStyle: { width: 1.5 },
        },
        {
          id: 'qc-selection-targets',
          name: 'Selection',
          type: 'scatter',
          ...markerRendering,
          data: rows.map((row) => point(row, true)),
          symbolSize: 7,
          itemStyle: { opacity: 0 },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          id: 'qc-change-connectors',
          name: 'Changes',
          type: 'line',
          data: [],
          showSymbol: false,
          silent: true,
          lineStyle: { color: '#eb6834', type: 'dotted', width: 1 },
          tooltip: { show: false },
        },
        {
          id: 'qc-edited',
          name: t('qc.edited'),
          type: 'scatter',
          ...markerRendering,
          data: editedRows.map((row) => point(row, true)),
          symbolSize: 8,
          itemStyle: { color: '#eb6834' },
        },
        {
          id: 'qc-selected',
          name: 'Selected',
          type: 'scatter',
          ...markerRendering,
          data: [],
          symbolSize: 11,
          itemStyle: {
            color: SELECTION_COLOR,
            borderColor: '#ffffff',
            borderWidth: 1.5,
          },
        },
        {
          id: 'qc-proposed',
          name: t('qc.workflow.proposed'),
          type: 'line',
          data: rows.map((row) => [
            row.ts,
            preview && Object.hasOwn(preview, row.key)
              ? preview[row.key]
              : null,
            row.key,
          ]),
          showSymbol: true,
          // Round markers only where a previewed run starts or ends.
          symbol: (value: unknown[]) =>
            proposedEdges.has(value[2] as string) ? 'circle' : 'none',
          symbolSize: 9,
          connectNulls: false,
          silent: true,
          lineStyle: { type: [2, 2], width: 1.2, color: '#000' },
          itemStyle: { color: '#000', borderColor: '#fff', borderWidth: 2 },
        },
        quality,
      ],
    }
    // Selection changes update only markers in the effect below. Keep the
    // observation curves and zoom controllers intact while choosing rows.
    chart.setOption(option, { replaceMerge: ['series'] })
    drawnConnectorsRef.current = '[]'
    drawConnectors(chart, connectorsRef.current, drawnConnectorsRef)
  }, [
    rows,
    drafts,
    checkCount,
    constraints,
    serviceMode,
    encoded,
    originalEncoded,
    utcOffset,
    preview,
    unit,
    editing,
    t,
  ])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (!selected.length)
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: false },
      })
    const keys = new Set(selected)
    const selectedRows = rows.filter((row) => keys.has(row.key))
    const series = JSON.stringify(rows.map((row) => [row.key, row.ts]))
    const selection = JSON.stringify([...selected].sort())
    const focusSelection =
      zoomRef.current?.series !== series ||
      zoomRef.current?.selection !== selection
    // A completed drag owns its cover until another selection replaces it.
    // Table selections must not inherit that range or its brush visual effects.
    if (focusSelection && selected !== brushSelectionRef.current)
      chart.dispatchAction({ type: 'brush', areas: [] }, { silent: true })
    chart.setOption({
      series: [
        {
          id: 'qc-selected',
          data: selectedRows.map((row) => {
            const raw = rowValue(row, drafts).result
            return [row.ts, isMissing(raw) ? null : numericValue(raw), row.key]
          }),
        },
        {
          id: 'qc-draft',
          markLine: {
            symbol: 'none',
            label: { show: false },
            data:
              selectedRows.length === 1 ? [{ xAxis: selectedRows[0].ts }] : [],
            lineStyle: { color: SELECTION_COLOR },
          },
        },
      ],
    })
    if (focusSelection) {
      const range = selectionZoom(rows, selected)
      chart.dispatchAction({
        type: 'dataZoom',
        ...(range ?? { start: 0, end: 100 }),
      })
      zoomRef.current = { series, selection }
    }
  }, [
    rows,
    drafts,
    checkCount,
    selected,
    encoded,
    originalEncoded,
    utcOffset,
    preview,
    unit,
    t,
  ])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption({
      tooltip: {
        triggerOn: !editing && hoverTooltips ? 'mousemove|click' : 'click',
      },
      toolbox: {
        feature: {
          myHoverTooltips: {
            ...hoverTooltipTool(
              hoverTooltips,
              t('observations.show_on_hover'),
              () =>
                plotTooltipPreference.set(!plotTooltipPreference.getSnapshot())
            ),
            show: !editing,
          },
        },
      },
    })
    chart.dispatchAction({ type: 'hideTip' })
  }, [hoverTooltips, editing, t])

  return (
    <div className="flex h-full w-full flex-col">
      <div
        ref={node}
        data-utc-offset={formatUtcOffset(utcOffset)}
        className="min-h-[230px] w-full flex-1"
        aria-label={t('qc.graph_label')}
      />
    </div>
  )
}
