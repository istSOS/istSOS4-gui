'use client'

import { QUALITY_STATUS_COLORS } from '@/features/observations/lib/resultQuality'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  VERDICT_COLORS,
  binaryMask,
  dataStatus,
  fitsMask,
  humanStatus,
  oasiQuality,
  parseMask,
  rawText,
  slotState,
} from '../lib/bitmask'
import { changed } from '../lib/model'
import { explainCheck } from '../lib/qualityExplanation'
import { qualityFlagDescription } from '../lib/qualityFlags'
import type { Constraint, Draft, QcRow } from '../lib/types'

const statusColors: Record<string, string> = {
  passed: QUALITY_STATUS_COLORS.passed,
  failed: QUALITY_STATUS_COLORS.failed,
  raw: QUALITY_STATUS_COLORS.raw,
  filled: QUALITY_STATUS_COLORS.filled,
  digital: QUALITY_STATUS_COLORS.digital,
  missing: QUALITY_STATUS_COLORS.no_data,
  stale: VERDICT_COLORS.stale,
  unknown: VERDICT_COLORS.unknown,
  accepted: VERDICT_COLORS.accepted,
  rejected: VERDICT_COLORS.rejected,
}

function Status({ status, children }: { status: string; children: ReactNode }) {
  return (
    <span
      className="font-medium text-default-500"
      style={{ color: statusColors[status] }}
    >
      {children}
    </span>
  )
}

export function CheckDefinition({
  constraint,
  unit = '',
}: {
  constraint: Constraint
  unit?: string
}) {
  const { t } = useTranslation()
  function value(key: string, raw: unknown) {
    if (typeof raw === 'boolean')
      return t(raw ? 'qc.explain.yes' : 'qc.explain.no')
    const duration =
      key === 'window' && String(raw).match(/^\s*(\d+)\s*(s|min|h|d)\s*$/i)
    if (duration)
      return t(`qc.explain.durations.${duration[2].toLowerCase()}`, {
        count: Number(duration[1]),
      })
    if (key === 'column' && raw === 'result')
      return t('qc.explain.observed_value')
    const withUnit =
      unit &&
      (['min', 'max'].includes(key) ||
        (key === 'thresh' &&
          ['flagConstants', 'flagJumps'].includes(constraint.type)))
    const display = typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
    return withUnit ? `${display} ${unit}` : display
  }
  return (
    <div className="space-y-2">
      <p>
        {t(`qc.explain.tests.${constraint.type}`, {
          defaultValue: t('qc.explain.unknown_test'),
        })}
      </p>
      <p className="text-xs font-medium text-default-600">
        {t('qc.explain.stored_parameters')}
      </p>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
        {Object.entries(constraint)
          .filter(([key]) => key !== 'type')
          .map(([key, raw]) => (
            <div key={key} className="contents">
              <dt className="text-default-500">
                {t(`qc.explain.parameters.${key}`, { defaultValue: key })}
              </dt>
              <dd className="max-w-48 whitespace-normal break-words text-right">
                {value(key, raw)}
              </dd>
            </div>
          ))}
      </dl>
      <p className="text-xs text-default-500">
        {t('qc.explain.definition_hint')}
      </p>
    </div>
  )
}

function Reason({
  reason,
  pending = false,
}: {
  reason: string | null
  pending?: boolean
}) {
  const { t } = useTranslation()
  const standard: Record<string, string> = {
    'Insufficient history': 'history',
    'No data': 'no_data',
    Passed: 'passed',
    Failed: 'failed',
    'Manual review': 'manual',
    'SaQC could not evaluate this buffer': 'buffer',
  }
  const text = pending
    ? t('qc.explain.reason_pending')
    : reason
      ? standard[reason]
        ? t(`qc.explain.reasons.${standard[reason]}`)
        : reason
      : t('qc.explain.reason_unavailable')
  const status = pending
    ? 'stale'
    : reason === 'Passed'
      ? 'passed'
      : reason === 'Failed'
        ? 'failed'
        : null
  return (
    <p className="whitespace-normal text-xs text-default-600">
      <span className="font-medium">{t('qc.explain.reason')}: </span>
      {status ? <Status status={status}>{text}</Status> : text}
    </p>
  )
}

export function CheckDetails({
  row,
  draft,
  constraints,
  slot,
  encoded,
  unit,
}: {
  row: QcRow
  draft?: Draft
  constraints: Constraint[]
  slot: number
  encoded: boolean
  unit?: string
}) {
  const { t } = useTranslation()
  const info = explainCheck(row, draft, constraints, slot, encoded)
  return (
    <div className="space-y-3">
      <p>
        <Status status={info.status}>
          {t(
            info.status === 'stale'
              ? 'qc.needs_check'
              : info.status === 'unknown'
                ? 'qc.verdict.unknown'
                : `qc.${info.status}`
          )}
        </Status>
      </p>
      <p className="text-xs">
        {t('qc.explain.source')}: {t(`qc.explain.sources.${info.source}`)}
      </p>
      <Reason reason={info.reason} pending={info.status === 'stale'} />
      {constraints[slot - 1] && (
        <CheckDefinition constraint={constraints[slot - 1]} unit={unit} />
      )}
    </div>
  )
}

export function QualityDetails({
  row,
  draft,
  constraints,
  encoded,
  serviceMode,
  unit,
}: {
  row: QcRow
  draft?: Draft
  constraints: Constraint[]
  encoded: boolean
  serviceMode: boolean
  unit?: string
}) {
  const { t } = useTranslation()
  const quality = draft ? draft.resultQuality : row.resultQuality
  const modified = draft && (changed(row, draft) || !!draft.outcomes?.length)
  const source = modified ? 'draft' : 'recorded'
  const mask = parseMask(quality)
  const fits = encoded && fitsMask(quality, constraints.length)
  const description = serviceMode ? qualityFlagDescription(quality) : ''
  return (
    <div className="space-y-3">
      <p className="text-xs">
        {t('qc.explain.source')}: {t(`qc.explain.sources.${source}`)}
      </p>
      {serviceMode ? (
        <>
          {description ? (
            <>
              <p className="font-medium">
                {t(`qc.workflow.flags.${String(quality)}`, {
                  defaultValue: description,
                })}
              </p>
              <p className="text-xs text-default-600">{description}</p>
            </>
          ) : (
            <p>
              {t(
                quality == null
                  ? 'qc.explain.no_quality'
                  : 'qc.workflow.unknown_code'
              )}
            </p>
          )}
          {draft?.qualityPending && (
            <p className="text-warning-700">
              {t('qc.explain.service_pending')}
            </p>
          )}
          <p className="text-xs text-default-500">
            {t('qc.explain.catalog_hint')}
          </p>
        </>
      ) : !encoded ? (
        <p>{t('qc.workflow.confirm_first')}</p>
      ) : !fits || mask === null ? (
        <p>
          {t(
            quality == null
              ? 'qc.explain.no_quality'
              : 'qc.explain.invalid_mask'
          )}
        </p>
      ) : (
        <>
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt>{t('qc.data_state_label')}</dt>
              <dd className="font-medium">
                <Status status={dataStatus(mask)}>
                  {t(`qc.data_state.${dataStatus(mask)}`)}
                </Status>
              </dd>
            </div>
            {constraints.map((constraint, index) => {
              const info = explainCheck(
                row,
                draft,
                constraints,
                index + 1,
                true
              )
              return (
                <div key={index} className="border-t border-default-100 pt-2">
                  <div className="flex justify-between gap-3">
                    <dt>
                      {t(`qc.workflow.tests.${constraint.type}`, {
                        defaultValue: constraint.type,
                      })}
                    </dt>
                    <dd className="font-medium">
                      <Status status={info.status}>
                        {t(
                          info.status === 'stale'
                            ? 'qc.needs_check'
                            : info.status === 'unknown'
                              ? 'qc.verdict.unknown'
                              : `qc.${info.status}`
                        )}
                      </Status>
                    </dd>
                  </div>
                  <p className="mt-1 text-xs text-default-500">
                    {t(`qc.explain.sources.${info.source}`)}
                  </p>
                  {(info.reason || info.status === 'stale') && (
                    <Reason
                      reason={info.reason}
                      pending={info.status === 'stale'}
                    />
                  )}
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-primary">
                      {t('qc.explain.check_details')}
                    </summary>
                    <div className="mt-3">
                      <CheckDetails
                        row={row}
                        draft={draft}
                        constraints={constraints}
                        slot={index + 1}
                        encoded={encoded}
                        unit={unit}
                      />
                    </div>
                  </details>
                </div>
              )
            })}
            <div className="flex justify-between gap-3 border-t border-default-100 pt-2">
              <dt>{t('qc.human_review')}</dt>
              <dd className="font-medium">
                <Status
                  status={humanStatus(slotState(mask, constraints.length + 1))}
                >
                  {t(
                    `qc.${humanStatus(slotState(mask, constraints.length + 1))}`
                  )}
                </Status>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-default-500">
            {t('qc.explain.recorded_hint')}
          </p>
        </>
      )}
      <details className="border-t border-default-200 pt-2 text-xs">
        <summary className="cursor-pointer">
          {t('qc.explain.technical')}
        </summary>
        <p className="mt-2 break-all">
          {t('qc.explain.raw_value')}: <code>{rawText(quality)}</code>
        </p>
        {fits && (
          <>
            <p className="mt-1">
              {t('qc.binary')}:{' '}
              <code>{binaryMask(quality, constraints.length)}</code>
            </p>
            <p className="mt-1 text-default-500">
              {t('qc.explain.pair_order')}
            </p>
            {oasiQuality(quality, constraints.length) !== null && (
              <p className="mt-1">
                OASI: {oasiQuality(quality, constraints.length)}
              </p>
            )}
          </>
        )}
      </details>
    </div>
  )
}
