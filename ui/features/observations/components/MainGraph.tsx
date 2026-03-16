'use client'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as echarts from 'echarts'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

dayjs.extend(utc)

type Props = {
  thing?: any | null
  datastream?: any | null
  observations?: any[]
  loading?: boolean
  error?: string | null
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

export default function MainGraph({
  thing = null,
  datastream = null,
  observations = [],
  loading = false,
  error = null,
  className = '',
  height = '100%',
}: Props) {
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

    return {
      categories: rows.map((row) =>
        dayjs.utc(row.ts).format('YYYY-MM-DD HH:mm')
      ),
      values: rows.map((row) => row.value),
    }
  }, [observations])

  const unit = String(datastream?.unitOfMeasurement?.symbol ?? '')
  const observedProperty = String(datastream?.ObservedProperty?.name ?? '')
  const streamName = String(datastream?.name ?? '')
  const thingName = String(thing?.name ?? '')

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

    if (chartData.values.length === 0) {
      showMessage(t('general.no_data') ?? 'No data')
      return
    }

    const yLabel = unit ? `${observedProperty} (${unit})` : observedProperty

    const option: echarts.EChartsOption = {
      animation: false,
      grid: {
        left: 56,
        right: 20,
        top: 44,
        bottom: 60,
        containLabel: true,
      },

      title: {
        text: streamName,
        subtext: thingName,
        left: 0,
        top: 0,
      },

      tooltip: {
        trigger: 'axis',
      },

      toolbox: {
        right: 0,
        feature: {
          dataZoom: { xAxisIndex: 0, yAxisIndex: 'none' },
          restore: {},
        },
      },

      xAxis: {
        type: 'category',
        data: chartData.categories,
        boundaryGap: false,
        axisLabel: {
          hideOverlap: true,
          formatter: (value: string) => dayjs.utc(value).format('HH:mm'),
        },
      },

      yAxis: {
        type: 'value',
        name: yLabel,
        nameLocation: 'middle',
        nameGap: 42,
        scale: true,
      },

      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'slider', xAxisIndex: 0, filterMode: 'none' },
      ],

      series: [
        {
          name: streamName,
          type: 'line',
          data: chartData.values,
          showSymbol: false,
          sampling: 'lttb',
          smooth: false,
        },
      ],
    }

    chart.clear()
    chart.setOption(option, { notMerge: true })
    chart.resize()
  }, [
    datastream,
    chartData,
    streamName,
    thingName,
    observedProperty,
    unit,
    loading,
    error,
    t,
  ])

  return (
    <div className={className} style={{ height, width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
