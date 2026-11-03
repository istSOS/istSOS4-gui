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
import AsOfBanner from '@/features/as-of/components/AsOfBanner'
import type { ReactNode } from 'react'

import Navbar from '@/components/layout/Navbar'

import {
  RESULT_QUALITY_CONFIG_ID,
  resultQualityConfigJson,
} from '@/config/resultQuality'

import { AsOfProvider } from '@/context/AsOfContext'
import { AuthProvider } from '@/context/AuthContext'

import { getSaqcServiceUrl } from '@/server/qc'
import { getAggregationSources } from '@/server/aggregations'

import '@/styles/globals.css'

import Providers from './providers'

export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: ReactNode }) {
  const aggregationSources = await getAggregationSources()
  return (
    <html suppressHydrationWarning lang="en">
      <head>
        <script
          id={RESULT_QUALITY_CONFIG_ID}
          type="application/json"
          dangerouslySetInnerHTML={{ __html: resultQualityConfigJson() }}
        />
      </head>
      <body
        style={{ backgroundColor: 'var(--color-primary)' }}
        className="min-h-screen"
      >
        <Providers>
          <AuthProvider>
            <AsOfProvider>
              <Navbar saqcEnabled={!!getSaqcServiceUrl()} aggregationSources={aggregationSources} />
              <AsOfBanner />
              {children}
            </AsOfProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}
