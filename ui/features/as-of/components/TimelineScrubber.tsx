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
import { useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useAsOf } from '@/context/AsOfContext'
import { useAsOfCommits, type AsOfCommit } from '@/features/as-of/hooks/useAsOfCommits'
import { firstValidAsOf } from '@/features/as-of/lib/existenceBounds'
import type { Thing } from '@/types/domain'

dayjs.extend(utc)

// Default range when a Thing has no history at all — 1 year back from now
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMs(iso: string): number {
  return dayjs.utc(iso).valueOf()
}

function msToIso(ms: number): string {
  return dayjs.utc(ms).toISOString()
}

/** Fraction 0–1 of where a date sits on the [firstMs, lastMs] range */
function positionOf(ms: number, firstMs: number, lastMs: number): number {
  if (lastMs <= firstMs) return 1
  return Math.max(0, Math.min(1, (ms - firstMs) / (lastMs - firstMs)))
}

// ---------------------------------------------------------------------------
// Sub-component: a single commit tick mark
// ---------------------------------------------------------------------------

function CommitTick({
  commit,
  fraction,
  isActive,
  onClick,
}: {
  commit: AsOfCommit
  fraction: number
  isActive: boolean
  onClick: () => void
}) {
  const label = dayjs.utc(commit.authoredAt).format('MMM D')

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${fraction * 100}%`,
        transform: 'translateX(-50%)',
        top: 0,
        bottom: 0,
      }}
    >
      {/* tick line */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          width: '2px',
          height: '14px',
          transform: 'translateY(-50%)',
          background: isActive ? '#f59e0b' : 'rgba(251,191,36,0.45)',
          borderRadius: '1px',
          pointerEvents: 'none',
        }}
      />
      {/* clickable label below the track */}
      <button
        onClick={onClick}
        title={commit.message}
        style={{
          position: 'absolute',
          bottom: '-2px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: '9px',
            fontWeight: isActive ? 700 : 500,
            color: isActive ? '#f59e0b' : 'rgba(251,191,36,0.7)',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
          }}
        >
          {label}
        </span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * TimelineScrubber — appears above the DatastreamTable panel when
 * `isSnapshot && selectedThing`.
 *
 * Range: [earliest data] → [now]. Only covers navigable territory.
 * The existence alert dialog handles the error case when asOfDate is
 * outside this range — the scrubber doesn't try to show dead zones.
 *
 * Commit timestamps are drawn as amber tick marks with labels.
 * Moving the thumb or clicking a tick updates `asOfDate` globally.
 */
export default function TimelineScrubber({ thing }: { thing: Thing | null }) {
  const { asOfDate, setAsOfDate, isSnapshot } = useAsOf()
  const { t } = useTranslation()
  const { commits, firstDate, lastDate } = useAsOfCommits({ thing })

  const trackRef = useRef<HTMLDivElement>(null)

  // Timestamp bounds: [earliest data] → [now]
  // The left bound is nudged to the first `$as_of` that actually resolves —
  // the reported creation instant itself answers 404 (see existenceBounds).
  // When nothing is known at all, fall back to 1 year ago.
  const firstMs = useMemo(() => {
    const safeFirst = firstValidAsOf(firstDate)
    return safeFirst ? toMs(safeFirst) : toMs(lastDate) - ONE_YEAR_MS
  }, [firstDate, lastDate])
  const lastMs = useMemo(() => toMs(lastDate), [lastDate])

  // Clamp the current value to the slider range — if asOfDate is outside
  // the station's data range, the thumb sits at the nearest edge.
  const currentMs = useMemo(() => {
    if (!asOfDate) return lastMs
    const ms = toMs(asOfDate)
    return Math.max(firstMs, Math.min(lastMs, ms))
  }, [asOfDate, firstMs, lastMs])

  // Convert slider value (ms as string) → setAsOfDate
  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const ms = Number(e.target.value)
      setAsOfDate(msToIso(ms))
    },
    [setAsOfDate]
  )

  // Jump to a specific commit date. A tick means "this change happened here",
  // so land on the first instant that shows the result of the change: the
  // commit's own second still resolves to the version it replaced, because the
  // backend truncates both stored and requested timestamps to whole seconds.
  const jumpToCommit = useCallback(
    (commit: AsOfCommit) => {
      setAsOfDate(firstValidAsOf(commit.authoredAt) ?? commit.authoredAt)
    },
    [setAsOfDate]
  )

  if (!isSnapshot || !thing) return null

  const thumbFraction = positionOf(currentMs, firstMs, lastMs)

  // Check if the real asOfDate lies outside the scrubber's navigable range.
  // When true, the thumb is pinned at an edge but the label shows the real date —
  // we add a directional indicator so the mismatch is explicit, not silent.
  const rawMs = asOfDate ? toMs(asOfDate) : lastMs
  const isBeforeRange = rawMs < firstMs
  const isAfterRange  = rawMs > lastMs
  const isOutOfRange  = isBeforeRange || isAfterRange

  const displayDate = asOfDate
    ? dayjs.utc(asOfDate).format('MMM D, YYYY · HH:mm') + ' UTC'
    : t('as_of.scrubber.now')

  return (
    <div
      className="as-of-scrubber fixed inset-x-0 z-[3900]"
      style={{
        bottom: 'calc(27vh + env(safe-area-inset-bottom))',
        background: 'linear-gradient(90deg, rgba(120,53,15,0.96) 0%, rgba(92,45,12,0.98) 100%)',
        borderTop: '1px solid rgba(251,191,36,0.35)',
        borderBottom: '1px solid rgba(251,191,36,0.2)',
        boxShadow: '0 -2px 16px rgba(0,0,0,0.35)',
      }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'rgba(251,191,36,0.7)',
                textTransform: 'uppercase',
              }}
            >
              ⏱ {t('as_of.scrubber.title')}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: 'rgba(251,191,36,0.5)',
              }}
            >
              {commits.length > 0
                ? t('as_of.scrubber.commits_count', { count: commits.length })
                : t('as_of.scrubber.no_history')}
            </span>
          </div>

          {/* Current selected date display */}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700,
              color: isOutOfRange ? 'rgba(251,191,36,0.55)' : '#fbbf24',
              background: isOutOfRange ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.12)',
              border: `1px solid ${isOutOfRange ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.3)'}`,
              borderRadius: '6px',
              padding: '1px 8px',
            }}
          >
            {/* Directional arrow shows the thumb is pinned at a range edge */}
            {isBeforeRange && (
              <span title={t('as_of.scrubber.before_range')} style={{ fontSize: '9px', opacity: 0.8 }}>↓</span>
            )}
            {isAfterRange && (
              <span title={t('as_of.scrubber.after_range')} style={{ fontSize: '9px', opacity: 0.8 }}>↑</span>
            )}
            {displayDate}
          </span>
        </div>

        {/* Slider + tick marks */}
        <div className="relative flex flex-col" style={{ paddingBottom: '16px' }}>
          {/* Track container — tick marks are absolutely positioned here */}
          <div
            ref={trackRef}
            className="relative"
            style={{ height: '24px', marginBottom: '2px' }}
          >
            {/* Commit ticks */}
            {commits.map((commit) => {
              const fraction = positionOf(toMs(commit.authoredAt), firstMs, lastMs)
              const isActive =
                asOfDate
                  ? Math.abs(toMs(commit.authoredAt) - toMs(asOfDate)) < 60_000 // within 1 min
                  : false
              return (
                <CommitTick
                  key={commit.id}
                  commit={commit}
                  fraction={fraction}
                  isActive={isActive}
                  onClick={() => jumpToCommit(commit)}
                />
              )
            })}

            {/* "Now" tick on the far right */}
            <div
              className="absolute flex flex-col items-center"
              style={{ right: 0, top: 0, bottom: 0, transform: 'translateX(50%)' }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  width: '2px',
                  height: '14px',
                  transform: 'translateY(-50%)',
                  background: 'rgba(251,191,36,0.35)',
                  borderRadius: '1px',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  fontSize: '9px',
                  fontWeight: 500,
                  color: 'rgba(251,191,36,0.55)',
                  whiteSpace: 'nowrap',
                  transform: 'translateX(-50%)',
                }}
              >
                {t('as_of.scrubber.now')}
              </span>
            </div>
          </div>

          {/* Styled range input */}
          <div className="relative">
            <input
              type="range"
              min={firstMs}
              max={lastMs}
              step={60_000}          // 1-minute steps
              value={currentMs}
              onChange={handleRangeChange}
              aria-label={t('as_of.scrubber.aria_label')}
              style={{
                // Full-width amber-themed range input
                width: '100%',
                height: '4px',
                appearance: 'none',
                WebkitAppearance: 'none',
                cursor: 'pointer',
                outline: 'none',
                background: `linear-gradient(
                  to right,
                  #f59e0b 0%,
                  #f59e0b ${thumbFraction * 100}%,
                  rgba(251,191,36,0.2) ${thumbFraction * 100}%,
                  rgba(251,191,36,0.2) 100%
                )`,
                borderRadius: '2px',
              }}
            />
          </div>

          {/* Range labels */}
          <div className="flex justify-between" style={{ marginTop: '2px' }}>
            <span
              style={{
                fontSize: '9px',
                color: 'rgba(251,191,36,0.45)',
              }}
            >
              {firstDate
                ? dayjs.utc(firstDate).format('MMM D, YYYY')
                : dayjs.utc(firstMs).format('MMM D, YYYY')}
            </span>
            <span
              style={{
                fontSize: '9px',
                color: 'rgba(251,191,36,0.45)',
              }}
            >
              {dayjs.utc(lastDate).format('MMM D, YYYY')}
            </span>
          </div>
        </div>
      </div>

      {/* Inline styles for the range thumb (can't do ::-webkit-slider-thumb in inline styles) */}
      <style>{`
        .as-of-scrubber input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          border: 2px solid #78350f;
          box-shadow: 0 0 0 3px rgba(251,191,36,0.25), 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        }
        .as-of-scrubber input[type="range"]:active::-webkit-slider-thumb {
          cursor: grabbing;
          box-shadow: 0 0 0 5px rgba(251,191,36,0.3), 0 2px 8px rgba(0,0,0,0.5);
        }
        .as-of-scrubber input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          border: 2px solid #78350f;
          box-shadow: 0 0 0 3px rgba(251,191,36,0.25), 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        }
      `}</style>
    </div>
  )
}
