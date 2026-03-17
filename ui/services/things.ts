'use server';

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
import { fetchData } from '@/services/fetch';



import { siteConfig } from '@/config/site';





export async function getThings(token: string) {
  const expand = `
    Datastreams(
      $expand=Network,
              Observations($top=1;$orderby=phenomenonTime desc),
              ObservedProperty
    ),
    Locations
  `
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),;=])\s*/g, '$1')
    .trim()

  const url = `${siteConfig.api_root}/Things?$expand=${expand}`
  const thingData = await fetchData(url, token)
  return { thingData: thingData?.value ?? [] }
}

export async function getThingsCount(token: string) {
  const [thingData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Things?$count=true&$top=1`, token),
  ])
  return {
    thingData: thingData['@iot.count'] || 0,
  }
}

export async function getThingsCountByNetwork(token: string, network: string) {
  const [thingData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=Thing($select=name)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const uniqueThings = new Set<string>()

  for (const ds of thingData['value'] || []) {
    const thingName = ds.Thing?.name || 'Unknown'
    uniqueThings.add(thingName)
  }

  return {
    thingData: uniqueThings.size,
  }
}