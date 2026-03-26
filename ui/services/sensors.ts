'use server'

import { fetchData, withAuthHeaders } from '@/services/fetch'

import { siteConfig } from '@/config/site'

export type CreateSensorPayload = {
  name: string
  description?: string
  encodingType: string
  metadata: string
  properties?: Record<string, string>
  commitMessage?: string
}

export async function getSensors(token?: string | null) {
  const values: any[] = []
  const apiBase = new URL(siteConfig.api_root)
  let url = `${siteConfig.api_root}/Sensors?$select=id,name,description`

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

  return { sensorData: values }
}

export async function createSensor(
  payload: CreateSensorPayload,
  token?: string | null
) {
  try {
    const { commitMessage, ...sensorPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    })

    if (siteConfig.authorizationEnabled) {
      headers['commit-message'] = commitMessage?.trim() || 'Creating sensor'
    }

    const response = await fetch(`${siteConfig.api_root}/Sensors`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sensorPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Create Sensor failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error creating Sensor:', error)
    return null
  }
}
export async function updateSensor(
  id: number | string,
  payload: Partial<CreateSensorPayload>,
  token?: string | null
) {
  try {
    const { commitMessage, ...sensorPayload } = payload
    const headers = withAuthHeaders(token, {
      'Content-Type': 'application/json',
    })

    if (siteConfig.authorizationEnabled) {
      headers['commit-message'] = commitMessage?.trim() || 'Updating sensor'
    }

    const response = await fetch(`${siteConfig.api_root}/Sensors(${id})`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(sensorPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Update Sensor failed: ${response.status} ${response.statusText}`
      )
    }

    const text = await response.text()
    return text ? JSON.parse(text) : true
  } catch (error) {
    console.error('Error updating Sensor:', error)
    return null
  }
}

export async function deleteSensor(
  id: number | string,
  token?: string | null,
  commitMessage?: string
) {
  try {
    const headers = withAuthHeaders(token)

    if (siteConfig.authorizationEnabled) {
      headers['commit-message'] = commitMessage || 'Deleting sensor'
    }

    const response = await fetch(`${siteConfig.api_root}/Sensors(${id})`, {
      method: 'DELETE',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        errorText ||
          `Delete Sensor failed: ${response.status} ${response.statusText}`
      )
    }

    return true
  } catch (error) {
    console.error('Error deleting Sensor:', error)
    return false
  }
}
