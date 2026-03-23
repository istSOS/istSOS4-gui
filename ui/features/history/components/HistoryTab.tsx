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
  type EntityMockData,
  type EntityState,
  type EntityType,
  HISTORY_MOCK,
} from '@/features/history/mock/historyMockData'

// ─── Badge ───────────────────────────────────────────────────────────────────

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

// ─── Shared Modal ─────────────────────────────────────────────────────────────

function CommitModal({
  commit,
  onClose,
}: {
  commit: CommitRow
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Version Detail
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-gray-800">
              {commit.date}
            </p>
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
            <SectionLabel>Commit Details</SectionLabel>
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
            <SectionLabel>What Changed</SectionLabel>
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
            <SectionLabel>Snapshot at this moment</SectionLabel>
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

// ─── Entity State Card ────────────────────────────────────────────────────────

function EntityCard({
  entity,
  onOpenCommit,
}: {
  entity: EntityState
  onOpenCommit: () => void
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Entity State
        </span>
        <span className="font-mono text-xs text-gray-400">as of query time</span>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-5 py-4">
        {Object.entries(entity.fields).map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{k}</span>
            <span className="break-all text-sm font-medium text-gray-800">{v}</span>
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">validFrom</span>
          <span className="text-sm font-medium text-gray-800">{entity.validFrom}</span>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Linked Commit
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">
            <span className="text-xs text-gray-400">author </span>
            {entity.commit.author}
          </span>
          <ActionBadge action={entity.commit.action} />
          <span className="italic text-sm text-gray-600">"{entity.commit.message}"</span>
          <button
            onClick={onOpenCommit}
            className="ml-auto text-xs font-medium text-[#007668] hover:underline"
          >
            View detail →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Commit List Table ────────────────────────────────────────────────────────

function CommitTable({
  rows,
  selectedId,
  onRowClick,
}: {
  rows: CommitRow[]
  selectedId: string | null
  onRowClick: (r: CommitRow) => void
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Author</th>
            <th className="px-4 py-3 text-left">Action</th>
            <th className="px-4 py-3 text-left">Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row)}
              className={`cursor-pointer border-b border-gray-50 transition-colors last:border-0 ${
                row.id === selectedId ? 'bg-[#007668]/10' : 'hover:bg-gray-50'
              }`}
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                {row.date}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.author}</td>
              <td className="px-4 py-3">
                <ActionBadge action={row.action} />
              </td>
              <td className="px-4 py-3 italic text-gray-600">"{row.message}"</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Date + Time inputs ───────────────────────────────────────────────────────

function DateTimeInput({
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  label: string
  date: string
  time: string
  onDateChange: (v: string) => void
  onTimeChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#007668] focus:outline-none focus:ring-1 focus:ring-[#007668]"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-[#007668] focus:outline-none focus:ring-1 focus:ring-[#007668]"
        />
      </div>
    </div>
  )
}

function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-auto flex items-center justify-center rounded-lg bg-[#007668] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#007668] focus:ring-offset-2"
    >
      Search
    </button>
  )
}

// ─── Tiny shared helpers ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
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

// ─── Main Component ───────────────────────────────────────────────────────────

type QueryMode = 'single' | 'range'

interface HistoryTabProps {
  /** Which SensorThings entity this tab is for */
  entityType: EntityType
}

export default function HistoryTab({ entityType }: HistoryTabProps) {
  const mock: EntityMockData = HISTORY_MOCK[entityType]

  const [mode, setMode] = useState<QueryMode>('single')

  // Single-point
  const [spDate, setSpDate] = useState(mock.defaultAsOf.date)
  const [spTime, setSpTime] = useState(mock.defaultAsOf.time)
  const [entityResult, setEntityResult] = useState<EntityState | null>(null)

  // Range
  const [fromDate, setFromDate] = useState(mock.defaultRange.fromDate)
  const [fromTime, setFromTime] = useState(mock.defaultRange.fromTime)
  const [toDate, setToDate]     = useState(mock.defaultRange.toDate)
  const [toTime, setToTime]     = useState(mock.defaultRange.toTime)
  const [commits, setCommits]   = useState<CommitRow[]>([])

  // Modal
  const [modalCommit, setModalCommit] = useState<CommitRow | null>(null)
  const [selectedId, setSelectedId]   = useState<string | null>(null)

  // Reset when entity changes
  function resetState() {
    setEntityResult(null)
    setCommits([])
    setModalCommit(null)
    setSelectedId(null)
  }

  const MODES: { key: QueryMode; label: string }[] = [
    { key: 'single', label: 'Single Point' },
    { key: 'range',  label: 'Range' },
  ]

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Mode toggle */}
        <div className="flex border-b border-gray-100">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setMode(key); resetState() }}
              className={`relative px-5 py-3 text-sm font-medium transition-colors focus:outline-none ${
                mode === key ? 'text-[#007668]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
              {mode === key && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#007668]" />
              )}
            </button>
          ))}
        </div>

        {/* ── Single Point ── */}
        {mode === 'single' && (
          <div className="p-5">
            <SectionLabel>as_of</SectionLabel>
            <div className="flex flex-wrap items-end gap-3">
              <DateTimeInput
                label="Date & Time"
                date={spDate}
                time={spTime}
                onDateChange={setSpDate}
                onTimeChange={setSpTime}
              />
              <SearchButton onClick={() => setEntityResult(mock.asOf)} />
            </div>

            {entityResult && (
              <EntityCard
                entity={entityResult}
                onOpenCommit={() => {
                  setModalCommit(mock.fromTo[0])
                  setSelectedId(mock.fromTo[0].id)
                }}
              />
            )}
          </div>
        )}

        {/* ── Range ── */}
        {mode === 'range' && (
          <div className="p-5">
            <SectionLabel>from_to</SectionLabel>
            <div className="flex flex-wrap items-end gap-4">
              <DateTimeInput
                label="From"
                date={fromDate}
                time={fromTime}
                onDateChange={setFromDate}
                onTimeChange={setFromTime}
              />
              <div className="pb-1 self-center text-lg font-light text-gray-300">→</div>
              <DateTimeInput
                label="To"
                date={toDate}
                time={toTime}
                onDateChange={setToDate}
                onTimeChange={setToTime}
              />
              <SearchButton onClick={() => { setCommits(mock.fromTo); setSelectedId(null) }} />
            </div>

            {commits.length > 0 && (
              <CommitTable
                rows={commits}
                selectedId={selectedId}
                onRowClick={(row) => { setSelectedId(row.id); setModalCommit(row) }}
              />
            )}
          </div>
        )}
      </div>

      {/* Shared modal */}
      {modalCommit && (
        <CommitModal commit={modalCommit} onClose={() => setModalCommit(null)} />
      )}
    </>
  )
}

