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

import { useState } from 'react'

import {
  type ActionType,
  type CommitRow,
  type EntityType,
  ALL_COMMITS_GLOBAL,
  ENTITY_TYPES,
} from '@/features/history/mock/historyMockData'

// ─── Badge ────────────────────────────────────────────────────────────────────

const BADGE: Record<ActionType, { bg: string; color: string }> = {
  INSERT: { bg: '#E6F9F1', color: '#0F6E56' },
  UPDATE: { bg: '#E6F1FB', color: '#185FA5' },
  DELETE: { bg: '#FCEBEB', color: '#A32D2D' },
}

function ActionBadge({ action }: { action: ActionType }) {
  const { bg, color } = BADGE[action]
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide"
      style={{ background: bg, color }}
    >
      {action}
    </span>
  )
}

// ─── Entity chip ──────────────────────────────────────────────────────────────

const ENTITY_COLORS: Record<EntityType, string> = {
  Things:             'bg-violet-100 text-violet-700',
  Locations:          'bg-emerald-100 text-emerald-700',
  Sensors:            'bg-orange-100 text-orange-700',
  Datastreams:        'bg-sky-100 text-sky-700',
  Observations:       'bg-pink-100 text-pink-700',
  ObservedProperties: 'bg-yellow-100 text-yellow-700',
  FeaturesOfInterest: 'bg-teal-100 text-teal-700',
  HistoricalLocations: 'bg-indigo-100 text-indigo-700',
}

function EntityChip({ entity }: { entity: EntityType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ENTITY_COLORS[entity]}`}>
      {entity}
    </span>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function CommitModal({
  commit,
  entity,
  onClose,
}: {
  commit: CommitRow
  entity: EntityType
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Version Detail
              </p>
              <EntityChip entity={entity} />
            </div>
            <p className="font-mono text-sm font-semibold text-gray-800">{commit.date}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 items-center justify-center rounded px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Commit details */}
          <div>
            <Label>Commit Details</Label>
            <div className="space-y-2 text-sm">
              <KV label="Author" value={commit.author} />
              <div className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-gray-400">Action</span>
                <ActionBadge action={commit.action} />
              </div>
              <KV label="Message" value={`"${commit.message}"`} />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Diff */}
          <div>
            <Label>What Changed</Label>
            <div className="space-y-3">
              {commit.diff.map((d, i) => (
                <div key={i}>
                  <p className="mb-1 text-xs font-medium text-gray-600">{d.field}</p>
                  <div className="overflow-hidden rounded-md border border-gray-100 font-mono text-xs">
                    <div className="flex gap-2 bg-red-50 px-3 py-1.5 text-red-700">
                      <span className="select-none font-bold">−</span>
                      <span>{d.previous}</span>
                    </div>
                    <div className="flex gap-2 bg-green-50 px-3 py-1.5 text-green-700">
                      <span className="select-none font-bold">+</span>
                      <span>{d.next}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Snapshot */}
          <div>
            <Label>Snapshot at this moment</Label>
            <div className="space-y-1.5">
              {Object.entries(commit.snapshot).map(([k, v]) => (
                <div key={k} className="flex items-start gap-3 text-sm">
                  <span className="w-40 shrink-0 text-xs text-gray-400">{k}</span>
                  <span className="font-medium text-[#007668]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
      {children}
    </p>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-400">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

// ─── Stat badges ──────────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      <span className="tabular-nums">{count}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/** Global cross-entity commit history feed */
export default function CommitHistoryTab() {
  const [entityFilter, setEntityFilter] = useState<EntityType | 'All'>('All')
  const [actionFilter, setActionFilter] = useState<ActionType | 'All'>('All')
  const [modal, setModal] = useState<{ commit: CommitRow; entity: EntityType } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = ALL_COMMITS_GLOBAL.filter((c) => {
    if (entityFilter !== 'All' && c.entity !== entityFilter) return false
    if (actionFilter !== 'All' && c.action !== actionFilter) return false
    return true
  })

  // Summary counts
  const insertCount = ALL_COMMITS_GLOBAL.filter((c) => c.action === 'INSERT').length
  const updateCount = ALL_COMMITS_GLOBAL.filter((c) => c.action === 'UPDATE').length
  const deleteCount = ALL_COMMITS_GLOBAL.filter((c) => c.action === 'DELETE').length

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Commit History</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {ALL_COMMITS_GLOBAL.length} commits across all entities — showing {filtered.length}
            </p>
          </div>
          <div className="flex gap-2">
            <StatPill label="INSERT" count={insertCount} color="bg-[#E6F9F1] text-[#0F6E56]" />
            <StatPill label="UPDATE" count={updateCount} color="bg-[#E6F1FB] text-[#185FA5]" />
            <StatPill label="DELETE" count={deleteCount} color="bg-[#FCEBEB] text-[#A32D2D]" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
          {/* Entity filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Entity</span>
            <div className="flex flex-wrap gap-1">
              {(['All', ...ENTITY_TYPES] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEntityFilter(e)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    entityFilter === e
                      ? 'bg-[#007668] text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Action filter */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Action</span>
            <div className="flex gap-1">
              {(['All', 'INSERT', 'UPDATE', 'DELETE'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setActionFilter(a)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    actionFilter === a
                      ? 'bg-[#007668] text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No commits match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Author</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-10 py-3 text-left">Properties</th>
                <th className="px-4 py-3 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={`${row.entity}-${row.id}`}
                  onClick={() => {
                    setSelectedId(row.id)
                    setModal({ commit: row, entity: row.entity })
                  }}
                  className={`cursor-pointer border-b border-gray-50 transition-colors last:border-0 ${
                    selectedId === row.id ? 'bg-[#007668]/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                    {row.date}
                  </td>
                  <td className="px-4 py-3">
                    <EntityChip entity={row.entity} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.author}</td>
                  <td className="px-4 py-3">
                    <ActionBadge action={row.action} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(row.snapshot.properties || {}).map(([pk, pv]) => (
                        <span key={pk} className="bg-gray-100 text-[9px] px-1.5 py-0.5 rounded text-gray-500 border border-gray-200 uppercase font-bold tracking-tighter">
                          {pk}: {String(pv)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 italic text-gray-600">"{row.message}"</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {modal && (
        <CommitModal
          commit={modal.commit}
          entity={modal.entity}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

