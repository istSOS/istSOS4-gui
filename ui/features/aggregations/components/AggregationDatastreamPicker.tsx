'use client'

import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { AggregationDatastream } from '../lib/types'

const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()

export default function AggregationDatastreamPicker({
  streams,
  value,
  label,
  description,
  busy,
  invalid,
  onChange,
}: {
  streams: AggregationDatastream[]
  value: string
  label: string
  description?: string
  busy: boolean
  invalid: boolean
  onChange: (id: string) => void
}) {
  const { t } = useTranslation()
  const sorted = useMemo(() => {
    const compare = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    }).compare
    return [...streams].sort(
      (a, b) =>
        compare(a.thing, b.thing) ||
        compare(a.name, b.name) ||
        compare(a.id, b.id)
    )
  }, [streams])

  return (
    <Autocomplete
      label={label}
      labelPlacement="outside"
      variant="bordered"
      placeholder={t('aggregations.chooseDatastream')}
      defaultItems={sorted}
      selectedKey={value || null}
      onSelectionChange={(key) => onChange(key == null ? '' : String(key))}
      defaultFilter={(text, query) => {
        const haystack = searchText(text)
        return searchText(query)
          .trim()
          .split(/\s+/)
          .every((word) => haystack.includes(word))
      }}
      isDisabled={busy}
      isRequired
      isInvalid={invalid}
      description={description}
      // Both virtualized and short lists use the same two-line row geometry.
      // HeroUI otherwise allocates 32px per item once the list exceeds 50 rows.
      itemHeight={56}
      maxListboxHeight={336}
      listboxProps={{ emptyContent: t('aggregations.noMatchingDatastreams') }}
    >
      {(stream) => (
        <AutocompleteItem
          key={stream.id}
          textValue={`${stream.thing ? `${stream.thing} / ` : ''}${stream.name}${stream.unit ? ` (${stream.unit})` : ''}`}
          description={stream.thing || t('aggregations.stationNotProvided')}
          endContent={
            stream.unit ? (
              <span
                className="max-w-20 shrink-0 truncate rounded bg-default-100 px-2 py-0.5 text-xs text-default-600"
                title={stream.unit}
              >
                {stream.unit}
              </span>
            ) : undefined
          }
          classNames={{
            base: 'h-14 min-h-14 gap-3 px-3 py-2',
            wrapper: 'min-w-0',
            title: 'truncate text-sm font-medium leading-5',
            description: 'truncate text-xs leading-4 text-default-500',
          }}
        >
          <span
            title={`${stream.name}${stream.thing ? ` — ${stream.thing}` : ''} (#${stream.id})`}
          >
            {stream.name}
          </span>
        </AutocompleteItem>
      )}
    </Autocomplete>
  )
}
