'use client'

import { useTranslation } from 'react-i18next'

import { checkIssue } from '../lib/checks'
import type { Constraint } from '../lib/types'

export default function QcChecks({
  constraints,
  slots,
  onSlots,
  disabled,
}: {
  constraints: Constraint[]
  slots: number[]
  onSlots: (slots: number[]) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <section
      className="space-y-3 rounded-lg border border-default-200 p-4"
      aria-label={t('qc.workflow.stored_checks')}
    >
      <details>
        <summary className="cursor-pointer rounded text-sm focus-visible:outline-2 focus-visible:outline-primary">
          <span className="font-medium">{t('qc.workflow.stored_checks')}</span>
          <span className="ml-3 text-xs text-default-500">
            {t('qc.workflow.checks_defined', { count: constraints.length })}
            {' · '}
            {t('qc.workflow.checks_selected', { count: slots.length })}
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-default-500">
            {t('qc.workflow.stored_only')}
          </p>
          {!constraints.length && (
            <p className="text-sm">{t('qc.workflow.no_stored_checks')}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {constraints.map((constraint, index) => {
              const issue = checkIssue(constraint)
              return (
                <div
                  key={index}
                  className="rounded border border-default-200 bg-default-50 p-3"
                >
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={slots.includes(index + 1)}
                      disabled={disabled || !!issue}
                      onChange={(event) =>
                        onSlots(
                          event.target.checked
                            ? [...slots, index + 1]
                            : slots.filter((slot) => slot !== index + 1)
                        )
                      }
                    />
                    {index + 1} ·{' '}
                    {t(`qc.workflow.tests.${constraint.type}`, {
                      defaultValue: constraint.type,
                    })}
                  </label>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {Object.entries(constraint)
                      .filter(([key]) => key !== 'type')
                      .map(([key, value]) => (
                        <div key={key} className="contents">
                          <dt className="text-default-500">{key}</dt>
                          <dd className="break-all">{JSON.stringify(value)}</dd>
                        </div>
                      ))}
                  </dl>
                  {issue && (
                    <p className="mt-2 text-xs text-warning-700">
                      {t('qc.workflow.check_unavailable')} · {issue}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </details>
    </section>
  )
}
