'use server'

import { fetchData } from '@/services/fetch'

import { siteConfig } from '@/config/site'

export async function getNetworks(token: string) {
  const values: any[] = []
  const apiBase = new URL(siteConfig.api_root)
  let url = `${siteConfig.api_root}/Networks?$select=id,name`

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

  return { networkData: values }
}
