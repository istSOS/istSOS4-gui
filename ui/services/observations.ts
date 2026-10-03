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
import { Observation } from '@/types/domain'

export async function getObservationsByDatastream(
  token: string | null | undefined,
  datastreamId: string,
  start?: string,
  end?: string,
  apiRoot?: string,
  asOfDate?: string | null
) {
  const values: Observation[] = []
  const baseRoot = (apiRoot ?? siteConfig.api_root).trim().replace(/\/+$/, '')

  const filters: string[] = []
  if (end) filters.push(`phenomenonTime le ${end}`)
  if (start) filters.push(`phenomenonTime ge ${start}`)

  let url =
    `${baseRoot}/Datastreams(${datastreamId})/Observations` +
    '?$orderby=phenomenonTime desc' +
    // The commit each observation carries — what the chart shows when a point
    // is clicked. Works in live mode and under $as_of alike (a snapshot returns
    // the commit in effect at that instant), and rides along on the request the
    // chart already makes. Must be the SINGULAR `Commit`.
    '&$expand=Commit' +
    (asOfDate ? `&$as_of=${encodeURIComponent(asOfDate)}` : '') +
    (filters.length ? `&$filter=${filters.join(' and ')}` : '') +
    '&$top=1440'

  const apiBase = new URL(baseRoot)

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
      url = new URL(nextLink, baseRoot).toString()
    }
  }

  return { observationData: values }
}

/**
 * Timestamp of the most recent observation of a datastream, optionally as it
 * existed at `asOfDate`. Single top-1 request — used to anchor the chart's
 * default window when the snapshot window itself holds no observations.
 *
 * Returns null when the datastream has no observations at that point in time.
 */
export async function getLatestObservationTime(
  token: string | null | undefined,
  datastreamId: string,
  apiRoot?: string,
  asOfDate?: string | null
): Promise<string | null> {
  const baseRoot = (apiRoot ?? siteConfig.api_root).trim().replace(/\/+$/, '')
  const url =
    `${baseRoot}/Datastreams(${datastreamId})/Observations` +
    '?$orderby=phenomenonTime desc&$top=1' +
    (asOfDate ? `&$as_of=${encodeURIComponent(asOfDate)}` : '')

  const data = await fetchData(url, token)
  const latest = (data?.value ?? [])[0] as Observation | undefined
  const raw = latest?.phenomenonTime ?? latest?.resultTime ?? ''
  // phenomenonTime may be an interval ("start/end") — anchor on its end.
  const timestamp = String(raw).split('/').pop()?.trim()
  return timestamp || null
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

  const counts = ((observationData['value'] as Array<Record<string, unknown>>) || []).reduce(
    (total, ds) => total + Number(ds['Observations@iot.count'] ?? 0),
    0
  )

  return {
    observationData: counts,
  }
}
