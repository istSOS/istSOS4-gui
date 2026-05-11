import { siteConfig } from '@/config/site'
import {
  type CreateDatastreamPayload,
  type UpdateDatastreamPayload,
  createDatastream,
  updateDatastream,
} from '@/services/datastreams'
import { type CreateLocationPayload, createLocation } from '@/services/locations'
import {
  type CreateObservedPropertyPayload,
  createObservedProperty,
} from '@/services/observedProperties'
import { type CreateSensorPayload, createSensor } from '@/services/sensors'
import {
  type CreateThingPayload,
  type UpdateThingPayload,
  createThing,
  updateThing,
} from '@/services/things'

import { AssociatedDraft, EntityKey } from './types'
import { parseCreatedEntityId, toEntityReferenceId } from './formModalUtils'
import { normalizeEntityPayload } from './utils'

export async function executeAssociatedSubmitFlow({
  associatedDraft,
  commitMessage,
  requestToken,
  selectedEndpoint,
}: {
  associatedDraft: AssociatedDraft
  commitMessage: string
  requestToken?: string | null
  selectedEndpoint: string
}) {
  const ids: Record<EntityKey, string> = {
    thing:
      associatedDraft.thing.source === 'existing'
        ? associatedDraft.thing.existingId.trim()
        : '',
    location:
      associatedDraft.location.source === 'existing'
        ? associatedDraft.location.existingId.trim()
        : '',
    sensor:
      associatedDraft.sensor.source === 'existing'
        ? associatedDraft.sensor.existingId.trim()
        : '',
    observedProperty:
      associatedDraft.observedProperty.source === 'existing'
        ? associatedDraft.observedProperty.existingId.trim()
        : '',
    datastream:
      associatedDraft.datastream.source === 'existing'
        ? associatedDraft.datastream.existingId.trim()
        : '',
  }

  if (associatedDraft.location.source === 'new') {
    const payload = normalizeEntityPayload(
      'location',
      associatedDraft.location.formData
    ) as CreateLocationPayload
    const created = await createLocation(
      { ...payload, commitMessage },
      requestToken,
      selectedEndpoint
    )
    const id = parseCreatedEntityId(created)
    if (!id) throw new Error('Location created without id')
    ids.location = id
  }

  if (associatedDraft.sensor.source === 'new') {
    const payload = normalizeEntityPayload(
      'sensor',
      associatedDraft.sensor.formData
    ) as CreateSensorPayload
    const created = await createSensor(
      { ...payload, commitMessage },
      requestToken,
      selectedEndpoint
    )
    const id = parseCreatedEntityId(created)
    if (!id) throw new Error('Sensor created without id')
    ids.sensor = id
  }

  if (associatedDraft.observedProperty.source === 'new') {
    const payload = normalizeEntityPayload(
      'observedProperty',
      associatedDraft.observedProperty.formData
    ) as CreateObservedPropertyPayload
    const created = await createObservedProperty(
      { ...payload, commitMessage },
      requestToken,
      selectedEndpoint
    )
    const id = parseCreatedEntityId(created)
    if (!id) throw new Error('ObservedProperty created without id')
    ids.observedProperty = id
  }

  if (associatedDraft.thing.source === 'new') {
    const payload = normalizeEntityPayload(
      'thing',
      associatedDraft.thing.formData
    ) as CreateThingPayload
    const mergedPayload = {
      ...payload,
      ...(ids.location
        ? { Locations: [{ '@iot.id': toEntityReferenceId(ids.location) }] }
        : {}),
    }
    const created = await createThing(
      { ...mergedPayload, commitMessage },
      requestToken,
      selectedEndpoint
    )
    const id = parseCreatedEntityId(created)
    if (!id) throw new Error('Thing created without id')
    ids.thing = id
  } else if (ids.thing && ids.location) {
    await updateThing(
      ids.thing,
      {
        Locations: [{ '@iot.id': toEntityReferenceId(ids.location) }],
        commitMessage,
      } as UpdateThingPayload,
      requestToken,
      selectedEndpoint
    )
  }

  if (associatedDraft.datastream.source === 'new') {
    const payload = normalizeEntityPayload(
      'datastream',
      associatedDraft.datastream.formData
    ) as CreateDatastreamPayload
    if (siteConfig.networkEnabled && !payload.Network) {
      throw new Error('Datastream Network is required')
    }
    const mergedPayload = {
      ...payload,
      ...(ids.thing ? { Thing: { '@iot.id': toEntityReferenceId(ids.thing) } } : {}),
      ...(ids.sensor
        ? { Sensor: { '@iot.id': toEntityReferenceId(ids.sensor) } }
        : {}),
      ...(ids.observedProperty
        ? {
            ObservedProperty: {
              '@iot.id': toEntityReferenceId(ids.observedProperty),
            },
          }
        : {}),
    }
    const created = await createDatastream(
      { ...mergedPayload, commitMessage },
      requestToken,
      selectedEndpoint
    )
    const id = parseCreatedEntityId(created)
    if (!id) throw new Error('Datastream created without id')
    ids.datastream = id
  } else if (ids.datastream) {
    const patchPayload: Record<string, unknown> = {}
    if (ids.thing) patchPayload.Thing = { '@iot.id': toEntityReferenceId(ids.thing) }
    if (ids.sensor) patchPayload.Sensor = { '@iot.id': toEntityReferenceId(ids.sensor) }
    if (ids.observedProperty) {
      patchPayload.ObservedProperty = {
        '@iot.id': toEntityReferenceId(ids.observedProperty),
      }
    }
    if (Object.keys(patchPayload).length > 0) {
      await updateDatastream(
        ids.datastream,
        {
          ...(patchPayload as Partial<CreateDatastreamPayload>),
          commitMessage,
        } as unknown as UpdateDatastreamPayload,
        requestToken,
        selectedEndpoint
      )
    }
  }
}
