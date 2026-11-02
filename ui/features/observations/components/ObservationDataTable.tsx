'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { tableStyles } from '@/components/table/tableStyles'

import ObservationQuality from './ObservationQuality'
import ObservationTable from './ObservationTable'

import QcExplanation from '../../qc/components/QcExplanation'
import { CheckDefinition } from '../../qc/components/QcQualityDetails'
import {
  checkStatus,
  dataStatus,
  fitsMask,
  humanStatus,
  parseMask,
  rawText,
  slotState,
} from '../../qc/lib/bitmask'
import { formatObservationTime, formatUtcOffset } from '../../qc/lib/timezone'
import type { GraphRow, GraphSeriesEntry } from '../lib/observationGraphUtils'

export type ObservationDataRow = {
  key: string
  time: string
  x: number
  row: GraphRow
  entry: GraphSeriesEntry
}
const defaultColumns = new Set(['series', 'time', 'value', 'quality'])

export default function ObservationDataTable({
  rows,
  selected,
  onSelect,
  page,
  onPage,
  focusKey,
  utcOffset = 0,
}: {
  rows: ObservationDataRow[]
  selected: string[]
  onSelect: (keys: string[]) => void
  page: number
  onPage: (page: number) => void
  focusKey?: string | null
  utcOffset?: number
}) {
  const { t } = useTranslation()
  const multiple = new Set(rows.map((row) => row.entry.id)).size > 1
  const checkCount = rows.reduce(
    (max, row) => Math.max(max, row.entry.qualityConstraints?.length ?? 0),
    0
  )
  const columns = useMemo(
    () => [
      ...(multiple ? [{ uid: 'series', name: t('observations.series') }] : []),
      {
        uid: 'time',
        name: t('qc.time_offset', { offset: formatUtcOffset(utcOffset) }),
      },
      { uid: 'value', name: t('qc.value'), numeric: true },
      { uid: 'quality', name: t('qc.quality') },
      { uid: 'state', name: t('qc.data_state_label') },
      { uid: 'human', name: t('qc.human_review') },
      ...Array.from({ length: Math.min(checkCount, 4) }, (_, i) => ({
        uid: `check-${i}`,
        name: `${t('qc.check')} ${i + 1}`,
      })),
    ],
    [multiple, checkCount, t, utcOffset]
  )
  const cell = tableStyles.cell
  return (
    <ObservationTable
      continuous
      rows={rows}
      columns={columns}
      selected={selected}
      onSelect={onSelect}
      page={page}
      onPage={onPage}
      focusKey={focusKey}
      defaultColumns={defaultColumns}
      maxHeight="min(28dvh,260px)"
      renderCells={(item, visible) => {
        const { row, entry } = item
        const constraints = entry.qualityConstraints ?? []
        const encoded =
          entry.qualityMode === 'bitmask' && entry.qualityConstraints !== null
        const mask =
          encoded && fitsMask(row.rawQuality, constraints.length)
            ? parseMask(row.rawQuality)
            : null
        return (
          <>
            {multiple && visible('series') && (
              <td className={cell}>{entry.name}</td>
            )}
            {visible('time') && (
              <td className={cell}>
                <button
                  type="button"
                  className="tabular-nums hover:text-primary"
                  onClick={() => onSelect([item.key])}
                >
                  <time dateTime={item.time}>
                    {formatObservationTime(item.time, utcOffset)}
                  </time>
                </button>
              </td>
            )}
            {visible('value') && (
              <td className={`${cell} ${tableStyles.numeric}`}>
                {rawText(row.rawValue)}
                {entry.unit ? ` ${entry.unit}` : ''}
              </td>
            )}
            {visible('quality') && (
              <td className={cell}>
                <ObservationQuality row={row} entry={entry} />
              </td>
            )}
            {visible('state') && (
              <td className={cell}>
                {mask === null ? '—' : t(`qc.data_state.${dataStatus(mask)}`)}
              </td>
            )}
            {visible('human') && (
              <td className={cell}>
                {mask === null
                  ? '—'
                  : t(
                      `qc.${humanStatus(slotState(mask, constraints.length + 1))}`
                    )}
              </td>
            )}
            {Array.from(
              { length: Math.min(checkCount, 4) },
              (_, i) =>
                visible(`check-${i}`) && (
                  <td key={i} className={cell}>
                    {constraints[i] && (
                      <QcExplanation
                        title={t(`qc.workflow.tests.${constraints[i].type}`, {
                          defaultValue: constraints[i].type,
                        })}
                        content={
                          <CheckDefinition
                            constraint={constraints[i]}
                            unit={entry.unit}
                          />
                        }
                      >
                        {mask === null
                          ? '—'
                          : t(`qc.${checkStatus(slotState(mask, i + 1))}`)}
                      </QcExplanation>
                    )}
                  </td>
                )
            )}
          </>
        )
      }}
    />
  )
}
