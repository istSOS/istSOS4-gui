'use server'

import { siteConfig } from '@/config/site'

import { fetchData } from '@/server/utils/fetch'

export async function getObservationsByDatastream(
  token: string,
  datastreamId: string,
  start?: string,
  end?: string
) {
  const values: any[] = []

  const filters: string[] = []
  if (end) filters.push(`phenomenonTime le ${end}`)
  if (start) filters.push(`phenomenonTime ge ${start}`)

  let url =
    `${siteConfig.api_root}/Datastreams(${datastreamId})/Observations` +
    '?$orderby=phenomenonTime desc' +
    (filters.length ? `&$filter=${filters.join(' and ')}` : '')

  const apiBase = new URL(siteConfig.api_root)

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

  return { observationData: values }
}

export async function getObservationsCount(token: string) {
  const [observationData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Observations?$count=true&$top=1`, token),
  ])
  return {
    observationData: observationData['@iot.count'] || 0,
  }
}

export async function getObservationsCountByNetwork(
  token: string,
  network: string
) {
  const [observationData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=Observations($count=true;$select=result)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const counts = (observationData['value'] || []).reduce(
    (total, ds) => total + (ds['Observations@iot.count'] ?? 0),
    0
  )

  return {
    observationData: counts,
  }
}
