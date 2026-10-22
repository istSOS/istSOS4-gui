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

/**
 * @file features/from-to/components/CompareBar.tsx
 *
 * Which two versions the diff below is comparing, and how much of it to show.
 *
 * Sticky, because a datastream diff runs past a screen once
 * `unitOfMeasurement` and `observedArea` move: the two selects have to stay
 * readable while scrolling the fields they describe.
 *
 * The two sides are deliberately not forced into chronological order. Reading a
 * change backwards — newest on the left — is a legitimate thing to want, so
 * each side is labelled with its version number and date and any pair is
 * allowed.
 *
 * Native selects rather than HeroUI's: this is a dense toolbar, and a popover
 * listbox for "version 3 of 5" costs more than it gives.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTranslation } from 'react-i18next'

import { versionKey, type EntityVersion } from '@/features/from-to/lib/versionRows'

dayjs.extend(utc)

const SELECT_CLASS =
  'rounded-lg border border-default-200 bg-content1 px-2 py-1 font-mono text-tiny ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50'

export type CompareBarProps = {
  versions: EntityVersion[]
  indexA: number
  indexB: number
  onSelect: (side: 'a' | 'b', index: number) => void
  onSwap: () => void
  filter: string
  onFilterChange: (value: string) => void
  showUnchanged: boolean
  onToggleUnchanged: () => void
  /** How many fields differ between the two selected versions. */
  changedCount: number
}

export default function CompareBar({
  versions,
  indexA,
  indexB,
  onSelect,
  onSwap,
  filter,
  onFilterChange,
  showUnchanged,
  onToggleUnchanged,
  changedCount,
}: CompareBarProps) {
  const { t } = useTranslation()
  const comparable = versions.length > 1

  const optionLabel = (version: EntityVersion, index: number) => {
    const stamp = dayjs.utc(version.validity.start).format('MM-DD HH:mm')
    const current = version.validity.end === null
      ? ` (${t('from_to.compare.current')})`
      : ''
    return `${t('from_to.timeline.version_n', { number: index + 1 })} · ${stamp}Z${current}`
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-default-200 bg-default-50 px-4 py-2">
      <span className="text-tiny font-semibold text-default-600">
        {t('from_to.compare.label')}
      </span>

      <select
        className={SELECT_CLASS}
        aria-label={t('from_to.compare.base_version')}
        value={indexA}
        disabled={!comparable}
        onChange={(event) => onSelect('a', Number(event.target.value))}
      >
        {versions.map((version, index) => (
          <option key={`a-${versionKey(version)}`} value={index}>
            {optionLabel(version, index)}
          </option>
        ))}
      </select>

      <span aria-hidden="true" className="text-default-400">
        →
      </span>

      <select
        className={SELECT_CLASS}
        aria-label={t('from_to.compare.compared_version')}
        value={indexB}
        disabled={!comparable}
        onChange={(event) => onSelect('b', Number(event.target.value))}
      >
        {versions.map((version, index) => (
          <option key={`b-${versionKey(version)}`} value={index}>
            {optionLabel(version, index)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onSwap}
        disabled={!comparable}
        aria-label={t('from_to.compare.swap')}
        title={t('from_to.compare.swap')}
        className="rounded-lg border border-default-200 bg-content1 px-2 py-1 text-tiny disabled:opacity-50"
      >
        ⇄
      </button>

      <span className="ml-auto flex items-center gap-2">
        <span className="text-tiny text-default-500">
          {t('from_to.compare.changed_count', { count: changedCount })}
        </span>

        <input
          type="search"
          value={filter}
          disabled={!comparable}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder={t('from_to.compare.filter_placeholder')}
          aria-label={t('from_to.compare.filter_placeholder')}
          className="w-32 rounded-lg border border-default-200 bg-content1 px-2 py-1 text-tiny focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={onToggleUnchanged}
          disabled={!comparable}
          aria-pressed={showUnchanged}
          className={[
            'rounded-full border px-2.5 py-1 text-tiny font-semibold transition-colors disabled:opacity-50',
            showUnchanged
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-default-200 bg-content1 text-default-600',
          ].join(' ')}
        >
          {showUnchanged
            ? t('from_to.compare.hide_unchanged')
            : t('from_to.compare.show_unchanged')}
        </button>
      </span>
    </div>
  )
}
