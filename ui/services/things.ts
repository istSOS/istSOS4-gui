'use server'

// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { fetchData, withAuthHeaders } from '@/services/fetch'

import { siteConfig } from '@/config/site'

const resolveApiRoot = (apiRoot?: string) =>
  apiRoot?.trim().replace(/\/+$/, '') || siteConfig.api_root

export type CreateThingPayload = {
  name: string
  description?: string
  Locations?: Array<{ '@iot.id': number | string }>
  properties?: Record<string, string>
  commitMessage?: string
}

export type UpdateThingPayload = {
  name: string
  description?: string
  Locations?: Array<{ '@iot.id': number | string }>
  properties?: Record<string, string>
  commitMessage?: string
}

export async function getThings(token?: string | null) {
  const expand = `
    Datastreams(
      $expand=Network,
              Sensor,
              Observations($top=1;$orderby=phenomenonTime desc),
              ObservedProperty
    ),
    Locations
  `
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),;=])\s*/g, '$1')
    .trim()

  const url = `${siteConfig.api_root}/Things?$expand=${expand}`
  const thingData = await fetchData(url, token)
  return { thingData: thingData?.value ?? [] }
}

export async function getThingsCount(token: string) {
  const [thingData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Things?$count=true&$top=1`, token),
  ])
  return {
    thingData: thingData['@iot.count'] || 0,
  }
}

export async function getThingsCountByNetwork(token: string, network: string) {
  const [thingData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=Thing($select=name)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const uniqueThings = new Set<string>()

  for (const ds of thingData['value'] || []) {
    const thingName = ds.Thing?.name || 'Unknown'
    uniqueThings.add(thingName)
  }

  return {
    thingData: uniqueThings.size,
  }
}

export async function createThing(
  payload: CreateThingPayload,
  token?: string | null,
  apiRoot?: string
) {
  try {
    const resolvedApiRoot = resolveApiRoot(apiRoot)
    const { commitMessage, ...thingPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    }, resolvedApiRoot)

    if (commitMessage?.trim()) {
      headers['commit-message'] = commitMessage.trim()
    }

    const response = await fetch(`${resolvedApiRoot}/Things`, {
      method: 'POST',
      headers,
      body: JSON.stringify(thingPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Create Thing failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error creating Thing:', error)
    return null
  }
}

export async function updateThing(
  thingId: string | number,
  payload: UpdateThingPayload,
  token?: string | null,
  apiRoot?: string
) {
  try {
    const resolvedApiRoot = resolveApiRoot(apiRoot)
    const id = String(thingId).trim()
    if (!id) return null

    const { commitMessage, ...thingPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    }, resolvedApiRoot)

    if (commitMessage?.trim()) {
      headers['commit-message'] = commitMessage.trim()
    }

    const response = await fetch(`${resolvedApiRoot}/Things(${id})`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(thingPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Update Thing failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error updating Thing:', error)
    return null
  }
}
