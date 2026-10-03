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

/**
 * @file features/observations/components/customize-quality/QualityPreviewChart.tsx
 *
 * The rules editor's chart: one series over a "Now" strip and a "New" strip.
 *
 * Both strips are the SAME readings, judged under the rules in use and under
 * the draft — so any difference between them is the draft's doing, which is
 * the one thing the preview has to make visible. It is hover-only: the details
 * rail belongs to the full chart, and opening it here would squeeze a plot that
 * is already short.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as echarts from 'echarts'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  buildQualityPreviewOption,
  escapeHtml,
  syncLaneGridToPlotGrid,
} from '../../lib/observationGraphOptions'
import type {
  GraphRow,
  GraphSeriesEntry,
} from '../../lib/observationGraphUtils'
import {
  QUALITY_COLORS,
  buildQualitySegments,
  describeRuleCondition,
  qualityLabel,
  type QualityScheme,
} from '../../lib/resultQuality'

dayjs.extend(utc)

/** The draft's strip is tagged in the chart's own colour; "Now" stays neutral. */
const NOW_TAG_COLOR = '#94a3b8'

export default function QualityPreviewChart({
  entry,
  currentRows,
  currentScheme,
  draftRows,
  draftScheme,
  primaryColor,
}: {
  /** The series as the draft reads it — its rows are `draftRows`. */
  entry: GraphSeriesEntry
  currentRows: GraphRow[]
  currentScheme: QualityScheme
  draftRows: GraphRow[]
  draftScheme: QualityScheme
  primaryColor: string
}) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.EChartsType | null>(null)

  const option = useMemo(() => {
    const currentByTs = new Map(currentRows.map((row) => [row.ts, row]))
    const swatch = (color: string) =>
      `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;` +
      `background:${color};margin-right:4px"></span>`
    return buildQualityPreviewOption({
      entry: { ...entry, rows: draftRows },
      primaryColor,
      lanes: [
        {
          id: 'now',
          tag: t('quality.customize.lane_now'),
          tagColor: NOW_TAG_COLOR,
          segments: buildQualitySegments(
            currentRows.map((row) => ({ x: row.ts, qualityClass: row.qualityClass }))
          ),
        },
        {
          id: 'new',
          tag: t('quality.customize.lane_new'),
          tagColor: primaryColor,
          segments: buildQualitySegments(
            draftRows.map((row) => ({ x: row.ts, qualityClass: row.qualityClass }))
          ),
        },
      ],
      tooltip: (row) => {
        const before = currentByTs.get(row.ts)
        const rule =
          typeof row.qualityRule === 'number' && draftScheme.rules[row.qualityRule]
            ? ` <span style="opacity:0.6">#${row.qualityRule + 1} · ${escapeHtml(
                describeRuleCondition(draftScheme.rules[row.qualityRule])
              )}</span>`
            : row.qualityRule === 'fallback'
              ? ` <span style="opacity:0.6">${escapeHtml(t('quality.rule_fallback'))}</span>`
              : ''
        const code =
          row.quality !== null
            ? ` <span style="opacity:0.6">${row.quality}</span>`
            : ''
        return (
          `<div>${dayjs.utc(row.ts).format('YYYY-MM-DD HH:mm')} UTC</div>` +
          `<div><b>${row.value}${entry.unit ? ` ${escapeHtml(entry.unit)}` : ''}</b>${code}</div>` +
          (before
            ? `<div>${escapeHtml(t('quality.customize.lane_now'))}: ` +
              `${swatch(QUALITY_COLORS[before.qualityClass])}` +
              `${escapeHtml(qualityLabel(before.qualityClass, currentScheme, t))}</div>`
            : '') +
          `<div>${escapeHtml(t('quality.customize.lane_new'))}: ` +
          `${swatch(QUALITY_COLORS[row.qualityClass])}` +
          `<b>${escapeHtml(qualityLabel(row.qualityClass, draftScheme, t))}</b>${rule}</div>`
        )
      },
    })
  }, [entry, currentRows, currentScheme, draftRows, draftScheme, primaryColor, t])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = echarts.init(el)
    chartRef.current = chart
    const ro = new ResizeObserver(() => {
      chart.resize()
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
    chart.setOption(option, { notMerge: true })
    syncLaneGridToPlotGrid(chart)
  }, [option])

  return <div ref={containerRef} className="h-full w-full" />
}
