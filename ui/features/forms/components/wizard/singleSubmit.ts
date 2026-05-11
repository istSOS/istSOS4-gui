import {
  type CreateDatastreamPayload,
  createDatastream,
  updateDatastream,
} from '@/services/datastreams'
import {
  type CreateLocationPayload,
  type UpdateLocationPayload,
  createLocation,
  updateLocation,
} from '@/services/locations'
import {
  type CreateObservedPropertyPayload,
  type UpdateObservedPropertyPayload,
  createObservedProperty,
  updateObservedProperty,
} from '@/services/observedProperties'
import {
  type CreateSensorPayload,
  type UpdateSensorPayload,
  createSensor,
  updateSensor,
} from '@/services/sensors'
import {
  type CreateThingPayload,
  type UpdateThingPayload,
  createThing,
  updateThing,
} from '@/services/things'

import type { EntityKey, FormDataMap } from './types'
import { normalizeEntityPayload } from './utils'

export async function executeSingleSubmitFlow({
  operation,
  singleEntity,
  singleDraft,
  editTargets,
  entityLabel,
  requiresCommitMessage,
  commitMessage,
  requestToken,
  selectedEndpoint,
}: {
  operation: 'create' | 'edit'
  singleEntity: EntityKey
  singleDraft: FormDataMap
  editTargets?: Partial<Record<EntityKey, string>>
  entityLabel: string
  requiresCommitMessage: boolean
  commitMessage: string
  requestToken?: string | null
  selectedEndpoint: string
}): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  let result: unknown = null
  const message = commitMessage.trim()

  if (operation === 'edit') {
    const editTargetId = String(editTargets?.[singleEntity] ?? '').trim()
    if (!editTargetId) {
      return {
        ok: false,
        errorMessage: `No linked ${entityLabel} is available for editing`,
      }
    }

    if (singleEntity === 'thing') {
      const payload = normalizeEntityPayload('thing', singleDraft.thing) as UpdateThingPayload
      result = await updateThing(
        editTargetId,
        { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
        requestToken,
        selectedEndpoint
      )
    } else if (singleEntity === 'location') {
      const payload = normalizeEntityPayload('location', singleDraft.location) as UpdateLocationPayload
      result = await updateLocation(
        editTargetId,
        { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
        requestToken,
        selectedEndpoint
      )
    } else if (singleEntity === 'sensor') {
      const payload = normalizeEntityPayload('sensor', singleDraft.sensor) as UpdateSensorPayload
      result = await updateSensor(
        editTargetId,
        { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
        requestToken,
        selectedEndpoint
      )
    } else if (singleEntity === 'observedProperty') {
      const payload = normalizeEntityPayload(
        'observedProperty',
        singleDraft.observedProperty
      ) as UpdateObservedPropertyPayload
      result = await updateObservedProperty(
        editTargetId,
        { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
        requestToken,
        selectedEndpoint
      )
    } else if (singleEntity === 'datastream') {
      const payload = normalizeEntityPayload(
        'datastream',
        singleDraft.datastream
      ) as CreateDatastreamPayload
      result = await updateDatastream(
        editTargetId,
        { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
        requestToken,
        selectedEndpoint
      )
    } else {
      return { ok: false, errorMessage: 'Unable to resolve edit payload for this entity' }
    }
  } else if (singleEntity === 'thing') {
    const payload = normalizeEntityPayload('thing', singleDraft.thing) as CreateThingPayload
    result = await createThing(
      { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
      requestToken,
      selectedEndpoint
    )
  } else if (singleEntity === 'location') {
    const payload = normalizeEntityPayload('location', singleDraft.location) as CreateLocationPayload
    result = await createLocation(
      { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
      requestToken,
      selectedEndpoint
    )
  } else if (singleEntity === 'sensor') {
    const payload = normalizeEntityPayload('sensor', singleDraft.sensor) as CreateSensorPayload
    result = await createSensor(
      { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
      requestToken,
      selectedEndpoint
    )
  } else if (singleEntity === 'datastream') {
    const payload = normalizeEntityPayload('datastream', singleDraft.datastream) as CreateDatastreamPayload
    result = await createDatastream(
      { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
      requestToken,
      selectedEndpoint
    )
  } else {
    const payload = normalizeEntityPayload(
      'observedProperty',
      singleDraft.observedProperty
    ) as CreateObservedPropertyPayload
    result = await createObservedProperty(
      { ...payload, ...(requiresCommitMessage ? { commitMessage: message } : {}) },
      requestToken,
      selectedEndpoint
    )
  }

  if (!result) {
    if (operation === 'edit') {
      return {
        ok: false,
        errorMessage:
          singleEntity === 'datastream'
            ? 'Unable to update Datastream'
            : 'Unable to update entity',
      }
    }

    return {
      ok: false,
      errorMessage:
        singleEntity === 'thing'
          ? 'Unable to create Thing'
          : singleEntity === 'location'
            ? 'Unable to create Location'
            : singleEntity === 'sensor'
              ? 'Unable to create Sensor'
              : singleEntity === 'datastream'
                ? 'Unable to create Datastream'
                : 'Unable to create Observed Property',
    }
  }

  return { ok: true }
}
