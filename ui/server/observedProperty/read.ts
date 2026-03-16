'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getObservedPropertiesCount(token: string) {
  const [observedPropertyData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/ObservedProperties?$count=true&$top=1`,
      token
    ),
  ])
  return {
    observedPropertyData: observedPropertyData['@iot.count'] || 0,
  }
}

export async function getObservedPropertiesCountByNetwork(
  token: string,
  network: string
) {
  const [observedPropertyData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=ObservedProperty($select=name)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const uniqueObservedProperties = new Set<string>()

  for (const ds of observedPropertyData['value'] || []) {
    const observedPropertyName = ds.ObservedProperty?.name || 'Unknown'
    uniqueObservedProperties.add(observedPropertyName)
  }

  return {
    observedPropertyData: uniqueObservedProperties.size,
  }
}
