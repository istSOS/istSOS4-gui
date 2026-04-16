'use server'

import { fetchData, withAuthHeaders } from '@/services/fetch'

import { siteConfig } from '@/config/site'

const resolveApiRoot = (apiRoot?: string) =>
  apiRoot?.trim().replace(/\/+$/, '') || siteConfig.api_root

export type CreateLocationPayload = {
  name: string
  description?: string
  encodingType: string
  location:
    | string
    | {
        type: 'Point'
        coordinates: [number, number]
      }
  properties?: Record<string, string>
  commitMessage?: string
}

export async function getLocations(token?: string | null) {
  const values: any[] = []
  const apiBase = new URL(siteConfig.api_root)
  let url = `${siteConfig.api_root}/Locations?$select=id,name,description,location`

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

  return { locationData: values }
}

export async function createLocation(
  payload: CreateLocationPayload,
  token?: string | null,
  apiRoot?: string
) {
  try {
    const resolvedApiRoot = resolveApiRoot(apiRoot)
    const { commitMessage, ...locationPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    }, resolvedApiRoot)

    if (commitMessage?.trim()) {
      headers['commit-message'] = commitMessage.trim()
    }

    const response = await fetch(`${resolvedApiRoot}/Locations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(locationPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Create Location failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error creating Location:', error)
    return null
  }
}
