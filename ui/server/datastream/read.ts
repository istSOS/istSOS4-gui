'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getDatastreams(token: string) {
  const values: any[] = []

  let url =
    `${siteConfig.api_root}` +
    '/Datastreams' +
    '?$select=id,name,observedArea,properties,unitOfMeasurement,phenomenonTime' +
    '&$expand=Network($select=name),Observations($top=1;$orderby=phenomenonTime desc;$select=result,phenomenonTime)'

  while (url) {
    const data = await fetchData(url, token)
    values.push(...(data?.value ?? []))

    const nextLink: string | undefined = data?.['@iot.nextLink']
    url = nextLink
      ? nextLink.startsWith('http')
        ? `${siteConfig.api_root}/${nextLink.split('/').at(-1)}`
        : nextLink
      : undefined
  }

  return { datastreamData: values }
}

export async function getDatastreamsCount(token: string) {
  const [datastreamData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}` + '/Datastreams' + '?$count=true' + '&$top=1',
      token
    ),
  ])
  return {
    datastreamData: datastreamData['@iot.count'] || 0,
  }
}

export async function getDatastreamsCountByNetwork(
  token: string,
  network: string
) {
  const [datastreamData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}` +
        '/Datastreams' +
        '?$count=true' +
        '&$top=1' +
        `&$filter=Network/name eq '${network}'`,
      token
    ),
  ])
  return {
    datastreamData: datastreamData['@iot.count'] || 0,
  }
}

export async function getDatastreamByNetwork(
  token: string,
  networks: string[]
) {
  if (!networks || networks.length === 0) return { datastreamData: [] }

  const filterQuery = networks.map((n) => `Network eq '${n}'`).join(' or ')

  const datastreamData = await fetchData(
    `${siteConfig.api_root} ` +
      '/Datastreams' +
      `?$filter=${encodeURIComponent(filterQuery)}`,
    token
  )

  return {
    datastreamData: datastreamData['value'] || [],
  }
}
