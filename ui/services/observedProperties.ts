'use server'

import { fetchData, withAuthHeaders } from '@/services/fetch'

import { siteConfig } from '@/config/site'

export type CreateObservedPropertyPayload = {
  name: string
  definition: string
  description?: string
  properties?: Record<string, string>
  commitMessage?: string
}

export async function getObservedProperties(token?: string | null) {
  const values: any[] = []
  const apiBase = new URL(siteConfig.api_root)
  let url =
    `${siteConfig.api_root}/ObservedProperties` +
    '?$select=id,name,definition,description'

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

  return { observedPropertyData: values }
}

export async function createObservedProperty(
  payload: CreateObservedPropertyPayload,
  token?: string | null
) {
  try {
    const { commitMessage, ...observedPropertyPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    })

    if (siteConfig.authorizationEnabled) {
      headers['commit-message'] = commitMessage?.trim() || 'Creating observed property'
    }

    const response = await fetch(`${siteConfig.api_root}/ObservedProperties`, {
      method: 'POST',
      headers,
      body: JSON.stringify(observedPropertyPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Create Observed Property failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error creating Observed Property:', error)
    return null
  }
}
export async function updateObservedProperty(
  id: number | string,
  payload: Partial<CreateObservedPropertyPayload>,
  token?: string | null
) {
  try {
    const { commitMessage, ...observedPropertyPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    })

    if (siteConfig.authorizationEnabled && commitMessage?.trim()) {
      headers['commit-message'] = commitMessage.trim()
    }

    const response = await fetch(
      `${siteConfig.api_root}/ObservedProperties(${id})`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(observedPropertyPayload),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Update Observed Property failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error updating Observed Property:', error)
    return null
  }
}

export async function deleteObservedProperty(
  id: number | string,
  token?: string | null,
  commitMessage?: string
) {
  try {
    const headers = withAuthHeaders(token)

    if (siteConfig.authorizationEnabled) {
      headers['commit-message'] = commitMessage || 'Deleting observed property'
    }

    const response = await fetch(
      `${siteConfig.api_root}/ObservedProperties(${id})`,
      {
        method: 'DELETE',
        headers,
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Delete Observed Property failed: ${response.status} ${response.statusText}`
      )
    }

    return true
  } catch (error) {
    console.error('Error deleting Observed Property:', error)
    return false
  }
}
