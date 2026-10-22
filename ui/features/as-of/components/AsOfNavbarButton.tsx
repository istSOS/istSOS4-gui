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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAsOf } from '@/context/AsOfContext'
import AsOfDropdown from './AsOfDropdown'

dayjs.extend(utc)

// ---------------------------------------------------------------------------
// Helper: format the asOfDate into a compact navbar label
// ---------------------------------------------------------------------------
function formatChipLabel(iso: string): string {
  const d = dayjs.utc(iso)
  if (!d.isValid()) return iso
  return d.format('MMM D, YYYY · HH:mm') + ' UTC'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AsOfNavbarButton() {
  const { asOfDate, isSnapshot, clearSnapshot } = useAsOf()
  const { t } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // In snapshot mode: clicking the chip exits snapshot (no dropdown)
  // In live mode: clicking opens the dropdown
  const handleClick = () => {
    if (isSnapshot) {
      clearSnapshot()
      setDropdownOpen(false)
    } else {
      setDropdownOpen((prev) => !prev)
    }
  }

  return (
    // `relative` so the dropdown can position itself with `absolute top-full`
    <div className="relative">
      <button
        onClick={handleClick}
        aria-label={isSnapshot ? t('as_of.navbar.exit_snapshot') : t('as_of.navbar.open_picker')}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200"
        style={
          isSnapshot
            ? {
                // Snapshot mode: amber/warm chip
                background: 'rgba(251,191,36,0.15)',
                border: '1px solid rgba(251,191,36,0.55)',
                color: '#fbbf24',
                boxShadow: '0 0 12px rgba(251,191,36,0.2)',
              }
            : {
                // Live mode: teal-green pill
                background: 'rgba(0,131,116,0.25)',
                border: '1px solid rgba(0,131,116,0.5)',
                color: '#5eead4',
              }
        }
      >
        {isSnapshot ? (
          <>
            {/* Clock icon */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {formatChipLabel(asOfDate!)}
            {/* ✕ hint */}
            <span style={{ opacity: 0.6, fontSize: 10 }}>✕</span>
          </>
        ) : (
          <>
            {/* Pulsing green dot */}
            <span
              className="relative flex h-2 w-2"
              aria-hidden="true"
            >
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                style={{ background: '#34d399' }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: '#10b981' }}
              />
            </span>
            {t('as_of.navbar.live')}
          </>
        )}
      </button>

      {/* Dropdown — only rendered when open and NOT in snapshot mode */}
      {!isSnapshot && (
        <AsOfDropdown
          isOpen={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
        />
      )}
    </div>
  )
}
