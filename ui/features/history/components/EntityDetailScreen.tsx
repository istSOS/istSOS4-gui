import React, { useState } from 'react'
import { EntityType, GenericEntity, EntityTab } from './travelTimeTypes'
import { SectionLabel } from './TravelTimeShared'
import { HistorySubTab } from './HistorySubTab'

export function EntityDetailScreen({
  entityType,
  entity,
  onBack,
}: {
  entityType: EntityType
  entity: GenericEntity
  onBack: () => void
}) {
  const [tab, setTab] = useState<EntityTab>('History')

  return (
    <div className="min-h-screen bg-gray-50 p-6" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex h-8 items-center justify-center rounded-lg border bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 shadow-sm transition-colors hover:border-[#007668] hover:text-[#007668]"
          >
            Back
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {entityType.replace(/s$/, '')} #{entity.id}
            </p>
            <h1 className="text-lg font-bold text-gray-800">{entity.name || entity.result || 'Unnamed Entity'}</h1>
          </div>
        </div>
        <div className="mb-4 flex gap-1 rounded-xl border bg-white p-1 shadow-sm">
          {(['Details', 'History'] as EntityTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${
                tab === t ? 'bg-[#007668] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'Details' && (
          <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {Object.entries(entity).map(([k, v]) => {
                if (k === 'properties') return null
                return (
                  <div key={k} className="flex flex-col border-b border-gray-50 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-tight text-gray-400">{k}</span>
                    <span className="text-sm font-semibold text-gray-700">{String(v)}</span>
                  </div>
                )
              })}
            </div>
            {entity.properties && Object.keys(entity.properties).length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <SectionLabel>Metadata Properties</SectionLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(entity.properties).map(([pk, pv]) => (
                    <div key={pk} className="flex items-center gap-2 rounded-lg border border-[#007668]/20 bg-[#007668]/5 px-3 py-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#007668] opacity-70">{pk}:</span>
                      <span className="text-xs font-bold text-[#007668]">{String(pv)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'History' && <HistorySubTab entityType={entityType} />}
      </div>
    </div>
  )
}
