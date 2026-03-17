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
