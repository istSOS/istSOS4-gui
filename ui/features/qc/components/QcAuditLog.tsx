'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { rawText } from '../lib/bitmask'
import type { AuditEntry } from '../lib/types'

export default function QcAuditLog({ entries }: { entries: AuditEntry[] }) {
  const { t } = useTranslation()
  const [limit, setLimit] = useState(20)
  return (
    <details className="shrink-0 rounded border border-default-200 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {t('qc.audit_log')} ({entries.length})
      </summary>
      <p className="my-2 text-xs text-default-500">{t('qc.audit_hint')}</p>
      <p className="mb-2 text-xs text-default-500">{t('qc.audit_utc')}</p>
      {!entries.length && <p className="text-xs">{t('qc.audit_empty')}</p>}
      <div className="max-h-96 space-y-2 overflow-auto">
        {entries
          .slice(-limit)
          .reverse()
          .map((entry) => (
            <details
              key={entry.id}
              className="rounded bg-default-50 p-2 text-xs"
            >
              <summary className="cursor-pointer">
                <time>{entry.time}</time> · {entry.actor} ·{' '}
                <strong>
                  {t(`qc.audit_action.${entry.action}`, {
                    defaultValue: entry.action,
                  })}
                </strong>{' '}
                · {entry.changes.length} {t('qc.audit_affected')}
              </summary>
              <p className="mt-2 break-all">
                {entry.source} · {entry.datastream}
              </p>
              <pre className="my-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(entry.parameters, null, 2)}
              </pre>
              {!!entry.changes.length && (
                <div className="max-h-60 overflow-auto">
                  <table
                    className="w-full text-left"
                    aria-label={t('qc.audit_changes')}
                  >
                    <thead>
                      <tr>
                        {[
                          'UTC',
                          'ID',
                          t('qc.before'),
                          t('qc.after'),
                          t('qc.original_quality'),
                          t('qc.draft_quality'),
                          t('qc.needs_check'),
                        ].map((label, i) => (
                          <th className="px-2 py-1" key={i}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entry.changes.slice(0, 100).map((change) => (
                        <tr
                          key={change.key}
                          className="border-t border-default-200"
                        >
                          {[
                            change.time,
                            change.observationId,
                            rawText(change.before.result),
                            rawText(change.after.result),
                            rawText(change.before.resultQuality),
                            rawText(change.after.resultQuality),
                            change.after.staleSlots.join(', '),
                          ].map((value, i) => (
                            <td className="px-2 py-1" key={i}>
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entry.changes.length > 100 && (
                    <p>{t('qc.audit_truncated')}</p>
                  )}
                </div>
              )}
            </details>
          ))}
      </div>
      {entries.length > limit && (
        <button
          type="button"
          className="mt-2 text-xs text-primary"
          onClick={() => setLimit(limit + 20)}
        >
          {t('qc.audit_more')}
        </button>
      )}
    </details>
  )
}
