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
import * as echarts from 'echarts'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Datastream, Observation, Thing } from '@/types/domain'
import { buildObservationGraphOption } from '../lib/observationGraphOptions'
import {
  buildRows,
  buildSeriesEntries,
  resolvePrimaryAndSecondarySeries,
} from '../lib/observationGraphUtils'

type ObservationGraphProps = {
  thing?: Thing | null
  datastream?: Datastream | null
  observations?: Observation[]
  comparisonDatastream?: Datastream | null
  comparisonObservations?: Observation[]
  allSeries?: Array<{ datastream: Datastream; observations: Observation[] }>
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
    return buildRows(observations)
  }, [observations])

  const comparisonChartData = useMemo(() => {
    return buildRows(comparisonObservations)
  }, [comparisonObservations])

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

    const option = buildObservationGraphOption({
      seriesEntries,
      activeDatastreamIds,
      primaryColor,
      t: (key: string) => t(key),
      onDownloadAllDatastreams,
    })

    chart.clear()
    chart.setOption(option, { notMerge: true })
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
