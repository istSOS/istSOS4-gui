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
import { getDatastreams } from '@/services/datastreams'
import { getDataSources } from '@/services/dataSources'
import { getLocations } from '@/services/locations'
import { getNetworks } from '@/services/networks'
import { getObservedProperties } from '@/services/observedProperties'
import { getSensors } from '@/services/sensors'
import { getThings } from '@/services/things'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import Home from '@/app/Home'
import { siteConfig } from '@/config/site'
import { isTokenExpired } from '@/lib/auth'

export default async function Page() {
  const cookieStore = await cookies()
  const token = siteConfig.authorizationEnabled
    ? (cookieStore.get('token')?.value ?? null)
    : null

  if (siteConfig.authorizationEnabled && (!token || isTokenExpired(token))) {
    redirect('/login')
  }

  try {
    const [
      things,
      locations,
      sensors,
      observedProperties,
      datastreams,
      networks,
      dataSources,
    ] = await Promise.all([
        getThings(token),
        getLocations(token),
        getSensors(token),
        getObservedProperties(token),
        getDatastreams(token),
        siteConfig.networkEnabled
          ? getNetworks(token)
          : Promise.resolve({ networkData: [] }),
        getDataSources(token),
      ])

    const writableDataSources = dataSources
      .filter((source) => source.authorizationEnabled)
      .map((source) => ({
        id: source.id,
        name: source.name,
        endpoint: source.endpoint,
      }))

    return (
      <Home
        things={things.thingData}
        locations={locations.locationData}
        sensors={sensors.sensorData}
        observedProperties={observedProperties.observedPropertyData}
        datastreams={datastreams.datastreamData}
        networks={networks.networkData}
        writableDataSources={writableDataSources}
      />
    )
  } catch (error) {
    if (siteConfig.authorizationEnabled) {
      redirect('/login')
    }

    throw error
  }
}
