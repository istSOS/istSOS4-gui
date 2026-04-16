'use server'

import { fetchData, withAuthHeaders } from '@/services/fetch'

import { siteConfig } from '@/config/site'

const resolveApiRoot = (apiRoot?: string) =>
  apiRoot?.trim().replace(/\/+$/, '') || siteConfig.api_root

export type CreateDatastreamPayload = {
  name: string
  description?: string
  observationType: string
  Thing?: { '@iot.id': number | string }
  Sensor?: { '@iot.id': number | string }
  ObservedProperty?: { '@iot.id': number | string }
  Network?: { '@iot.id': number | string }
  unitOfMeasurement?: Record<string, string>
  properties?: Record<string, string>
  commitMessage?: string
}

export async function getDatastreams(token?: string | null) {
  const values: any[] = []
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
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error creating Datastream:', error)
    return null
  }
}
