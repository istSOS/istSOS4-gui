'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/services/fetch'

export async function getNetworks(token: string) {
  const [networkData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Networks`, token),
  ])
  return {
    networkData: networkData.value,
  }
}

export async function getNetworksCount(token: string) {
  const [networkData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Networks?$count=true&$top=1`, token),
  ])
  return {
    networkData: networkData['@iot.count'] || 0,
  }
}
