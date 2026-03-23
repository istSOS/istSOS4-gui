import React, { useState } from 'react'
import { EntityType, Period, CommitRow } from './travelTimeTypes'
import { MOCK_COMMITS, PERIOD_BARS } from './travelTimeMockData'
import { ActionBadge } from './TravelTimeShared'
import { CommitModal } from './CommitModal'

export function HistorySubTab({ entityType }: { entityType: EntityType }) {
  const [period, setPeriod] = useState<Period>('Month')
  const [modal, setModal] = useState<CommitRow | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverBar, setHoverBar] = useState<{ label: string; count: number } | null>(null)

  const rawCommits = MOCK_COMMITS[entityType] || []
  

  const entityCommits = rawCommits.filter((c, i) => {
    if (period === 'Day') return i === 0 // Just the most recent for "Day" mock
    if (period === 'Week') return i < 2   // First two for "Week"
    return true                          // All for "Month"
  })

  const bars = PERIOD_BARS[period]

  return (
    <div className="space-y-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800 tracking-tight">Activity Graph</h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Commit Frequency — {period}</p>
          </div>
          <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-0.5 shadow-inner">
            {(['Day', 'Week', 'Month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                   setPeriod(p)
                   setSelectedId(null)
                }}
                className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  period === p ? 'bg-[#007668] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        
        <div className="relative pt-6">
          {hoverBar && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-[9px] font-bold z-10 animate-in fade-in zoom-in duration-200">
               {hoverBar.label}: {hoverBar.count} mutations
            </div>
          )}
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {bars.map((bar, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoverBar(bar)}
                onMouseLeave={() => setHoverBar(null)}
                className={`flex-1 rounded-t-md transition-all duration-300 cursor-pointer ${
                  bar.count === 0 ? 'bg-gray-100 hover:bg-gray-200' : 'bg-[#007668] hover:bg-[#007668]/80'
                }`}
                style={{ height: `${Math.max(10, (bar.count / 5) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50/30 px-5 py-4">
          <h3 className="text-sm font-bold text-gray-800 tracking-tight">Timeline: {period}</h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Chronological audit log</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50/50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-5 py-4">Timestamp</th>
                <th className="px-5 py-4">Author</th>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Message</th>
              </tr>
            </thead>
            <tbody>
              {entityCommits.length > 0 ? entityCommits.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => {
                    setSelectedId(c.id)
                    setModal(c)
                  }}
                  className={`cursor-pointer border-b last:border-0 hover:bg-[#007668]/5 transition-colors ${
                    selectedId === c.id ? 'bg-[#007668]/10' : ''
                  }`}
                >
                  <td className="px-5 py-4 font-mono text-xs text-gray-500">{c.date}</td>
                  <td className="px-5 py-4 font-bold text-gray-700">{c.author}</td>
                  <td className="px-5 py-4">
                    <ActionBadge action={c.action} />
                  </td>
                  <td className="px-5 py-4 italic text-gray-600 font-medium">"{c.message}"</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-gray-400 italic text-xs">No records found for this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <CommitModal commit={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
