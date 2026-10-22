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

import { Button } from '@heroui/button'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAsOf } from '@/context/AsOfContext'

dayjs.extend(utc)

// ---------------------------------------------------------------------------
// Quick-time preset definitions — `key` resolves under as_of.quick_times.*
// ---------------------------------------------------------------------------
const QUICK_PRESETS = [
  { key: 'last_5_minutes', offsetMs: 5 * 60 * 1000 },
  { key: 'last_10_minutes', offsetMs: 10 * 60 * 1000 },
  { key: 'last_30_minutes', offsetMs: 30 * 60 * 1000 },
  { key: 'last_1_hour', offsetMs: 60 * 60 * 1000 },
  { key: 'last_3_hours', offsetMs: 3 * 60 * 60 * 1000 },
  { key: 'last_6_hours', offsetMs: 6 * 60 * 60 * 1000 },
  { key: 'last_1_day', offsetMs: 24 * 60 * 60 * 1000 },
  { key: 'last_1_week', offsetMs: 7 * 24 * 60 * 60 * 1000 },
] as const

// Calendar labels are resolved through i18n rather than dayjs locale data, so
// the picker stays translated regardless of the active dayjs locale.
const DAY_KEYS = ['day_su', 'day_mo', 'day_tu', 'day_we', 'day_th', 'day_fr', 'day_sa']
const MONTH_KEYS = Array.from({ length: 12 }, (_, i) => `month_${i + 1}`)

// ---------------------------------------------------------------------------
// Inline Mini-Calendar component
// ---------------------------------------------------------------------------

type CalendarProps = {
  selectedDate: dayjs.Dayjs | null   // the selected date (any time stripped)
  onSelect: (date: dayjs.Dayjs) => void
}

function InlineCalendar({ selectedDate, onSelect }: CalendarProps) {
  const { t } = useTranslation()
  const today = dayjs()

  // Calendar cursor — the month/year we're currently viewing
  const [cursor, setCursor] = useState<dayjs.Dayjs>(() => {
    return (selectedDate ?? today).startOf('month')
  })
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days')

  // Year range for year-picker (show 12 years per page)
  const [yearRangeStart, setYearRangeStart] = useState<number>(() =>
    Math.floor(cursor.year() / 12) * 12
  )

  const goToPrevMonth = () => setCursor((c) => c.subtract(1, 'month'))
  const goToNextMonth = () => setCursor((c) => c.add(1, 'month'))

  // Build calendar grid (6 rows × 7 cols)
  const startOfGrid = cursor.startOf('month').startOf('week')
  const cells: dayjs.Dayjs[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(startOfGrid.add(i, 'day'))
  }

  const selectMonth = (month: number) => {
    setCursor((c) => c.month(month))
    setViewMode('days')
  }

  const selectYear = (year: number) => {
    setCursor((c) => c.year(year))
    setViewMode('months')
  }

  // ── Header label (clickable to switch views) ──────────────────────────────
  const headerLabel =
    viewMode === 'years'
      ? `${yearRangeStart} – ${yearRangeStart + 11}`
      : viewMode === 'months'
        ? cursor.format('YYYY')
        : `${t(`as_of.calendar.${MONTH_KEYS[cursor.month()]}`)} ${cursor.format('YYYY')}`

  const handleHeaderClick = () => {
    if (viewMode === 'days') setViewMode('months')
    else if (viewMode === 'months') {
      setYearRangeStart(Math.floor(cursor.year() / 12) * 12)
      setViewMode('years')
    } else {
      setViewMode('days')
    }
  }

  const handlePrev = () => {
    if (viewMode === 'days') goToPrevMonth()
    else if (viewMode === 'months') setCursor((c) => c.subtract(1, 'year'))
    else setYearRangeStart((s) => s - 12)
  }

  const handleNext = () => {
    if (viewMode === 'days') goToNextMonth()
    else if (viewMode === 'months') setCursor((c) => c.add(1, 'year'))
    else setYearRangeStart((s) => s + 12)
  }

  // Shared header button style
  const navBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
  }

  return (
    <div style={{ userSelect: 'none' }}>
      {/* ── Month/year nav header ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <button
          style={navBtn}
          onClick={handlePrev}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              'rgba(255,255,255,0.08)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              'transparent')
          }
          aria-label={t('as_of.picker.previous')}
        >
          ‹
        </button>

        <button
          onClick={handleHeaderClick}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#e2e8f0',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: 6,
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              'rgba(0,131,116,0.2)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              'transparent')
          }
        >
          {headerLabel}
        </button>

        <button
          style={navBtn}
          onClick={handleNext}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              'rgba(255,255,255,0.08)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background =
              'transparent')
          }
          aria-label={t('as_of.picker.next')}
        >
          ›
        </button>
      </div>

      {/* ── Days view ─────────────────────────────────────────────── */}
      {viewMode === 'days' && (
        <>
          {/* Day-of-week labels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              marginBottom: 4,
            }}
          >
            {DAY_KEYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  color: '#64748b',
                  fontWeight: 600,
                  paddingBottom: 2,
                }}
              >
                {t(`as_of.calendar.${d}`)}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}
          >
            {cells.map((cell, i) => {
              const isCurrentMonth = cell.month() === cursor.month()
              const isSelected =
                selectedDate && cell.format('YYYY-MM-DD') === selectedDate.format('YYYY-MM-DD')
              const isToday = cell.format('YYYY-MM-DD') === today.format('YYYY-MM-DD')
              // A cell is "future" if it is strictly after today (date-only comparison)
              const isFuture = cell.isAfter(today, 'day')

              return (
                <button
                  key={i}
                  onClick={() => onSelect(cell)}
                  title={isFuture ? t('as_of.picker.future_cell') : undefined}
                  style={{
                    border: 'none',
                    borderRadius: 6,
                    width: '100%',
                    aspectRatio: '1',
                    fontSize: 12,
                    cursor: isFuture ? 'not-allowed' : 'pointer',
                    fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                    background: isSelected
                      ? 'var(--color-primary, #008374)'
                      : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : isFuture
                        ? '#1e3a4a'
                        : isToday
                          ? '#34d399'
                          : isCurrentMonth
                            ? '#cbd5e1'
                            : '#334155',
                    outline: isToday && !isSelected
                      ? '1px solid rgba(52,211,153,0.5)'
                      : 'none',
                    opacity: isFuture ? 0.35 : 1,
                    transition: 'background 0.12s, color 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isFuture)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(0,131,116,0.25)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isFuture)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'transparent'
                  }}
                >
                  {cell.date()}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Month picker view ─────────────────────────────────────── */}
      {viewMode === 'months' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {MONTH_KEYS.map((monthKey, idx) => {
            const isCurrent = idx === cursor.month()
            return (
              <button
                key={monthKey}
                onClick={() => selectMonth(idx)}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 4px',
                  fontSize: 11,
                  fontWeight: isCurrent ? 700 : 400,
                  cursor: 'pointer',
                  background: isCurrent
                    ? 'var(--color-primary, #008374)'
                    : 'transparent',
                  color: isCurrent ? '#fff' : '#cbd5e1',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(0,131,116,0.25)'
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'transparent'
                }}
              >
                {t(`as_of.calendar.${monthKey}`).slice(0, 3)}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Year picker view ──────────────────────────────────────── */}
      {viewMode === 'years' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((yr) => {
            const isCurrent = yr === cursor.year()
            return (
              <button
                key={yr}
                onClick={() => selectYear(yr)}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 4px',
                  fontSize: 11,
                  fontWeight: isCurrent ? 700 : 400,
                  cursor: 'pointer',
                  background: isCurrent
                    ? 'var(--color-primary, #008374)'
                    : 'transparent',
                  color: isCurrent ? '#fff' : '#cbd5e1',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(0,131,116,0.25)'
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'transparent'
                }}
              >
                {yr}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dropdown
// ---------------------------------------------------------------------------

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function AsOfDropdown({ isOpen, onClose }: Props) {
  const { asOfDate, setAsOfDate, clearSnapshot } = useAsOf()
  const { t } = useTranslation()

  // Selected calendar date (day only) and time string "HH:mm"
  const [selectedDay, setSelectedDay] = useState<dayjs.Dayjs | null>(null)
  const [timeValue, setTimeValue] = useState<string>('00:00')

  // Sync state when dropdown opens
  useEffect(() => {
    if (!isOpen) return
    if (asOfDate) {
      const d = dayjs.utc(asOfDate).local()
      setSelectedDay(d.startOf('day'))
      setTimeValue(d.format('HH:mm'))
    } else {
      setSelectedDay(null)
      setTimeValue('00:00')
    }
  }, [isOpen, asOfDate])

  const panelRef = useRef<HTMLDivElement | null>(null)

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // When user clicks a date in the calendar → select it, default time to 00:00
  const handleDaySelect = (day: dayjs.Dayjs) => {
    setSelectedDay(day.startOf('day'))
    setTimeValue('00:00')
  }

  // True when the fully-composed datetime (day + time) is in the future
  const isFutureDateTime = (() => {
    if (!selectedDay) return false
    const [hh, mm] = timeValue.split(':').map(Number)
    const local = selectedDay.hour(hh ?? 0).minute(mm ?? 0).second(0).millisecond(0)
    return local.isAfter(dayjs())
  })()

  const handleApply = () => {
    if (!selectedDay || isFutureDateTime) return
    const [hh, mm] = timeValue.split(':').map(Number)
    const local = selectedDay.hour(hh ?? 0).minute(mm ?? 0).second(0).millisecond(0)
    setAsOfDate(local.utc().toISOString())
    onClose()
  }

  const handleClear = () => {
    clearSnapshot()
    setSelectedDay(null)
    setTimeValue('00:00')
    onClose()
  }

  const handlePreset = (offsetMs: number) => {
    const iso = new Date(Date.now() - offsetMs).toISOString()
    setAsOfDate(iso)
    onClose()
  }

  // Human-readable preview of what will be applied
  const preview = selectedDay && !isFutureDateTime
    ? t('as_of.picker.preview', {
        date: selectedDay.format('MMM D, YYYY'),
        time: timeValue,
      })
    : null

  return (
    <div
      ref={panelRef}
      className="absolute left-1/2 top-full z-[9000] mt-1 -translate-x-1/2"
    >
      <div
        className="flex overflow-hidden rounded-xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1a2e3b 0%, #0f1f2e 100%)',
          border: '1px solid rgba(0,131,116,0.35)',
        }}
      >
        {/* ── Left column: inline calendar ─────────────────────────── */}
        <div
          className="flex flex-col gap-3 p-5"
          style={{ width: 284, borderRight: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}
        >
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: '#7dd3c8', letterSpacing: '0.04em' }}
            >
              {t('as_of.picker.title')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {t('as_of.picker.subtitle')}
            </p>
          </div>

          {/* Inline calendar — always visible, no popups */}
          <InlineCalendar selectedDate={selectedDay} onSelect={handleDaySelect} />

          {/* ── Time input (shown after a date is selected) ─────────── */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.07)',
              paddingTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={selectedDay ? '#7dd3c8' : '#334155'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              disabled={!selectedDay}
              style={{
                flex: 1,
                background: selectedDay ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedDay ? 'rgba(0,131,116,0.5)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                color: selectedDay ? '#e2e8f0' : '#475569',
                fontSize: 13,
                padding: '5px 10px',
                outline: 'none',
                colorScheme: 'dark',
                cursor: selectedDay ? 'text' : 'not-allowed',
                transition: 'border-color 0.15s, color 0.15s',
              }}
            />
          </div>

          {/* Preview label */}
          <div
            style={{
              minHeight: 18,
              fontSize: 11,
              color: preview ? '#7dd3c8' : 'transparent',
              letterSpacing: '0.02em',
              transition: 'color 0.15s',
            }}
          >
            {preview ?? '–'}
          </div>

          {/* Future-date warning */}
          {isFutureDateTime && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 8,
                marginBottom: 2,
              }}
            >
              {/* Warning icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f87171"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>
                  {t('as_of.picker.future_title')}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(252,165,165,0.85)', lineHeight: 1.5 }}>
                  {t('as_of.picker.future_detail')}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onPress={handleApply}
              isDisabled={!selectedDay || isFutureDateTime}
              style={{
                background:
                  selectedDay && !isFutureDateTime
                    ? 'var(--color-primary, #008374)'
                    : 'rgba(0,131,116,0.2)',
                color: selectedDay && !isFutureDateTime ? '#fff' : '#475569',
                flex: 1,
                transition: 'background 0.15s',
              }}
            >
              {t('general.apply')}
            </Button>
            <Button
              size="sm"
              variant="bordered"
              onPress={handleClear}
              style={{
                borderColor: 'rgba(255,255,255,0.15)',
                color: '#94a3b8',
                flex: 1,
              }}
            >
              {t('as_of.picker.clear_exit')}
            </Button>
          </div>
        </div>

        {/* ── Right column: quick presets ───────────────────────────── */}
        <div className="flex flex-col gap-1 p-4" style={{ minWidth: 168 }}>
          <p
            className="mb-1 text-xs font-semibold"
            style={{ color: '#7dd3c8', letterSpacing: '0.04em' }}
          >
            {t('as_of.picker.quick_times')}
          </p>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handlePreset(preset.offsetMs)}
              className="rounded-lg px-3 py-1.5 text-left text-xs transition-colors"
              style={{ color: '#cbd5e1' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  'rgba(0,131,116,0.25)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background =
                  'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1'
              }}
            >
              {t(`as_of.quick_times.${preset.key}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
