'use client'

import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete'
import { Button } from '@heroui/button'
import { Input, Textarea } from '@heroui/input'
import { Spinner } from '@heroui/spinner'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { aggregationRequest } from '../lib/client'
import type { AggregationRequestError } from '../lib/client'
import type { AggregationTargetDraft } from '../lib/target'
import type {
  AggregationEntityOption,
  AggregationTargetTemplate,
} from '../lib/types'

export default function AggregationTargetEditor({
  sourceId,
  datastreamId,
  token,
  template,
  draft,
  busy,
  errorField,
  onTemplate,
  onChange,
}: {
  sourceId: string
  datastreamId: string
  token: string | null
  template: AggregationTargetTemplate | null
  draft: AggregationTargetDraft | null
  busy: boolean
  errorField?: string
  onTemplate: (template: AggregationTargetTemplate) => void
  onChange: <K extends keyof AggregationTargetDraft>(
    field: K,
    value: AggregationTargetDraft[K]
  ) => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState<AggregationRequestError | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!datastreamId || template?.source.id === datastreamId) return
    const controller = new AbortController()
    setError(null)
    aggregationRequest(sourceId, token, {
      resource: 'target',
      datastreamId,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) onTemplate(data.template)
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setError(problem)
      })
    return () => controller.abort()
  }, [sourceId, datastreamId, token, template, retry, onTemplate])

  const entity = (
    field: 'thingId' | 'sensorId' | 'observedPropertyId' | 'networkId',
    options: AggregationEntityOption[]
  ) => (
    <Autocomplete
      label={t(`aggregations.target.fields.${field}`)}
      labelPlacement="outside"
      variant="bordered"
      placeholder={t('aggregations.target.chooseEntity')}
      defaultItems={options}
      selectedKey={draft[field] || null}
      onSelectionChange={(key) =>
        onChange(field, key == null ? '' : String(key))
      }
      isDisabled={busy}
      isRequired
      isInvalid={errorField === field}
      description={
        field === 'sensorId' ? t('aggregations.target.sensorHint') : undefined
      }
    >
      {(option) => (
        <AutocompleteItem key={option.id} textValue={option.name}>
          <span className="block">{option.name}</span>
          {option.description && (
            <span className="block text-xs text-default-500">
              {option.description}
            </span>
          )}
        </AutocompleteItem>
      )}
    </Autocomplete>
  )
  const input = (
    field: 'name' | 'unitName' | 'unitSymbol' | 'unitDefinition'
  ) => (
    <Input
      label={t(`aggregations.target.fields.${field}`)}
      labelPlacement="outside"
      variant="bordered"
      placeholder=" "
      value={draft[field]}
      onValueChange={(value) => onChange(field, value)}
      isDisabled={busy}
      isRequired={field === 'name'}
      isInvalid={errorField === field}
    />
  )
  return (
    <fieldset
      className="space-y-5 rounded-lg border border-primary/30 bg-primary/5 p-4"
      disabled={busy}
    >
      <legend className="px-1 font-semibold">
        {t('aggregations.target.title')}
      </legend>
      <p className="text-sm text-default-600">
        {t('aggregations.target.templateHint')}
      </p>
      {!datastreamId ? (
        <p className="text-sm">{t('aggregations.target.chooseSource')}</p>
      ) : error ? (
        <div role="alert" className="space-y-2 text-sm text-danger">
          <p>{t(`aggregations.errors.${error.code ?? 'request'}`)}</p>
          <Button size="sm" onPress={() => setRetry((value) => value + 1)}>
            {t('aggregations.retry')}
          </Button>
        </div>
      ) : !template || !draft ? (
        <Spinner size="sm" label={t('aggregations.target.loading')} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {input('name')}
            {entity('sensorId', template.sensors)}
            {entity('thingId', template.things)}
            {entity('observedPropertyId', template.observedProperties)}
            {template.networkEnabled && entity('networkId', template.networks)}
          </div>
          <Textarea
            label={t('aggregations.target.fields.description')}
            labelPlacement="outside"
            variant="bordered"
            placeholder=" "
            value={draft.description}
            onValueChange={(value) => onChange('description', value)}
            isRequired
            isDisabled={busy}
            isInvalid={errorField === 'description'}
          />
          <div className="grid gap-5 sm:grid-cols-3">
            {input('unitName')}
            {input('unitSymbol')}
            {input('unitDefinition')}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.unitsReviewed}
              disabled={busy}
              className="mt-1 accent-[var(--color-primary)]"
              onChange={(event) =>
                onChange('unitsReviewed', event.target.checked)
              }
            />
            <span>
              {t('aggregations.target.fields.unitsReviewed')}
              <span className="mt-1 block text-xs text-default-500">
                {t('aggregations.target.unitsHint')}
              </span>
            </span>
          </label>
        </>
      )}
    </fieldset>
  )
}
