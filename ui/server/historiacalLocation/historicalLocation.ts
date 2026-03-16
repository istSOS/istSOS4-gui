'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getHistoricalLocationsCount(token: string) {
  const [historicalLocationData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/HistoricalLocations?$count=true&$top=1`,
      token
    ),
  ])
  return {
    historicalLocationData: historicalLocationData['@iot.count'] || 0,
  }
}
