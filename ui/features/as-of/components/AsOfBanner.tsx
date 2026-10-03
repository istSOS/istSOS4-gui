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

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTranslation } from 'react-i18next'

import { useAsOf } from '@/context/AsOfContext'

dayjs.extend(utc)

function formatBannerDate(iso: string): string {
  const d = dayjs.utc(iso)
  return d.isValid() ? d.format('YYYY-MM-DDTHH:mm:ss') + 'Z' : iso
}

export default function AsOfBanner() {
  const { isSnapshot, asOfDate } = useAsOf()
  const { t } = useTranslation()

  if (!isSnapshot || !asOfDate) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{
        background: 'linear-gradient(90deg, rgba(120,53,15,0.95) 0%, rgba(146,64,14,0.95) 50%, rgba(120,53,15,0.95) 100%)',
        borderBottom: '1px solid rgba(251,191,36,0.4)',
        color: '#fde68a',
        letterSpacing: '0.02em',
        zIndex: 5000,
      }}
    >
      {/* Gear / snapshot icon */}
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0, opacity: 0.9 }}
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>

      <span>
        {t('as_of.banner.snapshot_active')}{' '}
        <span className="font-bold" style={{ color: '#fbbf24' }}>
          {formatBannerDate(asOfDate)}
        </span>
        {' '}
        <span style={{ opacity: 0.65 }}>— @$as_of</span>
      </span>
    </div>
  )
}
