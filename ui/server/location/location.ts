'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getLocationsCount(token: string) {
  const [locationData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Locations?$count=true&$top=1`, token),
  ])
  return {
    locationData: locationData['@iot.count'] || 0,
  }
}

export async function getLocationsCountByNetwork(
  token: string,
  network: string
) {
  const [locationData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=Thing($select=name;$expand=Locations)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const uniqueLocations = new Set<string>()

  for (const ds of locationData['value'] || []) {
    const thingName = ds.Thing?.name || 'Unknown'
    uniqueLocations.add(thingName)
  }

  return {
    locationData: uniqueLocations.size,
  }
}
