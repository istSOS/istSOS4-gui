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
 * @file features/from-to/components/VersionRail.tsx
 *
 * The list of versions down the side of the history page, newest first.
 *
 * Each row is one version with the commit that produced it — author, message
 * and action — which is the part that explains *why* a field changed rather
 * than only that it did. Every version carries its own commit because the
 * response was read with `$expand=Commit`, the one expand `$from_to` accepts.
 *
 * The newest version is labelled CURRENT rather than by its action, since
 * "still in force" is what a reader is actually checking for. A deleted entity
 * has no such row: the version carrying its DELETE commit is written with an
 * empty range and is unreachable through `$from_to`.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTranslation } from 'react-i18next'

import { versionKey, type EntityVersion } from '@/features/from-to/lib/versionRows'

dayjs.extend(utc)

const ACTION_DOT: Record<string, string> = {
  CREATE: 'bg-success',
  UPDATE: 'bg-warning',
  DELETE: 'bg-danger',
}

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'bg-success/10 text-success',
  UPDATE: 'bg-warning/10 text-warning',
  DELETE: 'bg-danger/10 text-danger',
}

export type VersionRailProps = {
  versions: EntityVersion[]
  indexA: number
  indexB: number
  onPick: (index: number) => void
}

export default function VersionRail({
  versions,
  indexA,
  indexB,
  onPick,
}: VersionRailProps) {
  const { t } = useTranslation()

  return (
    <aside
      className="border-default-100 bg-default-50 xl:border-l"
      aria-label={t('from_to.rail.versions')}
    >
      <div className="px-3.5 pb-2 pt-3">
        <p className="text-small font-bold">{t('from_to.rail.versions')}</p>
        <p className="text-tiny text-default-400">{t('from_to.rail.versions_hint')}</p>
      </div>

      <ul className="max-h-[420px] overflow-y-auto px-2 pb-3">
        {versions
          .map((version, index) => ({ version, index }))
          .reverse()
          .map(({ version, index }) => {
            const open = version.validity.end === null
            const action = version.commit?.actionType ?? ''
            const isA = index === indexA
            const isB = index === indexB

            return (
              <li key={versionKey(version)}>
                <button
                  type="button"
                  onClick={() => onPick(index)}
                  aria-pressed={isB}
                  className={[
                    'grid w-full grid-cols-[12px_minmax(0,1fr)] gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
                    isB
                      ? 'border-primary/40 bg-primary/10'
                      : isA
                        ? 'border-default-200 bg-default-100'
                        : 'border-transparent hover:bg-default-100',
                  ].join(' ')}
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 rounded-full ${ACTION_DOT[action] ?? 'bg-default-300'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span
                      className={[
                        'float-right ml-1.5 rounded px-1.5 py-px text-[8.5px] font-bold tracking-wide',
                        open
                          ? 'bg-primary/10 text-primary'
                          : (ACTION_BADGE[action] ?? 'bg-default-100 text-default-500'),
                      ].join(' ')}
                    >
                      {open ? t('from_to.rail.current') : action}
                    </span>
                    <span className="block font-mono text-tiny font-semibold">
                      {dayjs.utc(version.validity.start).format('MM-DD HH:mm:ss')}Z
                    </span>
                    {version.commit && (
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-default-400">
                        #{version.commit['@iot.id']} · {version.commit.author}
                      </span>
                    )}
                    {version.commit?.message && (
                      <span className="mt-1 block text-[10.5px] text-default-500">
                        {version.commit.message}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
      </ul>
    </aside>
  )
}
