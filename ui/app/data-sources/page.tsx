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
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import DataSourcesPage from '@/features/data-sources/components/DataSourcesPage'

import { siteConfig } from '@/config/site'

import { isTokenExpired } from '@/lib/auth'
import { getDataSources } from '@/services/dataSources'

export default async function Page() {
  const cookieStore = await cookies()
  const token = siteConfig.authorizationEnabled
    ? (cookieStore.get('token')?.value ?? null)
    : null

  if (siteConfig.authorizationEnabled && (!token || isTokenExpired(token))) {
    redirect('/login')
  }

  const dataSources = await getDataSources(token)
  return <DataSourcesPage dataSources={dataSources} />
}
