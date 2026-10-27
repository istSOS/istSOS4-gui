'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from './QcButton'

import { rawText } from '../lib/bitmask'
import { rowValue } from '../lib/model'
import { planEdits } from '../lib/operations'
import {
  formatObservationTime,
  formatUtcOffset,
  fromOffsetInput,
  toOffsetInput,
} from '../lib/timezone'
import type {
  Drafts,
  EditOperation,
  EditPlan,
  EditRequest,
  QcRow,
} from '../lib/types'

export default function QcEditValues({
  rows,
  drafts,
  selected,
  start,
  end,
  checkCount,
  lockedReason,
  onApply,
  onPreview,
  utcOffset,
  encoded,
  unit,
}: {
  rows: QcRow[]
  drafts: Drafts
  selected: string[]
  start: string
  end: string
  checkCount: number
  lockedReason: string
  onApply: (request: EditRequest) => boolean
  onPreview: (changes: Record<string, number | null>) => void
  utcOffset: number
  encoded: boolean
  unit: string
}) {
  const { t } = useTranslation()
  const formId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [operation, setOperation] = useState<EditOperation>('constant')
  const [scope, setScope] = useState('selected')
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(end)
  const [value, setValue] = useState('')
  const [gapMinutes, setGapMinutes] = useState('60')
  const [includeFailedAnchors, setIncludeFailedAnchors] = useState(false)
  const [note, setNote] = useState('')
  const request: EditRequest = {
    operation,
    start: from ? Date.parse(`${from}Z`) : NaN,
    end: to ? Date.parse(`${to}Z`) : NaN,
    keys: scope === 'selected' ? selected : undefined,
    value: value.trim() ? Number(value) : undefined,
    maxGapMs: Number(gapMinutes) * 60000,
    includeFailedAnchors,
    note,
  }
  let plan: EditPlan | null = null
  let error = ''
  try {
    if (scope === 'selected' && !selected.length)
      throw new Error(t('qc.workflow.select_to_edit'))
    plan = planEdits(rows, drafts, request, checkCount, encoded)
  } catch (reason) {
    error = reason instanceof Error ? reason.message : t('qc.invalid_operation')
  }
  const previewSignature = JSON.stringify(open ? (plan?.changes ?? {}) : {})
  useEffect(() => {
    onPreview(JSON.parse(previewSignature))
  }, [onPreview, previewSignature])
  const changes = Object.entries(plan?.changes ?? {})
  const rowByKey = new Map(rows.map((row) => [row.key, row]))
  const linear = operation === 'fill-linear' || operation === 'interpolate'
  const control =
    'w-full rounded border border-default-300 bg-content1 px-3 py-2 text-sm disabled:opacity-50'
  return (
    <section className="space-y-3 rounded-lg border border-default-200 bg-default-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-medium">{t('qc.workflow.correction')}</h3>
          <span className="text-sm text-default-500">
            {selected.length} {t('qc.selected')}
          </span>
          {appliedCount !== null && (
            <p role="status" className="text-sm text-success">
              {t('qc.workflow.correction_applied', { count: appliedCount })}
            </p>
          )}
        </div>
        <Button
          ref={toggleRef}
          size="sm"
          variant="flat"
          aria-expanded={open}
          aria-controls={formId}
          isDisabled={!!lockedReason}
          onPress={() => {
            setOpen(!open)
            setAppliedCount(null)
          }}
        >
          {t(
            open
              ? 'qc.workflow.close_correction'
              : 'qc.workflow.open_correction'
          )}
        </Button>
      </div>
      {lockedReason && (
        <p role="status" className="text-sm text-warning-700">
          {lockedReason}
        </p>
      )}
      <div id={formId} hidden={!open} className="space-y-3">
        <fieldset
          disabled={!!lockedReason}
          className="grid gap-3 md:grid-cols-3"
        >
          <label className="block text-sm">
            {t('qc.workflow.apply_to')}
            <select
              className={control}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="selected">
                {t('qc.selected_rows')} ({selected.length})
              </option>
              <option value="interval">
                {t('qc.workflow.interval_scope')}
              </option>
            </select>
          </label>
          <label className="block text-sm">
            {t('qc.operation')}
            <select
              className={control}
              value={operation}
              onChange={(event) =>
                setOperation(event.target.value as EditOperation)
              }
            >
              {(
                [
                  'constant',
                  'offset',
                  'missing',
                  'fill-constant',
                  'fill-linear',
                  'interpolate',
                ] as EditOperation[]
              ).map((op) => (
                <option key={op} value={op}>
                  {t(`qc.operation_${op}`)}
                </option>
              ))}
            </select>
          </label>
          {['constant', 'fill-constant', 'offset'].includes(operation) && (
            <label className="block text-sm">
              {operation === 'offset'
                ? t('qc.workflow.offset')
                : t('qc.constant_value')}{' '}
              {unit && `(${unit})`}
              <input
                className={control}
                type="number"
                step="any"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          )}
          {(linear || operation === 'fill-constant') && (
            <label className="block text-sm">
              {t('qc.max_gap')}
              <input
                className={control}
                type="number"
                min="0"
                step="any"
                value={gapMinutes}
                onChange={(event) => setGapMinutes(event.target.value)}
              />
            </label>
          )}
          {scope === 'interval' && (
            <div className="grid gap-2 sm:grid-cols-2 md:col-span-3">
              {(
                [
                  ['from', from],
                  ['to', to],
                ] as const
              ).map(([edge, instant]) => (
                <label key={edge} className="text-sm">
                  {t(
                    edge === 'from'
                      ? 'qc.edit_from_offset'
                      : 'qc.edit_to_offset',
                    { offset: formatUtcOffset(utcOffset) }
                  )}
                  <input
                    className={control}
                    type="datetime-local"
                    step="0.001"
                    value={toOffsetInput(instant, utcOffset)}
                    onChange={(event) =>
                      (edge === 'from' ? setFrom : setTo)(
                        fromOffsetInput(event.target.value, utcOffset)
                      )
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {linear && (
            <details className="text-xs md:col-span-3">
              <summary className="cursor-pointer">
                {t('qc.workflow.interpolation_settings')}
              </summary>
              <p className="my-2 text-default-500">
                {t('qc.interpolation_hint')}
              </p>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={includeFailedAnchors}
                  onChange={(event) =>
                    setIncludeFailedAnchors(event.target.checked)
                  }
                />
                {t('qc.include_failed_anchors')}
              </label>
            </details>
          )}
          <label className="block text-sm md:col-span-3">
            {t('qc.workflow.correction_reason')}
            <textarea
              required
              maxLength={2000}
              rows={2}
              className={control}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </fieldset>
        <div aria-live="polite" className="text-sm">
          {error ? (
            <p className="text-default-500">{error}</p>
          ) : (
            <p>
              {t('qc.operation_preview', {
                targets: plan?.targets ?? 0,
                changes: changes.length,
                skipped: plan?.skipped ?? 0,
              })}
            </p>
          )}
        </div>
        {!!plan?.skippedRows.length && (
          <details className="text-xs">
            <summary className="cursor-pointer">
              {t('qc.workflow.skipped_details', { count: plan.skipped })}
            </summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-auto">
              {plan.skippedRows.slice(0, 10).map(({ key, reason, spanMs }) => (
                <li key={key}>
                  <time>
                    {formatObservationTime(rowByKey.get(key)!.time, utcOffset)}
                  </time>{' '}
                  ·{' '}
                  {t(`qc.workflow.skip_reasons.${reason}`, {
                    minutes: spanMs === undefined ? 0 : spanMs / 60000,
                    maxMinutes: Number(gapMinutes),
                  })}
                </li>
              ))}
            </ul>
            {plan.skippedRows.length > 10 && <p>{t('qc.skipped_first_ten')}</p>}
          </details>
        )}
        {!!changes.length && (
          <>
            <p className="rounded bg-warning-50 p-2 text-xs text-warning-700">
              {t(
                encoded ? 'qc.workflow.recheck_next' : 'qc.workflow.flag_next'
              )}
            </p>
            <div className="max-h-44 overflow-auto">
              <table
                className="w-full text-left text-xs"
                aria-label={t('qc.operation_preview_table')}
              >
                <thead>
                  <tr>
                    <th>UTC{formatUtcOffset(utcOffset)}</th>
                    <th>{t('qc.before')}</th>
                    <th>{t('qc.after')}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.slice(0, 10).map(([key, next]) => (
                    <tr key={key} className="border-t border-default-200">
                      <td className="py-1">
                        {formatObservationTime(
                          rowByKey.get(key)!.time,
                          utcOffset
                        )}
                      </td>
                      <td>
                        {rawText(rowValue(rowByKey.get(key)!, drafts).result)}
                      </td>
                      <td>{rawText(next)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {changes.length > 10 && <p>{t('qc.preview_first_ten')}</p>}
            </div>
          </>
        )}
        <Button
          color="primary"
          className="w-full sm:w-auto"
          isDisabled={
            !!lockedReason || !!error || !changes.length || !note.trim()
          }
          onPress={() => {
            if (onApply(request)) {
              setAppliedCount(changes.length)
              setOpen(false)
              toggleRef.current?.focus()
              setValue('')
              setNote('')
            }
          }}
        >
          {t('qc.apply_operation')}
        </Button>
        <p className="text-xs text-default-500">{t('qc.interval_hint')}</p>
      </div>
    </section>
  )
}
