'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Button } from '@heroui/button'
import { Divider } from '@heroui/divider'
import { Input, Textarea } from '@heroui/input'
import { Select, SelectItem } from '@heroui/select'
import { Switch } from '@heroui/switch'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { useSearchParams } from 'next/navigation'

import { useEntities } from '@/context/EntitiesContext'

import {
  buildDatastreamFields,
  observationTypeOptions,
  unitOfMeasurementOptions,
} from './utils'

import ObservedPropertyCreator from '../observed-properties/ObservedPropertyCreator'
import SensorCreator from '../sensors/SensorCreator'
import ThingCreator from '../things/ThingCreator'

interface Option {
  name?: string
  label?: string
  value?: any
  symbol?: string
  definition?: string
}

interface DatastreamCreatorProps {
  thingOptions: Option[]
  sensorOptions: Option[]
  observedPropertyOptions: Option[]
  locationOptions: Option[]
  onCreate: (payload: any) => Promise<void>
  onCancel: () => void
  isLoading: boolean
  error: string | null
  // If true, hides the Thing section and builds a Datastream object for deep insert inside a Thing
  disableThing?: boolean
  disableSensor?: boolean
  disableObservedProperty?: boolean
  // Optional title override
  title?: string
}

/**
 * DatastreamCreator
 * Full mode: allows creating/selecting Thing, Sensor, ObservedProperty and building Datastream payload.
 * Embedded (disableThing=true): used inside ThingCreator to deep insert a Datastream without choosing/creating a Thing here.
 */
const DatastreamCreator: React.FC<DatastreamCreatorProps> = ({
  locationOptions,
  onCreate,
  onCancel,
  isLoading,
  error,
  disableThing = false,
  title,
}) => {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const selectedNetwork = searchParams.get('network')
  const networkIdParam = searchParams.get('id')

  const {
    entities,
    loading: entitiesLoading,
    error: entitiesError,
    refetchAll,
  } = useEntities()

  const thingOptions = (entities?.things || []).map((thing) => {
    const id = thing['@iot.id']
    return {
      label: `${thing.name || `Thing ${id}`}`,
      value: id,
    }
  })
  const sensorOptions = (entities?.sensors || []).map((sensor) => {
    const id = sensor['@iot.id']
    return {
      label: `${sensor.name || `Sensor ${id}`}`,
      value: id,
    }
  })
  const observedPropertyOptions = (entities?.observedProperties || []).map(
    (op) => {
      const id = op['@iot.id']
      return {
        label: `${op.name || `Observed Property ${id}`}`,
        value: id,
      }
    }
  )

  // Build field configs
  const datastreamFields = React.useMemo(
    () =>
      buildDatastreamFields({
        t,
        thingOptions,
        sensorOptions,
        observedPropertyOptions,
      }),
    [t, thingOptions, sensorOptions, observedPropertyOptions]
  )

  const labelFor = (name: string) =>
    datastreamFields.find((f) => f.name === name)?.label || name

  const getFirstKey = (keys: any) => {
    if (!keys) return ''
    if (typeof keys === 'string') return keys
    return Array.from(keys)[0] || ''
  }

  const [ds, setDs] = React.useState(() => {
    const init: any = {
      name: '',
      description: '',
      observationType: '',
      unitOfMeasurement: '',
      network: selectedNetwork || 'acsot',
      properties: [] as Array<{ key: string; value: string }>,
    }
    datastreamFields.forEach((f) => {
      if (
        [
          'name',
          'description',
          'observationType',
          'unitOfMeasurement',
        ].includes(f.name)
      ) {
        if (f.defaultValue !== undefined) init[f.name] = f.defaultValue
      }
    })
    return init
  })

  // State for Thing (unused in embedded mode)
  const [useExistingThing, setUseExistingThing] = React.useState(true)
  const [thingId, setThingId] = React.useState('')
  const [newThing, setNewThing] = React.useState<any | null>(null)

  // State for Sensor
  const [useExistingSensor, setUseExistingSensor] = React.useState(true)
  const [sensorId, setSensorId] = React.useState('')
  const [newSensor, setNewSensor] = React.useState<any | null>(null)

  // State for ObservedProperty
  const [useExistingObservedProperty, setUseExistingObservedProperty] =
    React.useState(true)
  const [observedPropertyId, setObservedPropertyId] = React.useState('')
  const [newObservedProperty, setNewObservedProperty] = React.useState<
    any | null
  >(null)

  // Local errors
  const [localError, setLocalError] = React.useState<string | null>(null)

  // JSON Editor State
  const [showJsonEditor, setShowJsonEditor] = React.useState(false)
  const [jsonContent, setJsonContent] = React.useState<string>('')

  const updateDs = (k: string, v: any) => setDs((p) => ({ ...p, [k]: v }))

  const addDsProperty = () =>
    updateDs('properties', [...ds.properties, { key: '', value: '' }])

  const removeDsProperty = (i: number) =>
    updateDs(
      'properties',
      ds.properties.filter((_, idx) => idx !== i)
    )

  const buildPropertiesObject = (arr: Array<{ key: string; value: string }>) =>
    Object.fromEntries(arr.filter((p) => p.key).map((p) => [p.key, p.value]))

  const validate = () => {
    // Basic required fields
    if (!ds.name || !ds.observationType || !ds.unitOfMeasurement) return false
    // In full mode we must also have Thing choice
    if (!disableThing) {
      if (useExistingThing && !thingId) return false
      if (!useExistingThing && !newThing) return false
    }
    if (useExistingSensor && !sensorId) return false
    if (!useExistingSensor && !newSensor) return false
    if (useExistingObservedProperty && !observedPropertyId) return false
    return true
  }

  // Build Thing locations for deep insert (only used in full mode if new Thing)
  const buildThingLocationsForDeepInsert = (thing: any) => {
    if (!thing) return []
    const existingIds: any[] = Array.isArray(thing?.Locations)
      ? thing.Locations
      : thing?.Location
        ? [thing.Location]
        : []
    const existing = existingIds
      .filter((id) => id !== null && id !== undefined && id !== '')
      .map((id) => ({ '@iot.id': Number(id) }))

    const createdArr: any[] = thing?.newLocations
      ? thing.newLocations
      : thing?.newLocation
        ? [thing.newLocation]
        : []

    const created = createdArr.map((loc: any) => ({
      name: loc.name,
      description: loc.description,
      encodingType: loc.encodingType || 'application/vnd.geo+json',
      location: loc.location,
    }))

    return [...created, ...existing]
  }

  const handleSubmit = async () => {
    setLocalError(null)
    if (!validate()) return
    const uomOpt = unitOfMeasurementOptions.find(
      (o) => o.name === ds.unitOfMeasurement
    )
    if (!uomOpt) {
      setLocalError('Invalid Unit of Measurement')
      return
    }

    // Build base datastream payload
    const basePayload: any = {
      unitOfMeasurement: {
        name: uomOpt.name,
        symbol: uomOpt.symbol,
        definition: uomOpt.definition,
      },
      description: ds.description,
      name: ds.name,
      Network: { '@iot.id': Number(networkIdParam) },
      properties: buildPropertiesObject(ds.properties),
      observationType: ds.observationType,
      ObservedProperty: useExistingObservedProperty
        ? { '@iot.id': Number(observedPropertyId) }
        : {
            name: newObservedProperty.name,
            definition: newObservedProperty.definition,
            description: newObservedProperty.description,
          },
      Sensor: useExistingSensor
        ? { '@iot.id': Number(sensorId) }
        : {
            name: newSensor.name,
            description: newSensor.description,
            encodingType: newSensor.encodingType,
            metadata: newSensor.metadata,
          },
    }

    // In full mode we attach Thing reference or deep insert structure
    if (!disableThing) {
      basePayload.Thing = useExistingThing
        ? { '@iot.id': Number(thingId) }
        : {
            name: newThing.name,
            description: newThing.description,
            properties: newThing.properties || {},
            Locations: buildThingLocationsForDeepInsert(newThing),
          }
    }

    await onCreate(basePayload)
  }

  const renderPropertiesEditor = (
    list: Array<{ key: string; value: string }>,
    onChange: (idx: number, field: 'key' | 'value', v: string) => void,
    onAdd: () => void,
    onRemove: (idx: number) => void,
    title: string
  ) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{title}</span>
        <Button
          size="sm"
          variant="bordered"
          onPress={onAdd}
          disabled={isLoading}
        >
          + Add
        </Button>
      </div>
      {list.length === 0 && (
        <div className="text-xs text-default-500">No properties.</div>
      )}
      <div className="flex flex-col gap-2">
        {list.map((p, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-2 items-center">
            <Input
              size="sm"
              variant="bordered"
              label="Key"
              value={p.key}
              onChange={(e) => onChange(idx, 'key', e.target.value)}
              className="col-span-2"
            />
            <Input
              size="sm"
              variant="bordered"
              label="Value"
              value={p.value}
              onChange={(e) => onChange(idx, 'value', e.target.value)}
              className="col-span-2"
            />
            <Button
              size="md"
              color="danger"
              variant="bordered"
              onPress={() => onRemove(idx)}
              className="w-4"
            >
              -
            </Button>
          </div>
        ))}
      </div>
    </div>
  )

  const renderJsonEditor = () => {
    const entityJson: any = {
      unitOfMeasurement: unitOfMeasurementOptions.find(
        (o) => o.name === ds.unitOfMeasurement
      ) || {
        name: '',
        symbol: '',
        definition: '',
      },
      description: ds.description,
      name: ds.name,
      Network: { '@iot.id': Number(networkIdParam) },
      observationType: ds.observationType,
      ObservedProperty: useExistingObservedProperty
        ? { '@iot.id': Number(observedPropertyId) }
        : {
            name: newObservedProperty?.name || '',
            definition: newObservedProperty?.definition || '',
            description: newObservedProperty?.description || '',
          },
      Sensor: useExistingSensor
        ? { '@iot.id': Number(sensorId) }
        : {
            name: newSensor?.name || '',
            description: newSensor?.description || '',
            encodingType: newSensor?.encodingType || '',
            metadata: newSensor?.metadata || '',
          },
    }
    if (!disableThing) {
      entityJson.Thing = useExistingThing
        ? { '@iot.id': Number(thingId) }
        : {
            name: newThing?.name || '',
            description: newThing?.description || '',
            properties: newThing?.properties || {},
            Locations: buildThingLocationsForDeepInsert(newThing),
          }
    }
    setJsonContent(JSON.stringify(entityJson, null, 2))
    setShowJsonEditor(true)
  }

  const renderEntityBlock = (
    title: string,
    useExisting: boolean,
    setUseExisting: (value: boolean) => void,
    existingOptions: Option[],
    existingId: string,
    setExistingId: (value: string) => void,
    newEntity: any,
    setNewEntity: (value: any) => void,
    creatorComponent: React.ReactNode
  ) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>

        <Switch
          size="sm"
          isSelected={!useExisting}
          onValueChange={(v) => {
            setUseExisting(!v)
            if (v) {
              setExistingId('')
              setNewEntity(null)
            }
          }}
        >
          {useExisting ? 'Existing' : 'New'}
        </Switch>
      </div>
      {useExisting ? (
        <Select
          size="sm"
          variant="bordered"
          label={`Select ${title}`}
          selectedKeys={existingId ? new Set([existingId]) : new Set()}
          onSelectionChange={(keys) =>
            setExistingId(getFirstKey(keys) as string)
          }
          isRequired
        >
          {existingOptions.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>
      ) : (
        <div className="flex flex-col gap-3">
          {!newEntity && creatorComponent}
          {newEntity && (
            <div className="border border-success-300 rounded-md p-3 bg-success-50 text-sm">
              New {title} saved
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="bordered" onPress={renderJsonEditor}>
                  JSON Preview
                </Button>
                <Button
                  size="sm"
                  variant="bordered"
                  color="danger"
                  onPress={() => setNewEntity(null)}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6 border border-default-200 rounded-md p-5 bg-content1 bg-gray-100">
      <div className="text-sm font-semibold">
        {title ||
          (disableThing ? 'Create Datastream (Embedded)' : 'Create Datastream')}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          size="sm"
          variant="bordered"
          label={labelFor('name')}
          value={ds.name}
          onChange={(e) => updateDs('name', e.target.value)}
          isRequired
        />
        <Input
          size="sm"
          variant="bordered"
          label={labelFor('description')}
          value={ds.description}
          onChange={(e) => updateDs('description', e.target.value)}
        />
        <Select
          size="sm"
          variant="bordered"
          label={labelFor('observationType')}
          selectedKeys={
            ds.observationType ? new Set([ds.observationType]) : new Set()
          }
          onSelectionChange={(keys) =>
            updateDs('observationType', getFirstKey(keys))
          }
          isRequired
        >
          {observationTypeOptions.map((o) => (
            <SelectItem key={o.value}>{o.label}</SelectItem>
          ))}
        </Select>

        <Select
          size="sm"
          variant="bordered"
          label={labelFor('unitOfMeasurement')}
          selectedKeys={
            ds.unitOfMeasurement ? new Set([ds.unitOfMeasurement]) : new Set()
          }
          onSelectionChange={(keys) =>
            updateDs('unitOfMeasurement', getFirstKey(keys))
          }
          isRequired
        >
          {unitOfMeasurementOptions.map((o) => (
            <SelectItem key={o.name}>{o.symbol}</SelectItem>
          ))}
        </Select>

        <div>
          {renderPropertiesEditor(
            ds.properties,
            (idx, f, val) => {
              const arr = [...ds.properties]
              arr[idx] = { ...arr[idx], [f]: val }
              updateDs('properties', arr)
            },
            addDsProperty,
            removeDsProperty,
            labelFor('properties')
          )}
        </div>

        <Input
          size="sm"
          variant="bordered"
          label={labelFor('network')}
          value={ds.network}
          isDisabled
        />
      </div>
      <Divider />
      {!disableThing &&
        renderEntityBlock(
          'Thing',
          useExistingThing,
          setUseExistingThing,
          thingOptions,
          thingId,
          setThingId,
          newThing,
          setNewThing,
          <ThingCreator
            onCreate={async (payload) => {
              setNewThing(payload)
            }}
            onCancel={() => {
              setUseExistingThing(true)
              setNewThing(null)
            }}
            isLoading={false}
            error={null}
            locationOptions={locationOptions}
            // Embedded ThingCreator needs the datastream-related option props but not used here
            datastreamOptions={[]}
            observationTypeOptions={observationTypeOptions}
            unitOfMeasurementOptions={unitOfMeasurementOptions}
            sensorOptions={sensorOptions}
            observedPropertyOptions={observedPropertyOptions}
            disableDatastreams
          />
        )}
      {!disableThing && <Divider />}
      {renderEntityBlock(
        'Sensor',
        useExistingSensor,
        setUseExistingSensor,
        sensorOptions,
        sensorId,
        setSensorId,
        newSensor,
        setNewSensor,
        <SensorCreator
          onCreate={async (payload) => {
            setNewSensor(payload)
          }}
          onCancel={() => {
            setUseExistingSensor(true)
            setNewSensor(null)
          }}
          isLoading={false}
          error={null}
        />
      )}
      <Divider />
      {renderEntityBlock(
        'Observed Property',
        useExistingObservedProperty,
        setUseExistingObservedProperty,
        observedPropertyOptions,
        observedPropertyId,
        setObservedPropertyId,
        newObservedProperty,
        setNewObservedProperty,
        <ObservedPropertyCreator
          onCreate={async (payload) => {
            setNewObservedProperty(payload)
          }}
          onCancel={() => {
            setUseExistingObservedProperty(true)
            setNewObservedProperty(null)
          }}
          isLoading={false}
          error={null}
        />
      )}
      <Divider />

      {showJsonEditor && (
        <div className="flex flex-col gap-2">
          <Textarea
            classNames={{
              input: 'resize-y min-h-[40px]',
            }}
            variant="bordered"
            label="JSON Editor"
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            className="col-span-2"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="bordered"
              onPress={() => {
                try {
                  const parsedJson = JSON.parse(jsonContent)
                  setDs((p) => ({
                    ...p,
                    description: parsedJson.description ?? p.description,
                    name: parsedJson.name ?? p.name,
                  }))
                  setShowJsonEditor(false)
                } catch (e) {
                  setLocalError('Invalid JSON')
                }
              }}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="bordered"
              color="danger"
              onPress={() => setShowJsonEditor(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {(error || localError) && (
        <div className="text-xs text-danger">{localError || error}</div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          color="primary"
          onPress={handleSubmit}
          isLoading={isLoading}
          isDisabled={isLoading || !validate()}
        >
          {disableThing ? 'Add Datastream' : 'Create'}
        </Button>

        <Button size="sm" variant="bordered" onPress={renderJsonEditor}>
          JSON Preview
        </Button>

        <Button
          size="sm"
          variant="bordered"
          onPress={onCancel}
          isDisabled={isLoading}
        >
          Cancel
        </Button>
      </div>
      <div className="text-[10px] opacity-60">
        {disableThing
          ? 'Embedded mode: resulting object excludes Thing (parent Thing will wrap it).'
          : 'Entities created in New mode will be deep inserted; otherwise references by @iot.id will be used.'}
      </div>
    </div>
  )
}

export default DatastreamCreator
