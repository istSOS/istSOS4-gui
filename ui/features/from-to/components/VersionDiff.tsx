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
 * @file features/from-to/components/VersionDiff.tsx
 *
 * What changed between the two selected versions, field by field.
 *
 * Every version's whole body arrived in the same `$from_to` response, so this
 * is a local comparison — no request per pair, and the pane can update while a
 * selection is dragged.
 *
 * Fields are grouped by their top-level key, which is what makes a unit
 * correction read as three related edits under `unitOfMeasurement` rather than
 * three unrelated rows. Values wrap, so an interval, a URL or a description
 * reads in full; a value too long to be worth wrapping in place — a polygon's
 * `observedArea.coordinates` is one leaf — stops at a fixed height and scrolls
 * inside its own cell, so it can neither push the page sideways nor bury the
 * rows below it.
 */

import { useTranslation } from 'react-i18next'

import {
  CORE_FIELDS_GROUP,
  formatValue,
  type ChangeGroup,
  type ChangeKind,
  type FieldChange,
} from '@/features/from-to/lib/diffVersions'

const KIND_CHIP: Record<ChangeKind, string> = {
  modified: 'bg-warning/10 text-warning',
  added: 'bg-success/10 text-success',
  removed: 'bg-danger/10 text-danger',
  unchanged: 'bg-default-100 text-default-400',
}

const VALUE_TONE: Record<'old' | 'new' | 'flat' | 'absent', string> = {
  old: 'bg-danger/10 text-danger',
  new: 'bg-success/10 text-success',
  flat: 'bg-default-100 text-default-500',
  absent: 'text-default-300',
}

export type VersionDiffProps = {
  groups: ChangeGroup[]
  /** 1-based numbers of the compared versions, for the column headings. */
  numberA: number
  numberB: number
  collapsed: Record<string, boolean>
  onToggleGroup: (key: string) => void
  /** Rendered when there is nothing to show, with the reason. */
  empty: { title: string; body: string; action?: React.ReactNode } | null
}

export default function VersionDiff({
  groups,
  numberA,
  numberB,
  collapsed,
  onToggleGroup,
  empty,
}: VersionDiffProps) {
  const { t } = useTranslation()

  if (empty) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="text-small font-semibold text-default-700">{empty.title}</p>
        <p className="mx-auto mt-1.5 max-w-[52ch] text-tiny text-default-500">
          {empty.body}
        </p>
        {empty.action && <div className="mt-4">{empty.action}</div>}
      </div>
    )
  }

  return (
    <div className="grid gap-2.5 px-4 py-3">
      {groups.map((group) => {
        const isClosed = !!collapsed[group.key]
        const heading =
          group.key === CORE_FIELDS_GROUP
            ? t('from_to.diff.core_fields')
            : group.key

        return (
          <section
            key={group.key}
            className="overflow-hidden rounded-xl border border-default-100"
          >
            <h3>
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                aria-expanded={!isClosed}
                className={[
                  'flex w-full items-center gap-2.5 bg-default-50 px-3 py-2 text-left text-tiny font-bold',
                  isClosed ? '' : 'border-b border-default-100',
                ].join(' ')}
              >
                <span aria-hidden="true" className="w-2.5 text-[9px] text-default-400">
                  {isClosed ? '▶' : '▼'}
                </span>
                <span className="font-mono">{heading}</span>
                <span className="rounded-full bg-default-200 px-1.5 font-mono text-[10px] font-semibold text-default-600">
                  {t('from_to.diff.changed_in_group', { count: group.changedCount })}
                </span>
              </button>
            </h3>

            {!isClosed && (
              <div className="grid gap-1.5 p-2.5">
                {group.changes.map((change) => (
                  <DiffRow
                    key={change.path}
                    change={change}
                    numberA={numberA}
                    numberB={numberB}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function DiffRow({
  change,
  numberA,
  numberB,
}: {
  change: FieldChange
  numberA: number
  numberB: number
}) {
  const { t } = useTranslation()
  const same = change.kind === 'unchanged'

  const oldTone = same ? 'flat' : change.from === null ? 'absent' : 'old'
  const newTone = same ? 'flat' : change.to === null ? 'absent' : 'new'

  return (
    <div className="grid items-center gap-2.5 rounded-lg border border-default-100 px-2.5 py-2 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)_14px_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="break-all font-mono text-tiny font-semibold">{change.path}</p>
        <span
          className={`mt-1 inline-block rounded px-1.5 text-[9px] font-bold uppercase tracking-wide ${KIND_CHIP[change.kind]}`}
        >
          {t(`from_to.diff.kind_${change.kind}`)}
        </span>
      </div>

      <ValueCell
        caption={t('from_to.timeline.version_n', { number: numberA })}
        value={change.from}
        tone={oldTone}
      />

      <span aria-hidden="true" className="hidden text-center text-default-300 md:block">
        →
      </span>

      <ValueCell
        caption={t('from_to.timeline.version_n', { number: numberB })}
        value={change.to}
        tone={newTone}
      />
    </div>
  )
}

function ValueCell({
  caption,
  value,
  tone,
}: {
  caption: string
  value: unknown
  tone: keyof typeof VALUE_TONE
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[9px] uppercase tracking-wide text-default-400">
        {caption}
      </p>
      {/* Wraps anywhere — ISO intervals and URLs have no spaces to break at —
          and caps its height, so a polygon scrolls down inside the cell
          instead of widening the page or towering over the diff. */}
      <p
        className={`max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md px-2 py-1 font-mono text-tiny [overflow-wrap:anywhere] ${VALUE_TONE[tone]}`}
        title={formatValue(value)}
      >
        {formatValue(value)}
      </p>
    </div>
  )
}
