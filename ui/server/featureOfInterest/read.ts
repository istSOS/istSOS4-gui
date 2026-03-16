'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getFeaturesOfInterestCount(token: string) {
  const [featureOfInterestData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/FeaturesOfInterest?$count=true&$top=1`,
      token
    ),
  ])
  return {
    featureOfInterestData: featureOfInterestData['@iot.count'] || 0,
  }
}
