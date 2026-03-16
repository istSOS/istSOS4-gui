'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getSensorsCount(token: string) {
  const [sensorData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Sensors?$count=true&$top=1`, token),
  ])
  return {
    sensorData: sensorData['@iot.count'] || 0,
  }
}

export async function getSensorsCountByNetwork(token: string, network: string) {
  const [sensorData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=Sensor($select=name)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const uniqueSensors = new Set<string>()

  for (const ds of sensorData['value'] || []) {
    const sensorName = ds.Sensor?.name || 'Unknown'
    uniqueSensors.add(sensorName)
  }

  return {
    sensorData: uniqueSensors.size,
  }
}
