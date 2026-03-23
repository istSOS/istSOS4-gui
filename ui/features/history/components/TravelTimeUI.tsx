'use client'

import React, { useState } from 'react'
import { EntityType, GenericEntity, ENTITY_TYPES, QueryMode, CommitRow } from './travelTimeTypes'
import { DateTimeInput, SearchBtn, ActionBadge } from './TravelTimeShared'
import { TABLE_COLUMNS, MOCK_COLLECTIONS, MOCK_COMMITS } from './travelTimeMockData'
import { EntityDetailScreen } from './EntityDetailScreen'
import { CommitModal } from './CommitModal'

export default function TravelTimeUI() {
  const [queryMode, setQueryMode] = useState<QueryMode>('current')
  const [entityType, setEntityType] = useState<EntityType>('Sensors')
  const [date, setDate] = useState('2025-12-15')
  const [time, setTime] = useState('00:00')
  const [appliedDate, setAppliedDate] = useState<string | null>(null)
  const [appliedMode, setAppliedMode] = useState<QueryMode>('current')
  const [selectedEntity, setSelectedEntity] = useState<GenericEntity | null>(null)
  const [modal, setModal] = useState<CommitRow | null>(null)

  if (selectedEntity) {
    return (
      <EntityDetailScreen
        entityType={entityType}
        entity={selectedEntity}
        onBack={() => setSelectedEntity(null)}
      />
    )
  }

  const columns = TABLE_COLUMNS[entityType]
  const entityCommits = MOCK_COMMITS[entityType] || []

  const handleSearch = () => {
    setAppliedDate(date)
    setAppliedMode(queryMode)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">History Explorer</h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mt-1">Audit and travel through SensorThings entities</p>
          </div>
          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {(['current', 'as_of', 'from_to'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setQueryMode(m)
                  if (m === 'current') {
                    setAppliedDate(null)
                    setAppliedMode('current')
                  }
                }}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  queryMode === m ? 'bg-[#007668] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {m === 'from_to' ? 'Versions (Range)' : m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Entity Tabs */}
        <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {ENTITY_TYPES.map((e) => (
            <button
              key={e}
              onClick={() => setEntityType(e)}
              className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${
                entityType === e ? 'text-[#007668]' : 'text-gray-400 hover:text-gray-600'
              } ${
                e === 'ObservedProperties' || e === 'FeaturesOfInterest' || e === 'HistoricalLocations' ? 'px-8 min-w-[180px]' : 'px-4 min-w-[100px]'
              }`}
            >
              {e}
              {entityType === e && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#007668]" />}
            </button>
          ))}
        </div>

        {/* Query Controls */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {queryMode === 'current' ? (
             <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Live Collection View</h2>
                  <p className="text-xs text-gray-400">Displaying the most recent state for all {entityType}.</p>
                </div>
             </div>
          ) : queryMode === 'as_of' ? (
            <div className="flex flex-wrap items-end gap-6">
              <DateTimeInput label="Query point (As Of)" date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
              <SearchBtn onClick={handleSearch} label="Apply Time Filter" />
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-6">
              <DateTimeInput label="From" date="2025-10-01" time="00:00" onDateChange={()=>{}} onTimeChange={()=>{}} />
              <div className="pb-1 text-gray-300">→</div>
              <DateTimeInput label="To" date="2026-03-22" time="23:00" onDateChange={()=>{}} onTimeChange={()=>{}} />
              <SearchBtn onClick={handleSearch} label="Search Versions" />
            </div>
          )}
        </div>

        {/* Unified Table Results */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-3 flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
               {appliedMode === 'from_to' ? 'Full Historical Timeline' : 'Collection Snapshot'}
            </span>
          </div>

          <table className="w-full min-w-max text-left text-sm">
            <thead>
              {appliedMode === 'from_to' ? (
                 <tr className="border-b bg-gray-50/20 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Entity Name</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Properties</th>
                  <th className="px-6 py-4">Commit Message</th>
                </tr>
              ) : (
                <tr className="border-b bg-gray-50/20 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {columns.map((c) => <th key={c.key} className="px-6 py-4">{c.label}</th>)}
                  {appliedMode === 'as_of' && <th className="px-6 py-4">Status</th>}
                </tr>
              )}
            </thead>
            <tbody>
              {appliedMode === 'from_to' ? (
                entityCommits.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => setModal(c)}
                    className="group cursor-pointer border-b last:border-0 hover:bg-[#007668]/5"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{c.date}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">{c.snapshot.name || c.id}</td>
                    <td className="px-6 py-4"><ActionBadge action={c.action} /></td>
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-1">
                          {Object.entries(c.snapshot.properties || {}).map(([pk, pv]) => (
                             <span key={pk} className="bg-gray-100 text-[10px] px-1.5 py-0.5 rounded text-gray-500 border border-gray-200">
                                {pk}: {String(pv)}
                             </span>
                          ))}
                       </div>
                    </td>
                    <td className="px-6 py-4 italic text-gray-600">"{c.message}"</td>
                  </tr>
                ))
              ) : (
                MOCK_COLLECTIONS[entityType].map((r) => {
                  const isDeleted = r.name === 'PM2.5 Sensor' && appliedMode === 'as_of' && appliedDate && appliedDate >= '2026-01-10'
                  return (
                    <tr 
                      key={r.id}
                      onClick={() => setSelectedEntity(r)}
                      className="group cursor-pointer border-b last:border-0 hover:bg-[#007668]/5"
                    >
                      {columns.map((c) => (
                        <td key={c.key} className={`px-6 py-4 font-bold ${isDeleted ? 'text-gray-300 line-through' : 'text-gray-700'}`}>
                          {c.key === 'properties' ? (
                             <div className="flex flex-wrap gap-1">
                                {Object.entries(r.properties || {}).map(([pk, pv]) => (
                                   <span key={pk} className="bg-gray-100 text-[10px] px-1.5 py-0.5 rounded text-gray-500 border border-gray-200">
                                      {pk}: {String(pv)}
                                   </span>
                                ))}
                             </div>
                          ) : (
                            r[c.key]
                          )}
                        </td>
                      ))}
                      {appliedMode === 'as_of' && (
                        <td className="px-6 py-4">
                          {isDeleted ? (
                            <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">Deleted</span>
                          ) : (
                            <span className="text-gray-300 text-[9px] font-bold uppercase tracking-tighter">Current-Active</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <CommitModal commit={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
