'use client'

import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import AggregationDatastreamPicker from './AggregationDatastreamPicker'
import AggregationTargetEditor from './AggregationTargetEditor'

import {
  AggregationFormError,
  buildAggregationPayload,
  initialAggregationForm,
} from '../lib/form'
import type { AggregationFormValues } from '../lib/form'
import {
  AggregationTargetError,
  buildAggregationTarget,
  suggestAggregationTarget,
} from '../lib/target'
import type { AggregationTargetDraft } from '../lib/target'
import { aggregationFunctions, bucketIntervals } from '../lib/types'
import type {
  AggregationCreate,
  AggregationDatastream,
  AggregationTargetPayload,
  AggregationTargetTemplate,
} from '../lib/types'

export const aggregationControl =
  'w-full rounded-lg border border-default-300 bg-content1 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50'

export default function AggregationForm({
  streams,
  busy,
  onCreate,
  onCancel,
  sourceId,
  token,
}: {
  streams: AggregationDatastream[]
  busy: boolean
  onCreate: (
    payload: AggregationCreate,
    target?: AggregationTargetPayload
  ) => Promise<AggregationDatastream | undefined>
  onCancel: () => void
  sourceId: string
  token: string | null
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AggregationFormValues>(
    initialAggregationForm
  )
  const [error, setError] = useState<
    AggregationFormError | AggregationTargetError | null
  >(null)
  const [targetMode, setTargetMode] = useState('existing')
  const [targetTemplate, setTargetTemplate] =
    useState<AggregationTargetTemplate | null>(null)
  const [targetOverrides, setTargetOverrides] = useState<
    Partial<AggregationTargetDraft>
  >({})
  const [createdTarget, setCreatedTarget] =
    useState<AggregationDatastream | null>(null)
  const targetDraft = targetTemplate
    ? {
        ...suggestAggregationTarget(
          targetTemplate,
          form.bucketInterval,
          t('aggregations.target.suggestedDescription', {
            function: t(`aggregations.options.${form.aggregation}`),
            source: targetTemplate.source.name,
            interval: t(`aggregations.options.${form.bucketInterval}`),
          })
        ),
        ...targetOverrides,
      }
    : null
  const changeTarget = <K extends keyof AggregationTargetDraft>(
    field: K,
    value: AggregationTargetDraft[K]
  ) => {
    setTargetOverrides((previous) => ({
      ...previous,
      [field]: value,
      ...(['unitName', 'unitSymbol', 'unitDefinition'].includes(field)
        ? { unitsReviewed: false }
        : {}),
    }))
    setError(null)
  }
  const update = <K extends keyof AggregationFormValues>(
    field: K,
    value: AggregationFormValues[K]
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    if (field === 'sourceDatastream') {
      setTargetTemplate(null)
      setTargetOverrides({})
    } else if (
      ['aggregation', 'bucketInterval', 'conversionFactor'].includes(field)
    )
      setTargetOverrides((previous) => ({ ...previous, unitsReviewed: false }))
    setError(null)
  }
  const fieldLabel = (field: string) => t(`aggregations.fields.${field}`)
  const input = (
    field: keyof AggregationFormValues,
    options: {
      type?: 'text' | 'number'
      hint?: string
      placeholder?: string
      required?: boolean
    } = {}
  ) => (
    <Input
      key={field}
      label={fieldLabel(field)}
      labelPlacement="outside"
      variant="bordered"
      value={String(form[field])}
      type={options.type ?? 'text'}
      step={options.type === 'number' ? 'any' : undefined}
      placeholder={options.placeholder ?? ' '}
      description={
        options.hint ? t(`aggregations.hints.${options.hint}`) : undefined
      }
      isRequired={options.required}
      isDisabled={busy}
      isInvalid={error?.field === field}
      onValueChange={(value) => update(field, value)}
    />
  )
  const select = (
    field: keyof AggregationFormValues,
    values: string[],
    labels = false
  ) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span>{fieldLabel(field)}</span>
      <select
        className={aggregationControl}
        value={String(form[field])}
        disabled={busy}
        onChange={(event) => update(field, event.target.value)}
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {labels ? t(`aggregations.options.${value}`) : value}
          </option>
        ))}
      </select>
    </label>
  )
  const check = (
    field: 'systemTimeIncremental' | 'fixedSchedule' | 'enabled',
    hint?: string
  ) => (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1 accent-[var(--color-primary)]"
        checked={form[field]}
        disabled={busy}
        onChange={(event) => update(field, event.target.checked)}
      />
      <span>
        {fieldLabel(field)}
        {hint && (
          <span className="mt-1 block text-xs text-default-500">
            {t(`aggregations.hints.${hint}`)}
          </span>
        )}
      </span>
    </label>
  )
  const datastream = (field: 'sourceDatastream' | 'targetDatastream') => (
    <AggregationDatastreamPicker
      label={fieldLabel(field)}
      streams={streams}
      value={form[field]}
      onChange={(id) => update(field, id)}
      busy={busy}
      invalid={error?.field === field}
      description={
        field === 'targetDatastream'
          ? t('aggregations.hints.existingTarget')
          : undefined
      }
    />
  )

  return (
    <form
      className="space-y-6 rounded-xl border border-default-200 bg-content1 p-5 shadow-sm sm:p-6"
      aria-label={t('aggregations.newJob')}
      onSubmit={async (event) => {
        event.preventDefault()
        if (busy) return
        let payload: AggregationCreate
        let target: AggregationTargetPayload | undefined
        try {
          if (targetMode === 'create') {
            if (!targetTemplate || !targetDraft) return
            target = buildAggregationTarget(targetDraft, targetTemplate)
            if (streams.some((stream) => stream.name === target.name))
              throw new AggregationFormError('targetExists', 'targetDatastream')
          }
          payload = buildAggregationPayload(form, streams, target?.name)
        } catch (problem) {
          if (
            problem instanceof AggregationFormError ||
            problem instanceof AggregationTargetError
          )
            setError(problem)
          return
        }
        const confirmed = await onCreate(payload, target)
        if (confirmed) {
          // The target exists even if job scheduling failed. Retry the job
          // against this identity rather than creating the target again.
          setCreatedTarget(confirmed)
          setTargetMode('existing')
          update('targetDatastream', confirmed.id)
        }
      }}
    >
      <div>
        <h2 className="text-xl font-semibold">{t('aggregations.newJob')}</h2>
        <p className="mt-1 text-sm text-default-500">
          {t('aggregations.createHint')}
        </p>
      </div>
      <fieldset className="space-y-5" disabled={busy}>
        <legend className="mb-3 font-semibold">
          {t('aggregations.calculation')}
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {datastream('sourceDatastream')}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm">
              {fieldLabel('targetDatastream')}
            </legend>
            {['existing', 'create'].map((mode) => (
              <label
                key={mode}
                className="mr-4 inline-flex items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="aggregation-target-mode"
                  value={mode}
                  checked={targetMode === mode}
                  disabled={busy}
                  onChange={() => {
                    setTargetMode(mode)
                    setError(null)
                  }}
                />
                {t(`aggregations.target.modes.${mode}`)}
              </label>
            ))}
          </fieldset>
        </div>
        {targetMode === 'existing' && datastream('targetDatastream')}
        <div className="grid gap-5 sm:grid-cols-3">
          {select('aggregation', [...aggregationFunctions], true)}
          {select('bucketInterval', [...bucketIntervals], true)}
          {input('bucketTimezone', { required: true, hint: 'timezone' })}
        </div>
      </fieldset>
      {createdTarget && (
        <p
          role="status"
          className="rounded-lg bg-success-50 p-3 text-sm text-success-700"
        >
          {t('aggregations.target.created', { name: createdTarget.name })}
        </p>
      )}
      {targetMode === 'create' && (
        <AggregationTargetEditor
          key={form.sourceDatastream}
          sourceId={sourceId}
          datastreamId={form.sourceDatastream}
          token={token}
          template={targetTemplate}
          draft={targetDraft}
          onTemplate={setTargetTemplate}
          onChange={changeTarget}
          busy={busy}
          errorField={error?.field}
        />
      )}
      <fieldset
        className="space-y-4 rounded-lg bg-default-50 p-4"
        disabled={busy}
      >
        <legend className="px-1 font-semibold">
          {t('aggregations.completeness')}
        </legend>
        <p className="text-sm text-default-600">
          {t('aggregations.hints.completeness')}
        </p>
        <div className="grid gap-5 sm:grid-cols-3">
          {input('minObservations', { type: 'number', hint: 'optionalCount' })}
          {input('expectedObservationInterval', {
            placeholder: '1 minute',
            hint: 'cadence',
          })}
          {input('maxConsecutiveMissing', {
            type: 'number',
            hint: 'missingCount',
          })}
        </div>
        {(form.minObservations.trim() || form.maxConsecutiveMissing.trim()) && (
          <p className="text-sm text-primary" aria-live="polite">
            {form.minObservations.trim() &&
              t('aggregations.minimumSummary', {
                count: Number(form.minObservations),
              })}{' '}
            {form.maxConsecutiveMissing.trim() &&
              t('aggregations.missingSummary', {
                count: Number(form.maxConsecutiveMissing),
                interval: form.expectedObservationInterval || '…',
              })}
          </p>
        )}
      </fieldset>
      <details className="rounded-lg border border-default-200 p-4">
        <summary className="cursor-pointer font-semibold">
          {t('aggregations.advanced')}
        </summary>
        <div className="mt-5 space-y-6">
          <fieldset className="space-y-4" disabled={busy}>
            <legend className="mb-3 font-medium">
              {t('aggregations.processing')}
            </legend>
            <div className="grid gap-5 sm:grid-cols-3">
              {input('conversionFactor', {
                type: 'number',
                required: true,
                hint: 'conversion',
              })}
              {select('boundaryMode', ['right_closed', 'left_closed'], true)}
              {input('bucketsToRecompute', { type: 'number', required: true })}
            </div>
            {check('systemTimeIncremental', 'incremental')}
            {input('systemTimeOverlap', { required: true })}
          </fieldset>
          <fieldset
            className="space-y-4 border-t border-default-200 pt-4"
            disabled={busy}
          >
            <legend className="mb-3 font-medium">
              {t('aggregations.qualityFilters')}
            </legend>
            <p className="text-xs text-default-500">
              {t('aggregations.hints.quality')}
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {input('resultQualityKey', {
                placeholder: 'code',
                hint: 'qualityKey',
              })}
              {input('resultQualityAllowed', {
                placeholder: '100, 200, 255',
                hint: 'qualityAllowed',
              })}
              {input('resultQualityMin', { type: 'number' })}
              {input('resultQualityMax', { type: 'number' })}
            </div>
          </fieldset>
          <fieldset
            className="space-y-4 border-t border-default-200 pt-4"
            disabled={busy}
          >
            <legend className="mb-3 font-medium">
              {t('aggregations.availability')}
            </legend>
            <p className="text-xs text-default-500">
              {t('aggregations.hints.availability')}
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span>{fieldLabel('availabilityDatastreams')}</span>
                <select
                  multiple
                  size={4}
                  className={aggregationControl}
                  value={form.availabilityDatastreams}
                  disabled={busy}
                  onChange={(event) =>
                    update(
                      'availabilityDatastreams',
                      Array.from(
                        event.target.selectedOptions,
                        (option) => option.value
                      )
                    )
                  }
                >
                  {streams.map((stream) => (
                    <option key={stream.id} value={stream.id}>
                      {stream.thing ? `${stream.thing} / ` : ''}
                      {stream.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="light"
                  className="self-start"
                  isDisabled={busy || !form.availabilityDatastreams.length}
                  onPress={() => update('availabilityDatastreams', [])}
                >
                  {t('aggregations.clearAvailability')}
                </Button>
              </label>
              <div className="space-y-5">
                {input('availabilityMaxAge', { placeholder: '5 minutes' })}
                {select(
                  'emptyBucketPolicy',
                  ['missing', 'zero_when_available'],
                  true
                )}
                {input('emptyBucketResultQuality', {
                  type: 'number',
                  required: true,
                })}
              </div>
            </div>
          </fieldset>
          <fieldset
            className="space-y-4 border-t border-default-200 pt-4"
            disabled={busy}
          >
            <legend className="mb-3 font-medium">
              {t('aggregations.scheduling')}
            </legend>
            <div className="grid gap-5 sm:grid-cols-3">
              {input('scheduleInterval', { hint: 'scheduleInterval' })}
              {input('scheduleDelay', { required: true })}
              {input('scheduleTimezone', { hint: 'scheduleTimezone' })}
            </div>
            {check('fixedSchedule', 'fixedSchedule')}
          </fieldset>
        </div>
      </details>
      {check('enabled', 'enabled')}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error instanceof AggregationTargetError
            ? t(
                error.field === 'unitsReviewed'
                  ? 'aggregations.target.reviewRequired'
                  : 'aggregations.target.required',
                { field: t(`aggregations.target.fields.${error.field}`) }
              )
            : t(`aggregations.validation.${error.code}`, {
                field: fieldLabel(error.field),
              })}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-default-200 pt-4">
        <Button variant="light" onPress={onCancel} isDisabled={busy}>
          {t('general.cancel')}
        </Button>
        <Button
          type="submit"
          color="primary"
          isLoading={busy}
          isDisabled={
            !streams.length || (targetMode === 'create' && !targetTemplate)
          }
        >
          {t(
            targetMode === 'create'
              ? 'aggregations.target.createAndSchedule'
              : 'aggregations.create'
          )}
        </Button>
      </div>
    </form>
  )
}
