import React from 'react'
import { CommitRow } from './travelTimeTypes'
import { ActionBadge, SectionLabel, KV } from './TravelTimeShared'

export function CommitModal({ commit, onClose }: { commit: CommitRow; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Version Detail</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-gray-800">{commit.date}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 items-center justify-center rounded px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
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
          <div>
            <SectionLabel>What Changed</SectionLabel>
            <div className="space-y-3">
              {commit.diff.map((d, i) => (
                <div key={i}>
                  <p className="mb-1 text-xs font-medium text-gray-600">{d.field}</p>
                  <div className="overflow-hidden rounded-md border border-gray-100 font-mono text-xs">
                    <div className="flex gap-2 bg-red-50 px-3 py-1.5 text-red-700 font-bold">
                      <span className="select-none">−</span>
                      <span>{d.previous}</span>
                    </div>
                    <div className="flex gap-2 bg-green-50 px-3 py-1.5 text-green-700 font-bold">
                      <span className="select-none">+</span>
                      <span>{d.next}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <hr className="border-gray-100" />
          <div>
            <SectionLabel>Snapshot at this moment</SectionLabel>
            <div className="space-y-1.5">
              {Object.entries(commit.snapshot).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{k}</span>
                  {k === 'properties' ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(v || {}).map(([pk, pv]) => (
                        <span key={pk} className="bg-[#007668]/5 text-[#007668] text-[10px] px-2 py-0.5 rounded border border-[#007668]/20 font-bold">
                          {pk}: {String(pv)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-gray-700">{String(v)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
