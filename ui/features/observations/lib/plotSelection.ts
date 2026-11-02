import type { EChartsType } from 'echarts'

/** Complete ranges survive dragging a brush beyond the current zoom, as in Edit/QC. */
export function selectBrushRows<Row extends { key: string; ts: number }>(
  chart: EChartsType,
  event: unknown,
  rows: Row[]
): string[] {
  const areas = (
    event as { areas?: Array<{ range?: number[]; coordRange?: number[] }> }
  ).areas
  const ranges =
    areas
      ?.map((area) =>
        area.range?.length === 2
          ? area.range.map((pixel) =>
              Math.round(
                Number(chart.convertFromPixel({ xAxisIndex: 0 }, pixel))
              )
            )
          : area.coordRange
      )
      .filter(
        (range): range is number[] =>
          !!range && range.length === 2 && range.every(Number.isFinite)
      )
      .map((range) => [Math.min(...range), Math.max(...range)]) ?? []
  chart.dispatchAction(
    {
      type: 'brush',
      areas: ranges.map((coordRange) => ({
        brushType: 'lineX',
        xAxisIndex: 0,
        coordRange,
      })),
    },
    { silent: true }
  )
  return rows
    .filter((row) =>
      ranges.some(([start, end]) => row.ts >= start && row.ts <= end)
    )
    .map((row) => row.key)
}
