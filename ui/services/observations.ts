'use server'

// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { fetchData } from '@/services/fetch'

import { siteConfig } from '@/config/site'

export async function getObservationsByDatastream(
  token: string | null | undefined,
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
    (filters.length ? `&$filter=${filters.join(' and ')}` : '') +
    '&$top=1440'

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
