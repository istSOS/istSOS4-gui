import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import * as echarts from 'echarts'

import {
  GraphSeriesEntry,
  resolvePrimaryAndSecondarySeries,
  withAlpha,
} from './observationGraphUtils'

dayjs.extend(utc)

export function buildObservationGraphOption({
  seriesEntries,
  activeDatastreamIds,
  primaryColor,
  t,
  onDownloadAllDatastreams,
}: {
  seriesEntries: GraphSeriesEntry[]
  activeDatastreamIds: string[]
  primaryColor: string
  t: (key: string) => string
  onDownloadAllDatastreams?: () => Promise<{
    filename: string
    bytes: ArrayBuffer
  } | null>
}): echarts.EChartsOption {
  const tableBorderColor = withAlpha(primaryColor, 0.35)
  const tableHeaderBg = withAlpha(primaryColor, 0.12)
  const tableRowAltBg = withAlpha(primaryColor, 0.06)
  const { primarySeries, secondarySeries } = resolvePrimaryAndSecondarySeries(
    seriesEntries,
    activeDatastreamIds
  )

  const yLabel = primarySeries?.unit
    ? `${primarySeries.observedProperty} (${primarySeries.unit})`
    : (primarySeries?.observedProperty ?? '')
  const secondaryYLabel = secondarySeries
    ? secondarySeries.unit
      ? `${secondarySeries.observedProperty} (${secondarySeries.unit})`
      : secondarySeries.observedProperty
    : ''
  const secondaryColor = '#f59e0b'

  const seriesDataRows: Array<{ date: string; stream: string; value: string }> =
    []
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

  return {
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
      formatter: (params: unknown) => {
        const rows = (Array.isArray(params) ? params : [params]) as Array<{
          axisValueLabel?: string
          seriesName?: string | number
          marker?: unknown
          data?: unknown
          value?: unknown
        }>
        const axisLabel = rows[0]?.axisValueLabel ?? ''
        const lines = rows
          .map((row) => {
            const entry = seriesEntries.find(
              (item) => item.id === String(row?.seriesName ?? '')
            )
            const displayName = entry?.name ?? String(row?.seriesName ?? '')
            const value = Array.isArray(row?.data) ? row.data[1] : row?.value
            return `${String(row?.marker ?? '')}${displayName}: ${value ?? ''}`
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
                  const rowBg = index % 2 === 0 ? 'transparent' : tableRowAltBg
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
              btn.style.background = stream === activeStream ? tableHeaderBg : '#fff'
              btn.style.color = primaryColor
              btn.onclick = () => {
                activeStream = stream
                for (const child of Array.from(tabs.children)) {
                  const element = child as HTMLButtonElement
                  element.style.background =
                    element.textContent === activeStream ? tableHeaderBg : '#fff'
                }
                renderTable(activeStream)
              }
              tabs.appendChild(btn)
            }

            if (activeStream) renderTable(activeStream)
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
      const color = isPrimary ? primaryColor : isSecondary ? secondaryColor : '#94a3b8'
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
}
