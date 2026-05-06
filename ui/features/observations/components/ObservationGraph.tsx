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
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

dayjs.extend(utc)

type ObservationGraphProps = {
  thing?: any | null
  datastream?: any | null
  observations?: any[]
  comparisonDatastream?: any | null
  comparisonObservations?: any[]
  allSeries?: Array<{ datastream: any; observations: any[] }>
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
}

function toNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const n = Number(x)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function extractTimestamp(obs: any): number | null {
  const raw = obs?.phenomenonTime
  const d = dayjs.utc(raw)
  const ts = d.valueOf()
  return Number.isFinite(ts) ? ts : null
}

function withAlpha(color: string, alpha: number) {
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
}: ObservationGraphProps) {
  const { t } = useTranslation()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const chartData = useMemo(() => {
    const rows: Array<{ ts: number; value: number }> = []

    for (const obs of Array.isArray(observations) ? observations : []) {
      const ts = extractTimestamp(obs)
      const value = toNumber(obs?.result)

      if (ts === null || value === null) continue
      rows.push({ ts, value })
    }

    rows.sort((a, b) => a.ts - b.ts)

    return rows
  }, [observations])

  const comparisonChartData = useMemo(() => {
    const rows: Array<{ ts: number; value: number }> = []

    for (const obs of Array.isArray(comparisonObservations)
      ? comparisonObservations
      : []) {
      const ts = extractTimestamp(obs)
      const value = toNumber(obs?.result)

      if (ts === null || value === null) continue
      rows.push({ ts, value })
    }

    rows.sort((a, b) => a.ts - b.ts)
    return rows
  }, [comparisonObservations])

  const seriesEntries = useMemo(() => {
    if (Array.isArray(allSeries) && allSeries.length > 0) {
      return allSeries.map((entry) => {
        const ds = entry?.datastream
        const dsId = String(ds?.['@iot.id'] ?? ds?.id ?? '')
        const dsName = String(ds?.name ?? dsId)
        const dsUnit = String(ds?.unitOfMeasurement?.symbol ?? '')
        const dsObservedProperty = String(ds?.ObservedProperty?.name ?? '')

        const rows: Array<{ ts: number; value: number }> = []
        for (const obs of Array.isArray(entry?.observations)
          ? entry.observations
          : []) {
          const ts = extractTimestamp(obs)
          const value = toNumber(obs?.result)
          if (ts === null || value === null) continue
          rows.push({ ts, value })
        }
        rows.sort((a, b) => a.ts - b.ts)

        return {
          id: dsId,
          name: dsName,
          unit: dsUnit,
          observedProperty: dsObservedProperty,
          rows,
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
              unit: String(
                comparisonDatastream?.unitOfMeasurement?.symbol ?? ''
              ),
              observedProperty: String(
                comparisonDatastream?.ObservedProperty?.name ?? ''
              ),
              rows: comparisonChartData,
            },
          ]
        : []),
    ]
  }, [
    allSeries,
    datastream,
    comparisonDatastream,
    chartData,
    comparisonChartData,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = echarts.init(el)
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      chart.resize()
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
    const primaryColor =
      typeof window !== 'undefined'
        ? getComputedStyle(document.documentElement)
            .getPropertyValue('--color-primary')
            .trim() || '#008374'
        : '#008374'
    const tableBorderColor = withAlpha(primaryColor, 0.35)
    const tableHeaderBg = withAlpha(primaryColor, 0.12)
    const tableRowAltBg = withAlpha(primaryColor, 0.06)

    const showMessage = (text: string) => {
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

    const selectedSeries = seriesEntries.filter((entry) =>
      activeDatastreamIds.includes(entry.id)
    )
    const primarySeries =
      selectedSeries[0] ??
      seriesEntries.find((entry) => activeDatastreamIds.includes(entry.id)) ??
      seriesEntries[0]
    const secondarySeries = selectedSeries[1] ?? null
    const yLabel = primarySeries?.unit
      ? `${primarySeries.observedProperty} (${primarySeries.unit})`
      : (primarySeries?.observedProperty ?? '')
    const secondaryYLabel = secondarySeries
      ? secondarySeries.unit
        ? `${secondarySeries.observedProperty} (${secondarySeries.unit})`
        : secondarySeries.observedProperty
      : ''
    const secondaryColor = '#f59e0b'
    const seriesDataRows: Array<{
      date: string
      stream: string
      value: string
    }> = []
    for (const entry of seriesEntries) {
      for (const row of entry.rows) {
        seriesDataRows.push({
          date: dayjs.utc(row.ts).format('YYYY-MM-DD HH:mm'),
          stream: entry.name,
          value: entry.unit ? `${row.value} ${entry.unit}` : String(row.value),
        })
      }
    }
    seriesDataRows.sort(
      (a, b) => dayjs.utc(a.date).valueOf() - dayjs.utc(b.date).valueOf()
    )

    const option: echarts.EChartsOption = {
      animation: false,
      grid: {
        left: 50,
        right: 50,
        top: 30,
        bottom: 110,
      },

      tooltip: {
        trigger: 'axis',
        borderColor: primaryColor,
        formatter: (params: any) => {
          const rows = Array.isArray(params) ? params : [params]
          const axisLabel = rows[0]?.axisValueLabel ?? ''
          const lines = rows
            .map((row: any) => {
              const entry = seriesEntries.find(
                (item) => item.id === String(row?.seriesName ?? '')
              )
              const displayName = entry?.name ?? String(row?.seriesName ?? '')
              const value = Array.isArray(row?.data) ? row.data[1] : row?.value
              return `${row?.marker ?? ''}${displayName}: ${value ?? ''}`
            })
            .join('<br/>')
          return `${axisLabel}<br/>${lines}`
        },
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
                    const rowBg =
                      index % 2 === 0 ? 'transparent' : tableRowAltBg
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
                btn.style.background =
                  stream === activeStream ? tableHeaderBg : '#fff'
                btn.style.color = primaryColor
                btn.onclick = () => {
                  activeStream = stream
                  for (const child of Array.from(tabs.children)) {
                    const element = child as HTMLButtonElement
                    element.style.background =
                      element.textContent === activeStream
                        ? tableHeaderBg
                        : '#fff'
                  }
                  renderTable(activeStream)
                }
                tabs.appendChild(btn)
              }

              if (activeStream) {
                renderTable(activeStream)
              }

              wrapper.appendChild(tabs)
              wrapper.appendChild(tableContainer)
              return wrapper
            },
          },
          dataZoom: {
            xAxisIndex: 0,
            yAxisIndex: 'none',
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

      xAxis: {
        type: 'time',
        minInterval: 60 * 60 * 1000,
        maxInterval: 60 * 60 * 1000,
        axisLine: {
          lineStyle: {
            color: primaryColor,
          },
        },
        axisLabel: {
          hideOverlap: true,
          rotate: 35,
          interval: 'auto',
          margin: 16,
          formatter: (value: number) => {
            const d = dayjs.utc(value)
            if (d.hour() % 6 !== 0) return ''
            return d.format('DD/MM HH:mm')
          },
        },
      },

      yAxis: [
        {
          type: 'value',
          name: yLabel,
          nameLocation: 'middle',
          nameGap: 42,
          scale: true,
          position: 'left',
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
          show: !!secondarySeries,
          axisLine: {
            lineStyle: {
              color: secondaryColor,
            },
          },
          splitLine: {
            show: false,
          },
        },
      ],

      dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],

      series: seriesEntries.map((entry) => {
        const isPrimary = entry.id === primarySeries?.id
        const isSecondary = entry.id === secondarySeries?.id
        const color = isPrimary
          ? primaryColor
          : isSecondary
            ? secondaryColor
            : '#94a3b8'
        return {
          name: entry.id,
          type: 'line' as const,
          data: entry.rows.map((row) => [row.ts, row.value]),
          showSymbol: false,
          sampling: 'lttb' as const,
          smooth: false,
          lineStyle: {
            color,
            width: 2,
          },
          itemStyle: {
            color,
          },
          yAxisIndex: isSecondary ? 1 : 0,
        }
      }),
    }

    chart.clear()
    chart.setOption(option, { notMerge: true })
    chart.off('legendselectchanged')
    chart.on('legendselectchanged', (params: any) => {
      const selectedIds = Object.entries(params.selected ?? {})
        .filter(([, enabled]) => !!enabled)
        .map(([id]) => id)
      if (selectedIds.length === 0) {
        chart.dispatchAction({ type: 'legendSelect', name: params.name })
        return
      }
      if (selectedIds.length > 2) {
        const clickedId = String(params.name ?? '')
        const primaryId =
          activeDatastreamIds[0] ||
          selectedIds.find((id) => id !== clickedId) ||
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
    t,
  ])

  return (
    <div className={className} style={{ height, width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
