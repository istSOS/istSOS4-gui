'use client'

import MapComponent from '@/features/map/components/LeafletMiniMap'
import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete'
import { Button } from '@heroui/button'
import { Input, Textarea } from '@heroui/input'
import { Tooltip } from '@heroui/tooltip'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DatastreamIcon,
  DefinitionIcon,
  DeleteIcon,
  DescriptionIcon,
  EncodingTypeIcon,
  KeyIcon,
  LocationIcon,
  MetadataIcon,
  NameIcon,
  ObservationTypeIcon,
  ObservedPropertyIcon,
  PlusIcon,
  SensorIcon,
  ThingIcon,
} from '@/components/icons'

import {
  type DatastreamFormData,
  type EntityKey,
  type ExistingOption,
  type FormDataMap,
  type KeyValueItem,
  type LocationFormData,
  type ObservedPropertyFormData,
  type SensorFormData,
  type ThingFormData,
  createEmptyKeyValue,
} from './types'

function FormIcon({
  icon: Icon,
  size = 18,
  tone = 'text-default-400',
}: {
  icon: ComponentType<any>
  size?: number
  tone?: string
}) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center ${tone}`}
    >
      <Icon size={size} />
    </span>
  )
}

function TextField({
  label,
  value,
  onValueChange,
  placeholder,
  icon,
  required = false,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  icon?: ReactNode
  required?: boolean
}) {
  return (
    <Input
      isClearable
      label={label}
      labelPlacement="inside"
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      variant="underlined"
      radius="sm"
      isRequired={required}
      startContent={icon}
      size="sm"
    />
  )
}

function TextAreaField({
  label,
  value,
  onValueChange,
  placeholder,
  icon,
  required = false,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  icon?: ReactNode
  required?: boolean
}) {
  return (
    <Textarea
      label={label}
      labelPlacement="inside"
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      variant="underlined"
      radius="sm"
      minRows={3}
      isRequired={required}
      startContent={icon}
      size="sm"
    />
  )
}

function KeyValueListField({
  label,
  items,
  onChange,
  keyLabel,
  valueLabel,
  addLabel,
  framed = true,
  showLabel = true,
  showAddButton = true,
  required = false,
}: {
  label: string
  items: KeyValueItem[]
  onChange: (items: KeyValueItem[]) => void
  keyLabel: string
  valueLabel: string
  addLabel?: string
  framed?: boolean
  showLabel?: boolean
  showAddButton?: boolean
  required?: boolean
}) {
  const { t } = useTranslation()
  const hasValidItems = items.some(
    (item) => item.key.trim().length > 0 && item.value.trim().length > 0
  )

  const updateItem = (
    index: number,
    field: keyof KeyValueItem,
    value: string
  ) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    )
  }

  const addItem = () => {
    onChange([...items, createEmptyKeyValue()])
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  const content = (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">
          {showLabel ? label : <span />}
        </div>
        {showAddButton ? (
          <Tooltip content={t('general.new')}>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={addItem}
              aria-label={addLabel ?? t('general.new')}
            >
              <PlusIcon size={16} />
            </Button>
          </Tooltip>
        ) : null}
      </div>
      {required ? (
        <input
          readOnly
          required
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={hasValidItems ? 'valid' : ''}
          onChange={() => {}}
        />
      ) : null}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <TextField
              label={keyLabel}
              value={item.key}
              onValueChange={(value) => updateItem(index, 'key', value)}
              icon={<FormIcon icon={KeyIcon} />}
            />
            <TextField
              label={valueLabel}
              value={item.value}
              onValueChange={(value) => updateItem(index, 'value', value)}
              icon={<FormIcon icon={NameIcon} />}
            />
            <div className="flex items-end">
              <Tooltip color="danger" content={t('general.delete')}>
                <Button
                  isIconOnly
                  variant="light"
                  color="danger"
                  onPress={() => removeItem(index)}
                  aria-label={t('general.delete')}
                >
                  <DeleteIcon size={16} />
                </Button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  return framed ? (
    <div className="rounded-2xl border border-default-200 p-4">{content}</div>
  ) : (
    <div>{content}</div>
  )
}

export function ExistingEntitySelect({
  entity,
  label,
  placeholder,
  value,
  options,
  onChange,
  emptyText,
  required = false,
}: {
  entity: EntityKey
  label: string
  placeholder: string
  value: string
  options: ExistingOption[]
  onChange: (value: string) => void
  emptyText: string
  required?: boolean
}) {
  const entityIcons: Record<EntityKey, ReactNode> = {
    thing: <FormIcon icon={ThingIcon} />,
    location: <FormIcon icon={LocationIcon} />,
    sensor: <FormIcon icon={SensorIcon} />,
    observedProperty: <FormIcon icon={ObservedPropertyIcon} />,
    datastream: <FormIcon icon={DatastreamIcon} />,
  }

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-default-300 p-4 text-sm text-default-500">
        {emptyText}
      </div>
    )
  }

  return (
    <Autocomplete
      label={label}
      labelPlacement="inside"
      placeholder={placeholder}
      variant="underlined"
      radius="sm"
      size="sm"
      isRequired={required}
      startContent={entityIcons[entity]}
      selectedKey={value || null}
      defaultItems={options}
      onSelectionChange={(key) => {
        onChange(key ? String(key) : '')
      }}
    >
      {(option) => (
        <AutocompleteItem key={option.value} textValue={option.label}>
          <div className="flex flex-col">
            <span>{option.label}</span>
            {option.description ? (
              <span className="line-clamp-1 text-xs text-default-500">
                {option.description}
              </span>
            ) : null}
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  )
}

export function EntityFields({
  entity,
  data,
  onChange,
  labels,
  existingOptions,
  showSingleAssociations = true,
}: {
  entity: EntityKey
  data: FormDataMap[EntityKey]
  onChange: (value: FormDataMap[EntityKey]) => void
  labels: Record<EntityKey, string>
  existingOptions?: Record<EntityKey, ExistingOption[]>
  showSingleAssociations?: boolean
}) {
  const { t } = useTranslation()
  const currentThing = entity === 'thing' ? (data as ThingFormData) : null
  const currentLocation =
    entity === 'location' ? (data as LocationFormData) : null
  const currentSensor = entity === 'sensor' ? (data as SensorFormData) : null
  const currentObservedProperty =
    entity === 'observedProperty' ? (data as ObservedPropertyFormData) : null
  const currentDatastream =
    entity === 'datastream' ? (data as DatastreamFormData) : null

  const updateField = (field: string, value: unknown) => {
    onChange({ ...data, [field]: value } as FormDataMap[EntityKey])
  }

  return (
    <div className="space-y-4">
      {entity === 'thing' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={t('things.name')}
              value={currentThing?.name ?? ''}
              onValueChange={(value) => updateField('name', value)}
              placeholder={t('things.name_placeholder')}
              icon={<FormIcon icon={NameIcon} />}
              required
            />
            {showSingleAssociations ? (
              <ExistingEntitySelect
                entity="location"
                label={t('things.location')}
                placeholder={t(
                  'things.location_placeholder',
                  'Select an existing Location'
                )}
                value={currentThing?.locationId ?? ''}
                options={existingOptions?.location ?? []}
                onChange={(value) => updateField('locationId', value)}
                emptyText={t(
                  'wizard.no_existing_entities',
                  'No entities are available yet for this type in the current dataset.'
                )}
              />
            ) : null}
          </div>
          <TextAreaField
            label={t('things.description')}
            value={currentThing?.description ?? ''}
            onValueChange={(value) => updateField('description', value)}
            placeholder={t('things.description_placeholder')}
            icon={<FormIcon icon={DescriptionIcon} />}
            required
          />
          <KeyValueListField
            label={t('things.properties')}
            items={currentThing?.properties ?? []}
            onChange={(items) => updateField('properties', items)}
            keyLabel={t('things.propertiesKey')}
            valueLabel={t('things.propertiesValue')}
            addLabel={t('wizard.add_json_entry', 'Add entry')}
          />
        </>
      ) : null}

      {entity === 'location' ? (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <TextField
              label={t('locations.name')}
              value={currentLocation?.name ?? ''}
              onValueChange={(value) => updateField('name', value)}
              placeholder={t('locations.name_placeholder')}
              icon={<FormIcon icon={NameIcon} />}
              required
            />
            <TextField
              label={t('locations.encoding_type')}
              value={currentLocation?.encodingType ?? ''}
              onValueChange={(value) => updateField('encodingType', value)}
              placeholder={t('locations.encoding_type_placeholder')}
              icon={<FormIcon icon={EncodingTypeIcon} />}
              required
            />
            <TextField
              label={t('locations.coordinates')}
              value={currentLocation?.location ?? ''}
              onValueChange={(value) => updateField('location', value)}
              placeholder={t('locations.coordinates_placeholder')}
              icon={<FormIcon icon={LocationIcon} />}
              required
            />
          </div>
          <TextAreaField
            label={t('locations.description')}
            value={currentLocation?.description ?? ''}
            onValueChange={(value) => updateField('description', value)}
            placeholder={t('locations.description_placeholder')}
            icon={<FormIcon icon={DescriptionIcon} />}
            required
          />
          <KeyValueListField
            label={t('locations.properties')}
            items={currentLocation?.properties ?? []}
            onChange={(items) => updateField('properties', items)}
            keyLabel={t('locations.propertiesKey')}
            valueLabel={t('locations.propertiesValue')}
            required
          />
          <div className="overflow-hidden rounded-2xl border border-default-200">
            <MapComponent
              coordinates={currentLocation?.location}
              onCenterChange={(coords) => {
                updateField(
                  'location',
                  `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                )
              }}
            />
          </div>
        </>
      ) : null}

      {entity === 'sensor' ? (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <TextField
              label={t('sensors.name')}
              value={currentSensor?.name ?? ''}
              onValueChange={(value) => updateField('name', value)}
              placeholder={t('sensors.name_placeholder')}
              icon={<FormIcon icon={NameIcon} />}
              required
            />
            <TextField
              label={t('sensors.encoding_type')}
              value={currentSensor?.encodingType ?? ''}
              onValueChange={(value) => updateField('encodingType', value)}
              placeholder={t('sensors.encoding_type_placeholder')}
              icon={<FormIcon icon={EncodingTypeIcon} />}
              required
            />
            <TextField
              label={t('sensors.metadata')}
              value={currentSensor?.metadata ?? ''}
              onValueChange={(value) => updateField('metadata', value)}
              placeholder={t('sensors.metadata_placeholder')}
              icon={<FormIcon icon={MetadataIcon} />}
              required
            />
          </div>
          <TextAreaField
            label={t('sensors.description')}
            value={currentSensor?.description ?? ''}
            onValueChange={(value) => updateField('description', value)}
            placeholder={t('sensors.description_placeholder')}
            icon={<FormIcon icon={DescriptionIcon} />}
            required
          />
          <KeyValueListField
            label={t('sensors.properties')}
            items={currentSensor?.properties ?? []}
            onChange={(items) => updateField('properties', items)}
            keyLabel={t('sensors.propertiesKey')}
            valueLabel={t('sensors.propertiesValue')}
          />
        </>
      ) : null}

      {entity === 'observedProperty' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={t('observedProperties.name')}
              value={currentObservedProperty?.name ?? ''}
              onValueChange={(value) => updateField('name', value)}
              placeholder={t('observedProperties.name_placeholder')}
              icon={<FormIcon icon={NameIcon} />}
              required
            />
            <TextField
              label={t('observedProperties.definition')}
              value={currentObservedProperty?.definition ?? ''}
              onValueChange={(value) => updateField('definition', value)}
              placeholder={t('observedProperties.definition_placeholder')}
              icon={<FormIcon icon={DefinitionIcon} />}
              required
            />
          </div>
          <TextAreaField
            label={t('observedProperties.description')}
            value={currentObservedProperty?.description ?? ''}
            onValueChange={(value) => updateField('description', value)}
            placeholder={t('observedProperties.description_placeholder')}
            icon={<FormIcon icon={DescriptionIcon} />}
            required
          />
          <KeyValueListField
            label={t('observedProperties.properties')}
            items={currentObservedProperty?.properties ?? []}
            onChange={(items) => updateField('properties', items)}
            keyLabel={t('observedProperties.propertiesKey')}
            valueLabel={t('observedProperties.propertiesValue')}
          />
        </>
      ) : null}

      {entity === 'datastream' ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={t('datastreams.name')}
              value={currentDatastream?.name ?? ''}
              onValueChange={(value) => updateField('name', value)}
              placeholder={t('datastreams.name_placeholder')}
              icon={<FormIcon icon={NameIcon} />}
              required
            />
            <TextField
              label={t('datastreams.observation_type')}
              value={currentDatastream?.observationType ?? ''}
              onValueChange={(value) => updateField('observationType', value)}
              placeholder={t('datastreams.observation_type_placeholder')}
              icon={<FormIcon icon={ObservationTypeIcon} />}
              required
            />
          </div>
          <TextAreaField
            label={t('datastreams.description')}
            value={currentDatastream?.description ?? ''}
            onValueChange={(value) => updateField('description', value)}
            placeholder={t('datastreams.description_placeholder')}
            icon={<FormIcon icon={DescriptionIcon} />}
            required
          />
          <div className="rounded-2xl border border-default-200 p-4">
            <div className="space-y-6">
              <KeyValueListField
                label={t('datastreams.unit_of_measurement')}
                items={currentDatastream?.unitOfMeasurement ?? []}
                onChange={(items) => updateField('unitOfMeasurement', items)}
                keyLabel={t('general.property_key')}
                valueLabel={t('general.property_value')}
                framed={false}
                required
              />
              <KeyValueListField
                label={t('datastreams.properties')}
                items={currentDatastream?.properties ?? []}
                onChange={(items) => updateField('properties', items)}
                keyLabel={t('datastreams.propertiesKey')}
                valueLabel={t('datastreams.propertiesValue')}
                framed={false}
              />
            </div>
          </div>
          {showSingleAssociations ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <ExistingEntitySelect
                entity="thing"
                label={t('datastreams.thing')}
                placeholder={t(
                  'datastreams.thing_placeholder',
                  'Select an existing Thing'
                )}
                value={currentDatastream?.thingId ?? ''}
                options={existingOptions?.thing ?? []}
                onChange={(value) => updateField('thingId', value)}
                required
                emptyText={t(
                  'wizard.no_existing_entities',
                  'No entities are available yet for this type in the current dataset.'
                )}
              />
              <ExistingEntitySelect
                entity="sensor"
                label={t('datastreams.sensor')}
                placeholder={t(
                  'datastreams.sensor_placeholder',
                  'Select an existing Sensor'
                )}
                value={currentDatastream?.sensorId ?? ''}
                options={existingOptions?.sensor ?? []}
                onChange={(value) => updateField('sensorId', value)}
                required
                emptyText={t(
                  'wizard.no_existing_entities',
                  'No entities are available yet for this type in the current dataset.'
                )}
              />
              <ExistingEntitySelect
                entity="observedProperty"
                label={t('datastreams.observed_property')}
                placeholder={t(
                  'datastreams.observed_property_placeholder',
                  'Select an existing Observed Property'
                )}
                value={currentDatastream?.observedPropertyId ?? ''}
                options={existingOptions?.observedProperty ?? []}
                onChange={(value) => updateField('observedPropertyId', value)}
                required
                emptyText={t(
                  'wizard.no_existing_entities',
                  'No entities are available yet for this type in the current dataset.'
                )}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
