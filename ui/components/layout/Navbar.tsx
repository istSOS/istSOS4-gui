'use client'

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
import AsOfNavbarButton from '@/features/as-of/components/AsOfNavbarButton'
import { Button } from '@heroui/button'
import { Link } from '@heroui/link'
import { Tooltip } from '@heroui/tooltip'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import NextLink from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { AggregationsIcon, DataSourcesIcon, EditIcon, LogoIstSOS } from '@/components/icons'
import AccountMenu from './AccountMenu'
import HelpMenu from './HelpMenu'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

import { canUseQcWithToken } from '@/lib/qcAccess'
import { getDataSourceToken } from '@/lib/dataSourceTokens'
import { canManageAggregations } from '@/features/aggregations/lib/access'
import type { AggregationSource } from '@/features/aggregations/lib/types'

export default function Navbar({
  saqcEnabled = false,
  aggregationSources = [],
}: {
  saqcEnabled?: boolean
  aggregationSources?: AggregationSource[]
}) {
  const { token } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const isHistoryRoute = (pathname ?? '').startsWith('/history')
  const isQcRoute = (pathname ?? '').startsWith('/qc')
  const isAggregationRoute = (pathname ?? '').startsWith('/aggregations')

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const canManageJobs = mounted && aggregationSources.some((source) =>
    canManageAggregations(
      source.isPrimary ? token ?? getDataSourceToken(source.endpoint) : getDataSourceToken(source.endpoint),
      source.authorizationEnabled
    )
  )

  return (
    <header className="w-full bg-[var(--color-primary)] text-white">
      <div className="mx-auto grid min-h-14 w-full grid-cols-[auto_1fr] items-center px-3 text-sm sm:grid-cols-3 lg:px-[25px]">
        {/* Left: logo */}
        <Link as={NextLink} aria-label="istSOS4" href="/">
          <div className="w-[150px]">
            <LogoIstSOS className="w-full" />
          </div>
        </Link>

        {/* Center: as_of trigger.
            Hidden on the history route: `$as_of` and `$from_to` are mutually
            exclusive at the API, and the history page is a page rather than a
            mode — leaving a snapshot control there would suggest the whole
            application is being re-read, which is exactly what it is not. */}
        <div className="flex justify-center">
          {siteConfig.versioning && !isHistoryRoute && !isQcRoute && !isAggregationRoute && (
            <AsOfNavbarButton />
          )}
        </div>

        {/* Page tools, followed by global help and account preferences. */}
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-1 sm:col-span-1">
          {canManageJobs && <Tooltip content={t('aggregations.title')}>
            <Button as={NextLink} href="/aggregations" isIconOnly variant="light" className="text-white" aria-label={t('aggregations.title')}>
              <AggregationsIcon size={22} />
            </Button>
          </Tooltip>}
          {saqcEnabled && canUseQcWithToken(token) && (
            <Tooltip content={t('qc.nav_label')}>
              <Button
                isIconOnly
                variant="light"
                className="text-white"
                aria-label={t('qc.nav_label')}
                onPress={() => router.push('/qc')}
              >
                <EditIcon size={22} />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('data_sources.nav_label')}>
            <Button
              isIconOnly
              variant="light"
              className="text-white"
              aria-label={t('data_sources.nav_label')}
              onPress={() => router.push('/data-sources')}
            >
              <DataSourcesIcon />
            </Button>
          </Tooltip>

          <div className="ml-2 flex items-center gap-1 border-l border-white/25 pl-2">
            <HelpMenu />
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
