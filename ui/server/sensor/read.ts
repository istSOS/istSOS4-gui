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





export async function getSensorsCount(token: string) {
  const [sensorData] = await Promise.all([
    fetchData(`${siteConfig.api_root}/Sensors?$count=true&$top=1`, token),
  ])
  return {
    sensorData: sensorData['@iot.count'] || 0,
  }
}

export async function getSensorsCountByNetwork(token: string, network: string) {
  const [sensorData] = await Promise.all([
    fetchData(
      `${siteConfig.api_root}/Datastreams?$expand=Sensor($select=name)&$filter=Network/name eq '${network}'&$select=name`,
      token
    ),
  ])

  const uniqueSensors = new Set<string>()

  for (const ds of sensorData['value'] || []) {
    const sensorName = ds.Sensor?.name || 'Unknown'
    uniqueSensors.add(sensorName)
  }

  return {
    sensorData: uniqueSensors.size,
  }
}