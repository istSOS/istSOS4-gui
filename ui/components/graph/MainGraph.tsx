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

function extractTimeIso(obs: any): string | null {
  const raw = obs?.phenomenonTime
  if (typeof raw !== 'string' || !raw) return null

  const first = raw.includes('/') ? raw.split('/')[0] : raw
  const d = dayjs.utc(first)
  return d.isValid() ? d.toISOString() : null
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
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language

  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)

  const seriesData = useMemo(() => {
    const obsArr: any[] = Array.isArray(observations) ? observations : []

    const byTime = new Map<string, number>()

    for (const obs of obsArr) {
      const timeIso = extractTimeIso(obs)
      const valueNum = toNumber(obs?.result)
      if (!timeIso || valueNum === null) continue

      byTime.set(timeIso, valueNum)
    }

    const points = Array.from(byTime.entries()) as Array<[string, number]>

    points.sort((a, b) => dayjs.utc(a[0]).valueOf() - dayjs.utc(b[0]).valueOf())

    return points
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

    roRef.current = new ResizeObserver(() => chart.resize())
    roRef.current.observe(el)

    return () => {
      roRef.current?.disconnect()
      roRef.current = null
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const setCenteredTitle = (text: string) => {
      chart.clear()
      chart.setOption(
        {
          title: {
            text,
            left: 'center',
            top: 'middle',
            textStyle: { fontSize: 14, fontWeight: 'normal' },
          },
        },
        { notMerge: true }
      )
      chart.resize()
    }

    if (!datastream) {
      setCenteredTitle(t('general.select_datastream') ?? 'Select a datastream')
      return
    }

    if (loading) {
      setCenteredTitle(t('general.loading') ?? 'Loading…')
      return
    }

    if (error) {
      setCenteredTitle(error)
      return
    }

    if (seriesData.length === 0) {
      setCenteredTitle(t('general.no_data') ?? 'No data')
      return
    }

    const TEN_MIN_MS = 10 * 60 * 1000

    const firstTs = dayjs.utc(seriesData[0][0]).valueOf()
    const lastTs = dayjs.utc(seriesData[seriesData.length - 1][0]).valueOf()

    const xMin = Number.isFinite(firstTs) ? firstTs : undefined
    const xMax = Number.isFinite(lastTs) ? lastTs : undefined

    const title = streamName
    const yLabel = `${observedProperty} (${unit})`

    const option: echarts.EChartsOption = {
      animation: false,
      grid: { left: 56, right: 20, top: 44, bottom: 52, containLabel: true },

      title: {
        text: title,
        subtext: thingName,
        left: 0,
        top: 0,
      },

      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (v: any) => {
          if (typeof v === 'number' && Number.isFinite(v)) {
            return unit ? `${v} ${unit}` : String(v)
          }
          return String(v ?? '')
        },
      },

      toolbox: {
        right: 0,
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
        },
      },

      xAxis: {
        type: 'time',
        min: xMin,
        max: xMax,
        minInterval: TEN_MIN_MS,
        splitNumber: 8,
        axisLabel: {
          hideOverlap: true,
          formatter: (value: number) => {
            const d = dayjs.utc(value)
            return d.hour() === 0 && d.minute() === 0
              ? d.format('YYYY-MM-DD')
              : d.format('HH:mm')
          },
        },
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        nameLocation: 'middle',
        nameGap: 42,
        scale: true,
        axisLabel: { hideOverlap: true },
      },

      dataZoom: [{ type: 'inside', xAxisIndex: 0 }],

      series: [
        {
          name: streamName,
          type: 'line',
          showSymbol: false,
          sampling: 'lttb',
          data: seriesData,
        },
      ],
    }

    chart.setOption(option, { notMerge: true })
    chart.resize()
  }, [
    datastream,
    seriesData,
    streamName,
    thingName,
    unit,
    loading,
    error,
    t,
    lang,
  ])

  return (
    <div className={className} style={{ height, width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
