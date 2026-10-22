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
 * @file app/history/[...entity]/HistoryPage.tsx
 *
 * The entity history page.
 *
 * `$from_to` gets a route rather than a mode. `$as_of` re-reads the whole
 * application at one instant, which is why it earned a navbar pill and a
 * banner; `$from_to` cannot do that — the API rejects every expand but
 * `Commit`, and it answers with many rows for one entity rather than one state
 * for many. So this is a page you open on one entity and leave with the back
 * button, and nothing here claims the application is being re-read.
 *
 * All page state lives in the URL — the entity path, the window, and (once the
 * diff arrives) the two compared versions. That makes the page a link worth
 * pasting into an issue, which is the point of an extension built for citable
 * data.
 */

import { Button } from '@heroui/button'
import { Spinner } from '@heroui/spinner'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import CompareBar from '@/features/from-to/components/CompareBar'
import EntityRail from '@/features/from-to/components/EntityRail'
import VersionDiff from '@/features/from-to/components/VersionDiff'
import {
  changedOnly,
  diffVersions,
  filterByPath,
  groupChanges,
} from '@/features/from-to/lib/diffVersions'
import VersionRail from '@/features/from-to/components/VersionRail'
import VersionTimeline from '@/features/from-to/components/VersionTimeline'
import { useEntityHistory } from '@/features/from-to/hooks/useEntityHistory'
import { useRelatedEntities } from '@/features/from-to/hooks/useRelatedEntities'
import { entitySetOf } from '@/features/from-to/lib/entityPath'
import {
  reachesPresent,
  type HistoryWindow,
} from '@/features/from-to/lib/historyWindow'
import {
  looksDeleted,
  type EntityVersion,
} from '@/features/from-to/lib/versionRows'
import {
  isVersionedSet,
  singularOf,
  titleOf,
} from '@/features/from-to/lib/versionedEntities'
import CommitAuthor from '@/features/users/components/CommitAuthor'

dayjs.extend(utc)

function formatInstant(iso: string): string {
  const parsed = dayjs.utc(iso)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') + 'Z' : iso
}

export type HistoryPageProps = {
  /** Resource path, e.g. `Things(1)`. */
  path: string
  window: HistoryWindow | null
  /** Set when the URL carried a window the API would have rejected. */
  windowError: string | null
  /**
   * Compared versions from the URL, as zero-based positions, or null to open on
   * the default of first-versus-last. Out-of-range values are clamped once the
   * versions are in hand, so a stale link degrades instead of breaking.
   */
  initialA: number | null
  initialB: number | null
}

export default function HistoryPage({
  path,
  window,
  windowError,
  initialA,
  initialB,
}: HistoryPageProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  /**
   * Language is detected in the browser, so every `t()` here would render one
   * string on the server and possibly another on the client — a hydration
   * mismatch for the whole page. The Navbar guards its language-dependent
   * markup the same way. Nothing is lost by waiting: the versions are fetched
   * client-side, so the server could only ever render the loading state anyway.
   */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { versions, loading, error, hasMore, total } = useEntityHistory(path, window)
  const related = useRelatedEntities(path, window)

  /**
   * Which two versions are being compared, as positions in `versions`.
   *
   * Defaults to first-versus-last: the window itself is the question the reader
   * asked, so "what changed across it" is the answer to open on. `initialA` and
   * `initialB` come from the URL, which is what makes a particular comparison
   * linkable — "here is the exact change I mean".
   */
  const [selection, setSelection] = useState<{ a: number; b: number } | null>(
    // `!= null` on purpose: an absent prop arrives as undefined, and a strict
    // `!== null` lets it through — which built a selection of two undefineds
    // and put NaN in the URL.
    initialA != null && initialB != null ? { a: initialA, b: initialB } : null,
  )

  const lastIndex = Math.max(versions.length - 1, 0)
  /** Anything unreadable falls back to the first version rather than to NaN. */
  const clamp = (index: number) =>
    Number.isFinite(index) ? Math.min(Math.max(index, 0), lastIndex) : 0

  const indexA = selection ? clamp(selection.a) : 0
  const indexB = selection ? clamp(selection.b) : lastIndex

  /**
   * Mirror the comparison into the URL without a navigation.
   *
   * `router.replace` would re-request the server component on every click; this
   * only rewrites the address, which is all the URL is doing here — the page
   * already holds the data. `replaceState` also keeps comparisons out of the
   * back stack, so Back leaves the page rather than walking every pair.
   */
  useEffect(() => {
    if (!mounted || versions.length === 0) return

    const url = new URL(globalThis.location.href)

    if (versions.length < 2) {
      // Nothing to compare, so a pair is noise — and worse than noise later: a
      // link saved while an entity had one version would pin both sides to it,
      // so reopening after an edit would report "both sides are the same
      // version" instead of showing the change. Clear any stale pair too.
      url.searchParams.delete('a')
      url.searchParams.delete('b')
    } else {
      url.searchParams.set('a', String(indexA + 1))
      url.searchParams.set('b', String(indexB + 1))
    }

    globalThis.history.replaceState(null, '', url)
  }, [mounted, indexA, indexB, versions.length])

  /** Picking a version makes it the right-hand side and demotes the old one. */
  const pickVersion = (index: number) => {
    if (index === indexB) return
    setSelection({ a: indexB, b: index })
  }

  const selectSide = (side: 'a' | 'b', index: number) =>
    setSelection({ a: side === 'a' ? index : indexA, b: side === 'b' ? index : indexB })

  const swapSides = () => setSelection({ a: indexB, b: indexA })

  // ── the diff ───────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState('')
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const allChanges = useMemo(() => {
    if (versions.length < 2) return []
    return diffVersions(versions[indexA]?.body ?? {}, versions[indexB]?.body ?? {})
  }, [versions, indexA, indexB])

  const changed = useMemo(() => changedOnly(allChanges), [allChanges])

  const diffGroups = useMemo(() => {
    const visible = showUnchanged ? allChanges : changed
    return groupChanges(filterByPath(visible, filter))
  }, [allChanges, changed, showUnchanged, filter])

  /** Why the diff is empty, when it is — each case gets its own explanation. */
  const diffEmpty = useMemo(() => {
    if (versions.length < 2) {
      return {
        title: t('from_to.diff.single_title'),
        body: t('from_to.diff.single_body'),
      }
    }
    if (indexA === indexB) {
      return {
        title: t('from_to.diff.same_title'),
        body: t('from_to.diff.same_body'),
      }
    }
    if (changed.length === 0) {
      return {
        title: t('from_to.diff.identical_title'),
        body: t('from_to.diff.identical_body'),
      }
    }
    if (diffGroups.length === 0) {
      return {
        title: t('from_to.diff.no_match_title'),
        body: t('from_to.diff.no_match_body', { count: changed.length }),
      }
    }
    return null
  }, [versions.length, indexA, indexB, changed.length, diffGroups.length, t])

  const openEntity = (nextPath: string) => {
    if (!window) return
    const query = new URLSearchParams({ from: window.from, to: window.to })
    router.push(`/history/${nextPath}?${query.toString()}`)
  }

  const entitySet = entitySetOf(path)
  const kind = singularOf(entitySet)

  /**
   * The heading comes from the newest version rather than from the caller, so a
   * pasted link names its entity without needing the map's state. How to read
   * it differs by type: most carry `name`, but a HistoricalLocation is its
   * `time` and an Observation its result and phenomenonTime.
   */
  const entityName = useMemo(
    () => titleOf(entitySet, versions[versions.length - 1]?.body ?? null),
    [entitySet, versions],
  )

  /**
   * Whether the window holds more versions than were returned.
   *
   * `hasMore` alone would do, but the count is what makes the message useful,
   * so both have to be present before the truncated wording is used.
   */
  const truncated =
    hasMore && typeof total === 'number' && total > versions.length

  const deleted = useMemo(
    () =>
      window ? looksDeleted(versions, reachesPresent(window), truncated) : false,
    [versions, window, truncated],
  )

  const copyLink = () => {
    navigator.clipboard?.writeText(globalThis.location.href).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => undefined,
    )
  }

  /* The root layout paints <body> with the primary teal, which the map page
     covers edge to edge. This page does not, so it brings its own surface —
     otherwise the teal shows through and `text-primary` links vanish into it. */
  const surface = 'min-h-[calc(100vh-3.5rem)] w-full bg-background'
  /* Full window width: field values are the point of this page, and a centred
     column left most of a wide screen empty while they were cut off. Shared by
     the loading and loaded states so the page does not jump when data lands. */
  const column = 'w-full px-4 py-5 lg:px-6'

  if (!mounted) {
    return (
      <div className={surface}>
        <main className={column}>
          <div className="flex items-center justify-center rounded-xl border border-default-200 bg-content1 px-6 py-16">
            <Spinner size="sm" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={surface}>
      <main className={column}>
      <nav className="flex items-center gap-2 text-tiny text-default-500">
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={() => router.push('/')}
        >
          ← {t('from_to.page.back_to_map')}
        </button>
        <span>/</span>
        <span>{t('from_to.page.breadcrumb')}</span>
        <span>/</span>
        <span className="font-mono">{path}</span>
      </nav>

      <header className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="truncate">
              {entityName || (loading ? '…' : path)}
            </span>
            {/* Only for types the registry knows: for anything else `kind`
                falls back to the set name, and a plural in a singular chip
                reads as a bug. */}
            {isVersionedSet(entitySet) && kind && (
              <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {kind}
              </span>
            )}
            {deleted && (
              <span className="rounded-md border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
                {t('from_to.page.deleted')}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-tiny text-default-500">
            {/* When the window holds more than one page, say how many were
                returned out of how many exist — a bare "there are more" gives
                the reader nothing to decide with. Deliberately not "newest N":
                the API returns them oldest-first, so these are the earliest
                versions, and claiming otherwise would be wrong. */}
            {loading
              ? t('from_to.page.loading')
              : truncated
                ? t('from_to.page.version_count_truncated', {
                    shown: versions.length,
                    total,
                  })
                : t('from_to.page.version_count', { count: versions.length })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {window && (
            <span className="rounded-lg border border-default-200 bg-default-100 px-2.5 py-1.5 font-mono text-tiny">
              <span className="font-semibold text-primary">
                {t('from_to.page.from_label')}
              </span>{' '}
              {formatInstant(window.from)}{' '}
              <span className="font-semibold text-primary">
                {t('from_to.page.to_label')}
              </span>{' '}
              {formatInstant(window.to)}
            </span>
          )}
          <Button size="sm" variant="bordered" onPress={copyLink}>
            {copied ? t('from_to.page.copied') : t('from_to.page.copy_link')}
          </Button>
        </div>
      </header>

      <section className="mt-5 rounded-xl border border-default-200 bg-content1">
        {!isVersionedSet(entitySet) ? (
          /* Commit is the one an eager link is likely to reach: it causes
             versions rather than having them, and the API answers 400. */
          <Message
            tone="danger"
            title={t('from_to.page.not_versioned_title')}
            body={t('from_to.page.not_versioned_body', { set: entitySet ?? path })}
          />
        ) : windowError ? (
          <Message tone="danger" title={t('from_to.page.bad_window')} body={windowError} />
        ) : loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-default-500">
            <Spinner size="sm" />
            <span className="text-small">{t('from_to.page.loading')}</span>
          </div>
        ) : error ? (
          <Message tone="danger" title={t('from_to.page.load_failed')} body={error} />
        ) : versions.length === 0 ? (
          <Message
            tone="default"
            title={t('from_to.page.empty_title')}
            body={t('from_to.page.empty_body')}
          />
        ) : (
          /* Three regions: what else changed, this entity's versions, and the
             comparison between two of them. The diff pane lands in Group 6. */
          /* The side rails only sit beside the comparison from xl: between lg
             and xl they left it ~530px, too narrow for its values, so below
             xl the regions stack and the comparison takes the full width. */
          <div className="grid grid-cols-1 xl:grid-cols-[200px_minmax(0,1fr)_260px]">
            <EntityRail
              groups={related.groups}
              changes={related.changes}
              loading={related.loading}
              currentPath={path}
              window={window!}
              onOpen={openEntity}
            />

            <div className="min-w-0">
              {/* The compare row leads: it is the one control for choosing the
                  two sides, and the timeline below only shows where they sit. */}
              <CompareBar
                versions={versions}
                indexA={indexA}
                indexB={indexB}
                onSelect={selectSide}
                onSwap={swapSides}
                filter={filter}
                onFilterChange={setFilter}
                showUnchanged={showUnchanged}
                onToggleUnchanged={() => setShowUnchanged((on) => !on)}
                changedCount={changed.length}
              />

              <VersionTimeline
                versions={versions}
                windowEnd={window!.to}
                indexA={indexA}
                indexB={indexB}
              />

              <VersionDetail
                version={versions[indexB]}
                presentLabel={t('from_to.page.present')}
              />

              <VersionDiff
                groups={diffGroups}
                numberA={indexA + 1}
                numberB={indexB + 1}
                collapsed={collapsed}
                onToggleGroup={(key) =>
                  setCollapsed((current) => ({ ...current, [key]: !current[key] }))
                }
                empty={diffEmpty}
              />
            </div>

            <VersionRail
              versions={versions}
              indexA={indexA}
              indexB={indexB}
              onPick={pickVersion}
            />
          </div>
        )}
        </section>
      </main>
    </div>
  )
}

/**
 * The selected version's own facts, above the diff — when it was in force, and
 * the commit that produced it.
 */
function VersionDetail({
  version,
  presentLabel,
}: {
  version: EntityVersion | undefined
  presentLabel: string
}) {
  if (!version) return null

  const cells: Array<[string, string, boolean]> = [
    ['Valid from', formatInstant(version.validity.start), true],
    [
      'Valid until',
      version.validity.end ? formatInstant(version.validity.end) : presentLabel,
      true,
    ],
    ['Action', version.commit?.actionType ?? '—', false],
    ['Commit', version.commit ? `#${version.commit['@iot.id']}` : '—', true],
    ['Author', version.commit?.author ?? '—', true],
    ['Message', version.commit?.message ?? '—', false],
  ]

  return (
    <dl className="grid grid-cols-1 gap-px border-b border-default-100 bg-default-100 sm:grid-cols-3">
      {cells.map(([label, value, mono]) => (
        <div key={label} className="min-w-0 bg-content1 px-3.5 py-2">
          <dt className="text-[9px] font-bold uppercase tracking-wider text-default-400">
            {label}
          </dt>
          {/* Wrapped, not truncated: a commit message is the part that says
              why the version exists. Long unbroken tokens may break anywhere. */}
          <dd
            className={`whitespace-pre-wrap text-tiny [overflow-wrap:anywhere] ${mono ? 'font-mono' : ''}`}
            title={value}
          >
            {label === 'Author' && version.commit?.author ? (
              <CommitAuthor author={version.commit.author} />
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Message({
  tone,
  title,
  body,
}: {
  tone: 'danger' | 'default'
  title: string
  body: string
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p
        className={`text-small font-semibold ${
          tone === 'danger' ? 'text-danger' : 'text-default-700'
        }`}
      >
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-[52ch] text-tiny text-default-500">{body}</p>
    </div>
  )
}
