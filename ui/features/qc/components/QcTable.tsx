'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import QcExplanation from './QcExplanation'
import { CheckDefinition, QualityDetails } from './QcQualityDetails'

import {
  VERDICT_COLORS,
  dataStatus,
  fitsMask,
  humanStatus,
  maskVerdict,
  numericValue,
  parseMask,
  rawText,
  slotState,
} from '../lib/bitmask'
import { changed, rowValue } from '../lib/model'
import { explainCheck } from '../lib/qualityExplanation'
import { formatObservationTime, formatUtcOffset } from '../lib/timezone'
import type { Constraint, Draft, Drafts, QcRow } from '../lib/types'

export const PAGE_SIZE = 25

function ValueCell({
  value,
  onChange,
  disabled,
  label,
}: {
  value: unknown
  onChange: (value: number | null) => void
  disabled: boolean
  label: string
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
      className={`w-32 rounded border px-2 py-1.5 tabular-nums outline-none focus:border-primary disabled:opacity-50 ${invalid ? 'border-danger bg-danger-50' : 'border-default-300 bg-content1'}`}
    />
  )
}

export function QualityBadge({
  quality,
  count,
  stale = [],
}: {
  quality: unknown
  count: number
  stale?: number[]
}) {
  const { t } = useTranslation()
  const verdict = maskVerdict(quality, count, stale)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span
        className="h-2 w-2 rounded-sm"
        style={{ background: VERDICT_COLORS[verdict] }}
      />
      {t(`qc.verdict.${verdict}`)}{' '}
      <code className="opacity-60">{rawText(quality)}</code>
      {!!stale.length && verdict !== 'stale' && (
        <span className="text-warning-700">· {t('qc.needs_check')}</span>
      )}
    </span>
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
  utcOffset: number
  editable?: boolean
  reviewable?: boolean
  serviceMode?: boolean
  unit?: string
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const selectedKeys = new Set(selected)
  const filteredKeys = new Set(rows.map((row) => row.key))
  const selectedCount = rows.filter((row) => selectedKeys.has(row.key)).length
  const allSelected = rows.length > 0 && selectedCount === rows.length
  const partlySelected = selectedCount > 0 && !allSelected
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1)
  )
  const shown = rows.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  )
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [currentPage])
  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = partlySelected
  }, [partlySelected])
  const cell = 'px-3 py-2 text-left text-xs whitespace-nowrap'
  const toggle = (key: string) =>
    onSelect(
      selectedKeys.has(key)
        ? selected.filter((value) => value !== key)
        : [...selected, key]
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
    <div className="min-w-0">
      <div
        ref={scrollRef}
        className="max-h-[min(42dvh,380px)] overflow-auto rounded border border-default-200 focus-visible:outline-2 focus-visible:outline-primary"
        tabIndex={0}
        role="region"
        aria-label={t('qc.table_label')}
      >
        <table
          className="w-full border-collapse text-sm"
          aria-label={t('qc.table_label')}
        >
          <thead className="sticky top-0 z-10 bg-default-100">
            <tr>
              <th className={cell}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label={t('qc.select_filtered')}
                  title={t('qc.select_filtered')}
                  aria-checked={partlySelected ? 'mixed' : allSelected}
                  disabled={disabled || !rows.length}
                  checked={allSelected}
                  onChange={(event) =>
                    onSelect(
                      event.target.checked
                        ? [...new Set([...selected, ...filteredKeys])]
                        : selected.filter((key) => !filteredKeys.has(key))
                    )
                  }
                />
              </th>
              {[
                t('qc.time_offset', { offset: formatUtcOffset(utcOffset) }),
                t('qc.original'),
                t('qc.draft_value'),
                t('qc.original_quality'),
                t('qc.draft_quality'),
              ].map((label) => (
                <th key={label} className={cell}>
                  {label}
                </th>
              ))}
              <th className={cell}>{t('qc.data_state_label')}</th>
              <th className={cell}>{t('qc.human_review')}</th>
              {constraints.slice(0, 4).map((constraint, index) => (
                <th key={index} className={cell}>
                  <QcExplanation
                    title={t(`qc.workflow.tests.${constraint.type}`, {
                      defaultValue: constraint.type,
                    })}
                    content={
                      <CheckDefinition constraint={constraint} unit={unit} />
                    }
                  >
                    {index + 1} ·{' '}
                    {t(`qc.workflow.tests.${constraint.type}`, {
                      defaultValue: constraint.type,
                    })}
                  </QcExplanation>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const draft = rowValue(row, drafts)
              const dirty = changed(row, draft)
              const mask = fitsMask(draft.resultQuality, constraints.length)
                ? parseMask(draft.resultQuality)
                : null
              return (
                <tr
                  key={row.key}
                  className={`border-t border-default-100 ${selectedKeys.has(row.key) ? 'bg-primary-50' : dirty ? 'bg-warning-50/60' : 'hover:bg-default-50'}`}
                >
                  <td className={cell}>
                    <input
                      type="checkbox"
                      aria-label={`${t('qc.select_row')} ${row.time}`}
                      checked={selectedKeys.has(row.key)}
                      disabled={disabled}
                      onChange={() => toggle(row.key)}
                    />
                  </td>
                  <td className={cell}>
                    <button
                      type="button"
                      className="text-left tabular-nums hover:text-primary"
                      onClick={() => onSelect([row.key])}
                    >
                      <time title={row.time}>
                        {formatObservationTime(row.time, utcOffset)}
                      </time>
                    </button>
                    {row.scope === 'following' && (
                      <span className="ml-2 text-warning-700">
                        {t('qc.following')}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} tabular-nums text-default-500`}>
                    {rawText(row.result)}
                  </td>
                  <td className={cell}>
                    {editable && row.scope === 'window' ? (
                      <ValueCell
                        key={`${row.key}:${rawText(draft.result)}`}
                        value={draft.result}
                        disabled={disabled}
                        label={`${t('qc.draft_value')} ${row.time}`}
                        onChange={(value) => onEdit(row.key, value)}
                      />
                    ) : (
                      <span className="tabular-nums">
                        {rawText(draft.result)}
                      </span>
                    )}
                  </td>
                  <td className={cell}>{qualityCell(row)}</td>
                  <td className={cell}>{qualityCell(row, draft)}</td>
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
                        className="rounded border border-default-300 px-2 py-1 text-primary disabled:opacity-50"
                      >
                        {serviceMode
                          ? t('qc.workflow.assign_flag')
                          : t('qc.explain.review_action')}
                      </button>
                    )}
                  </td>
                  {constraints.slice(0, 4).map((constraint, index) => {
                    const slot = index + 1
                    const state =
                      encoded && mask !== null ? slotState(mask, slot) : -1
                    const pending = draft.staleSlots.includes(slot)
                    const info = explainCheck(
                      row,
                      draft,
                      constraints,
                      slot,
                      encoded
                    )
                    return (
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
                  })}
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td
                  colSpan={8 + constraints.length}
                  className="p-6 text-center text-default-500"
                >
                  {t('qc.no_rows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center justify-between py-2 text-xs text-default-600">
        <span>
          {rows.length.toLocaleString()} {t('qc.rows')} · {t('qc.page')}{' '}
          {currentPage + 1}/{Math.max(1, Math.ceil(rows.length / PAGE_SIZE))}
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => onPage(currentPage - 1)}
            className="disabled:opacity-30"
          >
            {t('general.back')}
          </button>
          <button
            type="button"
            disabled={(currentPage + 1) * PAGE_SIZE >= rows.length}
            onClick={() => onPage(currentPage + 1)}
            className="disabled:opacity-30"
          >
            {t('general.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
