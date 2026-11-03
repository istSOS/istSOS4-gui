'use client'

import ObservationTable from '@/features/observations/components/ObservationTable'
import QualityBadge from '@/features/observations/components/QualityBadge'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ReviewIcon } from '@/components/icons'
import { tableStyles } from '@/components/table/tableStyles'

import QcExplanation from './QcExplanation'
import { CheckDefinition, QualityDetails } from './QcQualityDetails'

import { phenomenonTimeEnd } from '../../../lib/phenomenonTime'
import {
  dataStatus,
  fitsMask,
  humanStatus,
  numericValue,
  parseMask,
  rawText,
  slotState,
} from '../lib/bitmask'
import { changed, rowValue } from '../lib/model'
import { explainCheck } from '../lib/qualityExplanation'
import { formatObservationTime, formatUtcOffset } from '../lib/timezone'
import type { Constraint, Draft, Drafts, QcRow } from '../lib/types'

export { PAGE_SIZE } from '@/features/observations/components/ObservationTable'

function ValueCell({
  value,
  onChange,
  disabled,
  label,
  modified,
}: {
  value: unknown
  onChange: (value: number | null) => void
  disabled: boolean
  label: string
  modified: boolean
}) {
  const initial =
    value == null
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
  const [text, setText] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  const cancelled = useRef(false)
  function commit() {
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    if (text.trim() && !Number.isFinite(Number(text))) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const next = text.trim() ? Number(text) : null
    if (
      next !== numericValue(value) ||
      (next === null && value !== null) ||
      (typeof value === 'object' && value !== null)
    )
      onChange(next)
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      title={
        invalid
          ? 'Enter a finite number, or leave empty for missing data'
          : undefined
      }
      value={text}
      disabled={disabled}
      onChange={(event) => {
        setText(event.target.value)
        setInvalid(false)
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          cancelled.current = true
          setText(initial)
          setInvalid(false)
          event.currentTarget.blur()
        }
      }}
      className={`h-6 w-24 rounded border px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-primary disabled:opacity-50 ${invalid ? 'border-danger bg-danger-50' : modified ? 'border-warning bg-warning-50' : 'border-default-300 bg-content1'}`}
    />
  )
}

export default function QcTable({
  rows,
  drafts,
  constraints,
  selected,
  onSelect,
  onEdit,
  onReview,
  disabled,
  encoded,
  originalEncoded,
  page,
  onPage,
  focusKey,
  utcOffset,
  editable = true,
  reviewable = true,
  serviceMode = false,
  unit,
}: {
  rows: QcRow[]
  drafts: Drafts
  constraints: Constraint[]
  selected: string[]
  onSelect: (keys: string[]) => void
  onEdit: (key: string, value: number | null) => void
  onReview: (keys: string[]) => void
  disabled: boolean
  encoded: boolean
  originalEncoded: boolean
  page: number
  onPage: (page: number) => void
  focusKey?: string | null
  utcOffset: number
  editable?: boolean
  reviewable?: boolean
  serviceMode?: boolean
  unit?: string
}) {
  const { t } = useTranslation()
  const cell = tableStyles.cell
  const columns = useMemo(
    () => [
      {
        uid: 'time',
        name: t('qc.time_offset', { offset: formatUtcOffset(utcOffset) }),
      },
      { uid: 'original', name: t('qc.original'), numeric: true },
      { uid: 'draft', name: t('qc.draft_value'), numeric: true },
      { uid: 'originalQuality', name: t('qc.original_quality') },
      { uid: 'draftQuality', name: t('qc.draft_quality') },
      { uid: 'state', name: t('qc.data_state_label') },
      { uid: 'human', name: t('qc.human_review') },
      ...constraints.slice(0, 4).map((constraint, index) => ({
        uid: `check-${index + 1}`,
        name: `${index + 1} · ${t(`qc.workflow.tests.${constraint.type}`, { defaultValue: constraint.type })}`,
        header: (
          <QcExplanation
            title={t(`qc.workflow.tests.${constraint.type}`, {
              defaultValue: constraint.type,
            })}
            content={<CheckDefinition constraint={constraint} unit={unit} />}
          >{`${index + 1} · ${t(`qc.workflow.tests.${constraint.type}`, { defaultValue: constraint.type })}`}</QcExplanation>
        ),
      })),
      ...(reviewable ? [{ uid: 'actions', name: t('general.actions') }] : []),
    ],
    [constraints, reviewable, t, utcOffset, unit]
  )
  function qualityCell(row: QcRow, draft?: Draft) {
    const quality = draft ? draft.resultQuality : row.resultQuality
    const interpreted = draft ? encoded : originalEncoded
    const label = t(draft ? 'qc.draft_quality' : 'qc.original_quality')
    return (
      <span className="inline-flex items-center gap-1">
        <QcExplanation
          icon
          title={`${label}: ${rawText(quality)}`}
          content={
            <QualityDetails
              row={row}
              draft={draft}
              constraints={constraints}
              encoded={interpreted}
              serviceMode={serviceMode}
              unit={unit}
            />
          }
        >
          {interpreted ? (
            <QualityBadge
              quality={quality}
              count={constraints.length}
              stale={draft?.staleSlots}
            />
          ) : (
            <span>
              <code>{rawText(quality)}</code>
              {draft?.qualityPending && (
                <span className="ml-2 text-warning-700">
                  {t('qc.workflow.flag_pending')}
                </span>
              )}
            </span>
          )}
        </QcExplanation>
      </span>
    )
  }
  return (
    <ObservationTable
      continuous
      focusKey={focusKey}
      rows={rows}
      columns={columns}
      selected={selected}
      onSelect={onSelect}
      page={page}
      onPage={onPage}
      disabled={disabled}
      renderCells={(row, columnVisible) => {
        const draft = rowValue(row, drafts)
        const dirty = changed(row, draft)
        const valueChanged = rawText(row.result) !== rawText(draft.result)
        const mask = fitsMask(draft.resultQuality, constraints.length)
          ? parseMask(draft.resultQuality)
          : null
        return (
          <>
            {columnVisible('time') && (
              <td className={cell}>
                <button
                  type="button"
                  className="text-left tabular-nums hover:text-primary"
                  onClick={() => onSelect([row.key])}
                >
                  <time
                    title={row.time}
                    dateTime={phenomenonTimeEnd(row.time) ?? undefined}
                  >
                    {formatObservationTime(row.time, utcOffset)}
                  </time>
                </button>
                {row.scope === 'following' && (
                  <span className="ml-2 text-warning-700">
                    {t('qc.following')}
                  </span>
                )}
              </td>
            )}
            {columnVisible('original') && (
              <td className={`${cell} ${tableStyles.numeric} text-default-500`}>
                {rawText(row.result)}
              </td>
            )}
            {columnVisible('draft') && (
              <td className={`${cell} ${tableStyles.numeric}`}>
                {editable && row.scope === 'window' ? (
                  <ValueCell
                    key={`${row.key}:${rawText(draft.result)}`}
                    value={draft.result}
                    disabled={disabled}
                    modified={valueChanged}
                    label={`${t('qc.draft_value')} ${row.time}`}
                    onChange={(value) => onEdit(row.key, value)}
                  />
                ) : (
                  <span
                    className={`tabular-nums ${valueChanged ? 'rounded bg-warning-50 px-1.5 py-0.5 font-medium text-warning-800' : ''}`}
                  >
                    {rawText(draft.result)}
                  </span>
                )}
              </td>
            )}
            {columnVisible('originalQuality') && (
              <td className={cell}>{qualityCell(row)}</td>
            )}
            {columnVisible('draftQuality') && (
              <td className={cell}>
                <span
                  className={
                    dirty
                      ? 'inline-flex border-l-2 border-warning pl-1.5'
                      : undefined
                  }
                >
                  {qualityCell(row, draft)}
                </span>
              </td>
            )}
            {columnVisible('state') && (
              <td className={cell}>
                {encoded &&
                fitsMask(draft.resultQuality, constraints.length) &&
                mask !== null ? (
                  <span className="inline-flex items-center gap-1">
                    <QcExplanation
                      icon
                      title={t('qc.data_state_label')}
                      content={
                        <QualityDetails
                          row={row}
                          draft={draft}
                          constraints={constraints}
                          encoded={encoded}
                          serviceMode={serviceMode}
                          unit={unit}
                        />
                      }
                    >
                      {t(`qc.data_state.${dataStatus(mask)}`)}
                    </QcExplanation>
                  </span>
                ) : (
                  '—'
                )}
              </td>
            )}
            {columnVisible('human') && (
              <td className={cell}>
                {encoded && (
                  <span className="mr-1 inline-flex items-center gap-1">
                    <QcExplanation
                      icon
                      title={t('qc.human_review')}
                      content={
                        <QualityDetails
                          row={row}
                          draft={draft}
                          constraints={constraints}
                          encoded={encoded}
                          serviceMode={serviceMode}
                          unit={unit}
                        />
                      }
                    >
                      {mask !== null
                        ? t(
                            `qc.${humanStatus(slotState(mask, constraints.length + 1))}`
                          )
                        : t(
                            draft.resultQuality == null
                              ? 'qc.not_reviewed'
                              : 'qc.verdict.unknown'
                          )}
                    </QcExplanation>
                  </span>
                )}
              </td>
            )}
            {constraints.slice(0, 4).map((constraint, index) => {
              const slot = index + 1
              const state =
                encoded && mask !== null ? slotState(mask, slot) : -1
              const pending = draft.staleSlots.includes(slot)
              const info = explainCheck(row, draft, constraints, slot, encoded)
              return (
                columnVisible(`check-${slot}`) && (
                  <td key={slot} className={cell}>
                    <span
                      className={
                        pending
                          ? 'text-warning-700'
                          : state === 2
                            ? 'text-danger'
                            : state === 3
                              ? 'text-success'
                              : 'text-default-500'
                      }
                    >
                      {state < 0
                        ? '—'
                        : pending
                          ? t('qc.needs_check')
                          : t(
                              info.status === 'unknown'
                                ? 'qc.verdict.unknown'
                                : `qc.${info.status}`
                            )}
                    </span>
                  </td>
                )
              )
            })}
            {reviewable && columnVisible('actions') && (
              <td className={cell}>
                {reviewable && (
                  <button
                    type="button"
                    disabled={
                      disabled ||
                      !reviewable ||
                      row.scope !== 'window' ||
                      (!serviceMode &&
                        (!encoded ||
                          (draft.resultQuality != null &&
                            !fitsMask(
                              draft.resultQuality,
                              constraints.length
                            ))))
                    }
                    aria-label={`${t('qc.review_observation')} ${row.time}`}
                    onClick={() => onReview([row.key])}
                    className={tableStyles.action}
                    title={
                      serviceMode
                        ? t('qc.workflow.assign_flag')
                        : t('qc.explain.review_action')
                    }
                  >
                    <ReviewIcon size={18} />
                  </button>
                )}
              </td>
            )}
          </>
        )
      }}
    />
  )
}
