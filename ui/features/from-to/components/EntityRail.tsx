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
 * @file features/from-to/components/EntityRail.tsx
 *
 * The related entities of whatever the history page is showing.
 *
 * This is how the other versioned types are reached: a Thing's page lists its
 * Locations, HistoricalLocations and Datastreams; a Datastream's lists its
 * Thing, Sensor, ObservedProperty and Observations. Relations come from the
 * entity's own navigation links, so no type needs a special case, and each row
 * links to that entity's OWN path — never through the parent, which `$from_to`
 * cannot read reliably.
 *
 * A row showing no versions in the window is kept rather than hidden: "this
 * sensor did not change" is an answer, and a gap is not.
 */

import { Spinner } from '@heroui/spinner'
import { useTranslation } from 'react-i18next'

import { singularOf } from '@/features/from-to/lib/versionedEntities'
import type {
  RelatedGroup,
  RelationChanges,
} from '@/features/from-to/hooks/useRelatedEntities'

export type EntityRailProps = {
  groups: RelatedGroup[]
  /** Change counts of the relations too large to list, by relation name. */
  changes: RelationChanges
  loading: boolean
  /** Path of the entity currently being shown, so its row reads as selected. */
  currentPath: string
  window: { from: string; to: string }
  onOpen: (path: string) => void
}

export default function EntityRail({
  groups,
  changes,
  loading,
  currentPath,
  onOpen,
}: EntityRailProps) {
  const { t, i18n } = useTranslation()
  // Totals run to six figures; group their digits the way the page's language does.
  const formatCount = (value: number) =>
    new Intl.NumberFormat(i18n.language || undefined).format(value)

  return (
    <nav
      className="border-default-100 bg-default-50 xl:border-r"
      aria-label={t('from_to.rail.related')}
    >
      <div className="px-3.5 pb-1 pt-3">
        <p className="text-tiny font-bold uppercase tracking-wider text-default-500">
          {t('from_to.rail.related')}
        </p>
      </div>

      {loading && groups.length === 0 ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : groups.length === 0 ? (
        <p className="px-3.5 py-3 text-tiny text-default-400">
          {t('from_to.rail.no_related')}
        </p>
      ) : (
        <div className="pb-3">
          {groups.map((group) => (
            <div key={group.relation}>
              <p className="px-3.5 pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-wider text-default-400">
                {group.relation}
              </p>

              {/* Some relations are far too large to enumerate — a datastream
                  can hold thousands of observations. Instead of the rows, how
                  many times they changed in the window, where that can be
                  counted exactly; otherwise just the size of the relation. */}
              {group.tooMany && (
                <LargeRelation
                  total={group.total ?? 0}
                  change={group.countable ? changes[group.relation] : undefined}
                  formatCount={formatCount}
                />
              )}

              <ul className="px-1.5">
                {group.items.map((item) => {
                  const isCurrent = item.path === currentPath
                  const empty = item.count === 0

                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        onClick={() => onOpen(item.path)}
                        aria-current={isCurrent ? 'page' : undefined}
                        title={item.path}
                        className={[
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-tiny transition-colors',
                          isCurrent
                            ? 'border-primary/40 bg-primary/10 font-semibold text-primary'
                            : empty
                              ? 'border-transparent text-default-400 hover:bg-default-100'
                              : 'border-transparent hover:bg-default-100',
                        ].join(' ')}
                      >
                        <span className="truncate">
                          {item.name || `${singularOf(group.set)} ${item.id}`}
                        </span>
                        <span
                          className={[
                            'shrink-0 rounded-full px-1.5 font-mono text-[10px] font-semibold',
                            isCurrent
                              ? 'bg-white text-primary'
                              : empty
                                ? 'text-default-400'
                                : 'bg-default-200 text-default-600',
                          ].join(' ')}
                        >
                          {item.count ?? '–'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-1 border-t border-default-100 px-3.5 py-2.5 text-[10px] leading-relaxed text-default-400">
        {t('from_to.rail.counts_note')}
      </p>
    </nav>
  )
}

/**
 * A relation too large to list: its size, and how many times its members
 * changed inside the window — edits and deletions — once that is counted.
 * Without an exact count (none possible, failed or timed out) it says only
 * how large the relation is, never a guessed number.
 */
function LargeRelation({
  total,
  change,
  formatCount,
}: {
  total: number
  change: RelationChanges[string] | undefined
  formatCount: (value: number) => string
}) {
  const { t } = useTranslation()
  const n = formatCount(total)

  if (!change || (change.status === 'done' && change.value === null)) {
    return (
      <p className="px-3.5 pb-1.5 text-tiny text-default-400">
        {t('from_to.rail.too_many', { count: total, n })}
      </p>
    )
  }

  const counted = change.status === 'done' ? change.value : null

  return (
    <div className="px-3.5 pb-1.5">
      <div className="flex items-center justify-between gap-2 text-tiny">
        <span className="min-w-0 text-default-600">
          {t('from_to.rail.total', { count: total, n })}
        </span>
        {counted === null ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-default-400">
            <Spinner size="sm" classNames={{ wrapper: 'h-3 w-3' }} />
            {t('from_to.rail.counting')}
          </span>
        ) : counted === 0 ? (
          <span className="shrink-0 rounded-full bg-default-200 px-1.5 text-[10px] font-semibold text-default-600">
            {t('from_to.rail.no_changes')}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-warning-100 px-2 text-[10px] font-bold text-warning-800">
            {t('from_to.rail.changes', { count: counted, n: formatCount(counted) })}
          </span>
        )}
      </div>
      {counted !== null && counted > 0 && (
        <p className="mt-1 text-[10.5px] leading-snug text-default-400">
          {t('from_to.rail.changes_hint')}
        </p>
      )}
    </div>
  )
}
