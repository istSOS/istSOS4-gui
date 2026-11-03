'use client'

import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
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
  Constraint,
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
  range,
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
  /** The stored flagRange check, used as default drift bounds. */
  range?: Constraint
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
  const [driftModel, setDriftModel] = useState<'linear' | 'exponential'>(
    'linear'
  )
  const [windowMinutes, setWindowMinutes] = useState('60')
  // null follows the flagRange default until the user types a bound.
  const [minText, setMinText] = useState<string | null>(null)
  const [maxText, setMaxText] = useState<string | null>(null)
  const minValue = minText ?? String(range?.min ?? '')
  const maxValue = maxText ?? String(range?.max ?? '')
  const bound = (text: string) => (text.trim() ? Number(text) : undefined)
  const [includeFailedAnchors, setIncludeFailedAnchors] = useState(false)
  const [note, setNote] = useState('')
  const request: EditRequest = {
    operation,
    start: from ? Date.parse(`${from}Z`) : NaN,
    end: to ? Date.parse(`${to}Z`) : NaN,
    keys: scope === 'selected' ? selected : undefined,
    value: value.trim() ? Number(value) : undefined,
    maxGapMs: Number(gapMinutes) * 60000,
    driftModel,
    windowMs: Number(windowMinutes) * 60000,
    min: bound(minValue),
    max: bound(maxValue),
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
  const control =
    'w-full rounded border border-default-300 bg-content1 px-3 py-2 text-sm disabled:opacity-50'
  // With a selection the From/To fields are read-only and show its bounds.
  const selectedTs = selected.flatMap((key) => rowByKey.get(key)?.ts ?? [])
  const shownRange =
    scope === 'interval'
      ? [from, to]
      : selectedTs.length
        ? [Math.min(...selectedTs), Math.max(...selectedTs)].map((ts) =>
            new Date(ts).toISOString().slice(0, -1)
          )
        : ['', '']
  const unitSuffix = unit ? ` (${unit})` : ''
  const numberField = (
    key: string,
    label: string,
    text: string,
    setText: (text: string) => void,
    min?: string
  ) => (
    <Field key={key} label={label}>
      <input
        className={control}
        type="number"
        min={min}
        step="any"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </Field>
  )
  const valueField = numberField(
    'value',
    (operation === 'offset'
      ? t('qc.workflow.offset')
      : t('qc.constant_value')) + unitSuffix,
    value,
    setValue
  )
  const gapField = numberField(
    'gap',
    t('qc.max_gap'),
    gapMinutes,
    setGapMinutes,
    '0'
  )
  const anchorsField = (
    <Field
      key="anchors"
      label={t('qc.workflow.interpolation_settings')}
      title={t('qc.interpolation_hint')}
    >
      <span className="flex h-[38px] items-center gap-2">
        <input
          type="checkbox"
          checked={includeFailedAnchors}
          onChange={(event) => setIncludeFailedAnchors(event.target.checked)}
        />
        <span className="truncate" title={t('qc.include_failed_anchors')}>
          {t('qc.include_failed_anchors')}
        </span>
      </span>
    </Field>
  )
  const driftFields = [
    <Field key="curve" label={t('qc.drift_model')}>
      <select
        className={control}
        value={driftModel}
        onChange={(event) =>
          setDriftModel(event.target.value as 'linear' | 'exponential')
        }
      >
        <option value="linear">{t('qc.drift_linear')}</option>
        <option value="exponential">{t('qc.drift_exponential')}</option>
      </select>
    </Field>,
    numberField(
      'window',
      t('qc.drift_window'),
      windowMinutes,
      setWindowMinutes,
      '0'
    ),
    numberField('min', t('qc.drift_min') + unitSuffix, minValue, setMinText),
    numberField('max', t('qc.drift_max') + unitSuffix, maxValue, setMaxText),
  ]
  // Every operation fills the same four slots, so choosing one never changes
  // the height of the form.
  const parameters: ReactNode[] = {
    constant: [valueField],
    offset: [valueField],
    missing: [],
    'fill-constant': [valueField, gapField],
    'fill-linear': [gapField, anchorsField],
    interpolate: [gapField, anchorsField],
    'correct-drift': driftFields,
  }[operation]
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
          {lockedReason && (
            <p role="status" className="text-sm text-warning-700">
              {lockedReason}
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
      <div id={formId} hidden={!open} className="space-y-3">
        <fieldset
          disabled={!!lockedReason}
          className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 2xl:grid-cols-8"
        >
          <Field label={t('qc.workflow.apply_to')}>
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
          </Field>
          {(['from', 'to'] as const).map((edge, index) => (
            <Field
              key={edge}
              label={t(
                edge === 'from' ? 'qc.edit_from_offset' : 'qc.edit_to_offset',
                { offset: formatUtcOffset(utcOffset) }
              )}
            >
              <input
                className={control}
                type="datetime-local"
                step="0.001"
                disabled={scope !== 'interval'}
                value={toOffsetInput(shownRange[index], utcOffset)}
                onChange={(event) =>
                  (edge === 'from' ? setFrom : setTo)(
                    fromOffsetInput(event.target.value, utcOffset)
                  )
                }
              />
            </Field>
          ))}
          <Field label={t('qc.operation')}>
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
                  'correct-drift',
                ] as EditOperation[]
              ).map((op) => (
                <option key={op} value={op}>
                  {t(`qc.operation_${op}`)}
                </option>
              ))}
            </select>
          </Field>
          {[0, 1, 2, 3].map(
            (slot) =>
              parameters[slot] ?? (
                <div
                  key={`empty-${slot}`}
                  aria-hidden="true"
                  className="invisible text-sm"
                >
                  <span className="block">&nbsp;</span>
                  <div className={control}>&nbsp;</div>
                </div>
              )
          )}
          <label className="col-span-full block text-sm">
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
        <div aria-live="polite" className="min-h-5 text-sm">
          {error ? (
            <p className="truncate text-default-500" title={error}>
              {error}
            </p>
          ) : (
            <p className="truncate">
              {t('qc.operation_preview', {
                targets: plan?.targets ?? 0,
                changes: changes.length,
                skipped: plan?.skipped ?? 0,
              })}
            </p>
          )}
        </div>
        <details
          className={`text-xs ${plan?.skippedRows.length ? '' : 'invisible'}`}
        >
          <summary className="cursor-pointer">
            {t('qc.workflow.skipped_details', { count: plan?.skipped ?? 0 })}
          </summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-auto">
            {(plan?.skippedRows ?? [])
              .slice(0, 10)
              .map(({ key, reason, spanMs }) => (
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
          {(plan?.skippedRows.length ?? 0) > 10 && (
            <p>{t('qc.skipped_first_ten')}</p>
          )}
        </details>
        <p className="rounded bg-warning-50 p-2 text-xs text-warning-700">
          {t(encoded ? 'qc.workflow.recheck_next' : 'qc.workflow.flag_next')}
        </p>
        <div className="h-44 overflow-auto">
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
                    {formatObservationTime(rowByKey.get(key)!.time, utcOffset)}
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

// One-line label, so a long label never makes its row taller.
function Field({
  label,
  title,
  children,
}: {
  label: string
  title?: string
  children: ReactNode
}) {
  return (
    <label className="block min-w-0 text-sm">
      <span className="block truncate" title={title ?? label}>
        {label}
      </span>
      {children}
    </label>
  )
}
