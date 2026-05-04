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

  const unit = String(datastream?.unitOfMeasurement?.symbol ?? '')
  const observedProperty = String(datastream?.ObservedProperty?.name ?? '')
  const streamName = String(datastream?.name ?? '')
  const comparisonUnit = String(
    comparisonDatastream?.unitOfMeasurement?.symbol ?? ''
  )
  const comparisonObservedProperty = String(
    comparisonDatastream?.ObservedProperty?.name ?? ''
  )
  const comparisonStreamName = String(comparisonDatastream?.name ?? '')

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
      showMessage(t('general.select_datastream') ?? 'Select a datastream')
      return
    }

    if (loading) {
      showMessage(t('general.loading') ?? 'Loading…')
      return
    }

    if (error) {
      showMessage(error)
      return
    }

    if (chartData.length === 0 && comparisonChartData.length === 0) {
      showMessage(t('general.no_data') ?? 'No data')
      return
    }

    const yLabel = unit ? `${observedProperty} (${unit})` : observedProperty
    const secondaryColor = '#f59e0b'
    const seriesDataRows: Array<{
      date: string
      stream: string
      value: string
    }> = []
    for (const row of chartData) {
      seriesDataRows.push({
        date: dayjs.utc(row.ts).format('YYYY-MM-DD HH:mm'),
        stream: streamName,
        value: unit ? `${row.value} ${unit}` : String(row.value),
      })
    }
    for (const row of comparisonChartData) {
      seriesDataRows.push({
        date: dayjs.utc(row.ts).format('YYYY-MM-DD HH:mm'),
        stream: comparisonStreamName,
        value: comparisonUnit
          ? `${row.value} ${comparisonUnit}`
          : String(row.value),
      })
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
        bottom: 70,
      },

      tooltip: {
        trigger: 'axis',
        borderColor: primaryColor,
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
            readOnly: true,
            lang: ['', t('general.close') ?? 'Close', ''],
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
              const rows = seriesDataRows.map((row, index) => {
                const rowBg = index % 2 === 0 ? 'transparent' : tableRowAltBg

                return `<tr>
                  <td style="padding:6px 10px;border:1px solid ${tableBorderColor};background:${rowBg};">${row.date}</td>
                  <td style="padding:6px 10px;border:1px solid ${tableBorderColor};background:${rowBg};">${row.stream}</td>
                  <td style="padding:6px 10px;border:1px solid ${tableBorderColor};background:${rowBg};">${row.value}</td>
                </tr>`
              })

              return `<table style="width:100%;border-collapse:collapse;font-size:12px;color:${primaryColor};">
                <thead>
                  <tr>
                    <th style="padding:6px 10px;border:1px solid ${tableBorderColor};text-align:left;background:${tableHeaderBg};">Date</th>
                    <th style="padding:6px 10px;border:1px solid ${tableBorderColor};text-align:left;background:${tableHeaderBg};">Datastream</th>
                    <th style="padding:6px 10px;border:1px solid ${tableBorderColor};text-align:left;background:${tableHeaderBg};">Value</th>
                  </tr>
                </thead>
                <tbody>${rows.join('')}</tbody>
              </table>`
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
      },

      xAxis: {
        type: 'time',
        axisLine: {
          lineStyle: {
            color: primaryColor,
          },
        },
        axisLabel: {
          hideOverlap: true,
          formatter: (value: number) => dayjs.utc(value).format('HH:mm'),
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
          name: comparisonUnit
            ? `${comparisonObservedProperty} (${comparisonUnit})`
            : comparisonObservedProperty,
          nameLocation: 'middle',
          nameGap: 48,
          scale: true,
          position: 'right',
          show: !!comparisonDatastream,
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

      series: [
        {
          name: streamName,
          type: 'line',
          data: chartData.map((row) => [row.ts, row.value]),
          showSymbol: false,
          sampling: 'lttb',
          smooth: false,
          lineStyle: {
            color: primaryColor,
            width: 2,
          },
          itemStyle: {
            color: primaryColor,
          },
          yAxisIndex: 0,
        },
        ...(comparisonDatastream
          ? [
              {
                name: comparisonStreamName,
                type: 'line' as const,
                data: comparisonChartData.map((row) => [row.ts, row.value]),
                showSymbol: false,
                sampling: 'lttb' as const,
                smooth: false,
                lineStyle: {
                  color: secondaryColor,
                  width: 2,
                },
                itemStyle: {
                  color: secondaryColor,
                },
                yAxisIndex: 1,
              },
            ]
          : []),
      ],
    }

    chart.clear()
    chart.setOption(option, { notMerge: true })
    chart.resize()
  }, [
    datastream,
    chartData,
    comparisonDatastream,
    comparisonChartData,
    streamName,
    comparisonStreamName,
    observedProperty,
    unit,
    comparisonObservedProperty,
    comparisonUnit,
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
