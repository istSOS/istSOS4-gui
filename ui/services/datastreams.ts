'use server'

import { fetchData, withAuthHeaders } from '@/services/fetch'

import { siteConfig } from '@/config/site'
import { Datastream } from '@/types/domain'

const resolveApiRoot = (apiRoot?: string) =>
  apiRoot?.trim().replace(/\/+$/, '') || siteConfig.api_root

function extractIotIdFromLocationHeader(headerValue: string | null) {
  if (!headerValue) return ''
  const match = headerValue.match(/\(([^)]+)\)\s*$/)
  return match?.[1]?.trim() ?? ''
}

async function findEntityIdByName(
  apiRoot: string,
  collection: string,
  name: string,
  token?: string | null
) {
  const normalizedName = name.trim()
  if (!normalizedName) return null

  const escapedName = normalizedName.replace(/'/g, "''")
  const filter = `name eq '${escapedName}'`
  const url =
    `${apiRoot}/${collection}` +
    `?$filter=${encodeURIComponent(filter)}&$top=1&$select=id`
  const response = await fetch(url, {
    method: 'GET',
    headers: withAuthHeaders(token, {}, apiRoot),
    cache: 'no-store',
  })

  if (!response.ok) return null
  const json = await response.json().catch(() => null)
  const first = Array.isArray(json?.value) ? json.value[0] : null
  const id = first?.id ?? first?.['@iot.id']
  return id === undefined || id === null ? null : String(id).trim() || null
}

export type CreateDatastreamPayload = {
  name: string
  description?: string
  observationType: string
  phenomenonTime?: string
  Thing?: { '@iot.id': number | string }
  Sensor?: { '@iot.id': number | string }
  ObservedProperty?: { '@iot.id': number | string }
  Network?: { '@iot.id': number | string }
  unitOfMeasurement?: Record<string, unknown>
  properties?: Record<string, unknown>
  commitMessage?: string
}

export type UpdateDatastreamPayload = {
  name: string
  description?: string
  observationType: string
  Thing?: { '@iot.id': number | string }
  Sensor?: { '@iot.id': number | string }
  ObservedProperty?: { '@iot.id': number | string }
  Network?: { '@iot.id': number | string }
  unitOfMeasurement?: Record<string, unknown>
  properties?: Record<string, unknown>
  commitMessage?: string
}

export async function getDatastreams(token?: string | null) {
  const values: Datastream[] = []
  const apiBase = new URL(siteConfig.api_root)
  let url =
    `${siteConfig.api_root}/Datastreams` +
    '?$select=id,name,description,unitOfMeasurement' +
    '&$expand=Thing($select=name),Sensor($select=name),ObservedProperty($select=name)'

  while (url) {
    const data = await fetchData(url, token)
    values.push(...(data?.value ?? []))

    const nextLink: string | undefined = data?.['@iot.nextLink']

    if (!nextLink) {
      url = undefined
      continue
    }

    if (nextLink.startsWith('http')) {
      const parsed = new URL(nextLink)
      url = `${apiBase.origin}${parsed.pathname}${parsed.search}`
    } else {
      url = new URL(nextLink, siteConfig.api_root).toString()
    }
  }

  return { datastreamData: values }
}

export async function createDatastream(
  payload: CreateDatastreamPayload,
  token?: string | null,
  apiRoot?: string
) {
  try {
    const resolvedApiRoot = resolveApiRoot(apiRoot)
    const { commitMessage, ...datastreamPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    }, resolvedApiRoot)

    if (commitMessage?.trim()) {
      headers['commit-message'] = commitMessage.trim()
    }

    const existingId = await findEntityIdByName(
      resolvedApiRoot,
      'Datastreams',
      payload.name,
      token
    )
    if (existingId) return { '@iot.id': existingId }

    const response = await fetch(`${resolvedApiRoot}/Datastreams`, {
      method: 'POST',
      headers,
      body: JSON.stringify(datastreamPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Create Datastream failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    if (text) return JSON.parse(text)
    const id = extractIotIdFromLocationHeader(response.headers.get('location'))
    return id ? { '@iot.id': id } : true
  } catch (error) {
    console.error('Error creating Datastream:', error)
    return null
  }
}

export async function updateDatastream(
  datastreamId: string | number,
  payload: UpdateDatastreamPayload,
  token?: string | null,
  apiRoot?: string
) {
  try {
    const resolvedApiRoot = resolveApiRoot(apiRoot)
    const id = String(datastreamId).trim()
    if (!id) return null

    const { commitMessage, ...datastreamPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    }, resolvedApiRoot)

    if (commitMessage?.trim()) {
      headers['commit-message'] = commitMessage.trim()
    }

    const response = await fetch(`${resolvedApiRoot}/Datastreams(${id})`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(datastreamPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Update Datastream failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error updating Datastream:', error)
    return null
  }
}
