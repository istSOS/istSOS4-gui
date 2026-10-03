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
import { Button } from '@heroui/button'
import { useTranslation } from 'react-i18next'

import { useAsOf } from '@/context/AsOfContext'
import {
  firstValidAsOf,
  lastValidAsOf,
} from '@/features/as-of/lib/existenceBounds'
import type { ExistenceState } from '@/features/as-of/hooks/useAsOfThing'

dayjs.extend(utc)

function fmt(iso: string | null): string {
  if (!iso) return '—'
  const d = dayjs.utc(iso)
  return d.isValid() ? d.format('MMM D, YYYY · HH:mm [UTC]') : iso
}

type Props = {
  thingName: string
  existenceState: ExistenceState
  existenceRange: { createdAt: string | null; deletedAt: string | null }
  onDismiss: () => void
}

/**
 * AsOfExistenceDialog — a floating notification card that appears when the
 * selected as-of date falls outside the Thing's known existence range.
 *
 * Styled to match the existing istSOS4 UI (HeroUI components, teal primary,
 * amber snapshot palette). No dark gradients or glow effects.
 */
export default function AsOfExistenceDialog({
  thingName,
  existenceState,
  existenceRange,
  onDismiss,
}: Props) {
  // Stateless — parent (Home.tsx) fully controls whether this mounts.
  // Do not add internal visible state here; it creates duplicate logic.
  const { setAsOfDate } = useAsOf()
  const { t } = useTranslation()

  if (existenceState === 'exists') return null

  const isNotYet = existenceState === 'not-yet-created'

  // Neither edge of the range is itself a usable `$as_of`: the creation instant
  // is reported truncated to the second and so resolves to just *before* the
  // data existed, and the deletion instant is the exclusive end of the range.
  // Jumping to either would 404 and bring this dialog straight back — so step
  // one whole second inwards (see existenceBounds).
  const jumpTarget = isNotYet
    ? firstValidAsOf(existenceRange.createdAt)
    : lastValidAsOf(existenceRange.deletedAt)

  const headline = isNotYet
    ? t('as_of.existence.no_data_before')
    : t('as_of.existence.no_data_after')
  const detail = isNotYet
    ? t('as_of.existence.detail_before', { name: thingName, date: fmt(existenceRange.createdAt) })
    : t('as_of.existence.detail_after', { name: thingName, date: fmt(existenceRange.deletedAt) })
  const jumpLabel = isNotYet
    ? t('as_of.existence.jump_earliest')
    : t('as_of.existence.jump_latest')

  // Amber for "not yet", muted red for "deleted" — matching scrubber dead-zone
  const accentColor = isNotYet ? '#b45309' : '#be123c'
  const accentBg   = isNotYet ? 'rgba(254,243,199,0.95)' : 'rgba(255,241,242,0.95)'
  const accentBorder = isNotYet ? 'rgba(180,83,9,0.25)'  : 'rgba(190,18,60,0.22)'
  const iconStroke = isNotYet ? '#d97706' : '#e11d48'

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(28vh + 60px)',
        transform: 'translateX(-50%)',
        zIndex: 5000,
        animation: 'asof-slide-up 0.18s ease-out both',
      }}
    >
      {/* Card — same style as .thing-tooltip-card in globals.css */}
      <div
        style={{
          minWidth: 320,
          maxWidth: 440,
          borderRadius: '12px',
          border: `1px solid ${accentBorder}`,
          background: accentBg,
          boxShadow: '0 4px 20px rgba(15,23,42,0.14), 0 1px 4px rgba(15,23,42,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Accent top bar — 3 px strip in the warning colour */}
        <div style={{ height: 3, background: accentColor }} />

        <div style={{ padding: '12px 14px 12px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>

            {/* Warning triangle icon (matches existing SVG style in the codebase) */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={iconStroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontSize: '12px',
                fontWeight: 600,
                color: accentColor,
                lineHeight: 1.3,
              }}>
                {headline}
              </p>
              <p style={{
                margin: '3px 0 0',
                fontSize: '11px',
                color: '#475569',
                lineHeight: 1.5,
              }}>
                {detail}
              </p>
            </div>

            {/* ✕ close */}
            <button
              onClick={onDismiss}
              aria-label={t('as_of.existence.dismiss')}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: 14,
                lineHeight: 1,
                padding: '0 2px',
                borderRadius: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* Divider */}
          <div style={{
            height: 1,
            background: accentBorder,
            margin: '10px 0 10px',
          }} />

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="light"
              onPress={onDismiss}
              style={{ color: '#64748b', fontSize: 11 }}
            >
              {t('as_of.existence.dismiss')}
            </Button>
            {jumpTarget && (
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setAsOfDate(jumpTarget)
                  // Parent unmounts this dialog when existenceState returns to 'exists';
                  // no need to touch local state here.
                  onDismiss()
                }}
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {jumpLabel}
              </Button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes asof-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
