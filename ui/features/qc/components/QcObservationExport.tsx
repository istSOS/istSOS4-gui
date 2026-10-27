'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from './QcButton'

import {
  exportObservations,
  observationExportProblem,
  observationExportRows,
} from '../lib/observationExport'
import type { ObservationExportOptions } from '../lib/observationExport'
import type { Workspace } from '../lib/types'

export default function QcObservationExport({
  workspace,
  streamKey,
  utcOffset,
  versioningEnabled,
  disabled,
  onCommitMessageChange,
}: {
  workspace: Workspace
  streamKey: string
  utcOffset: number
  versioningEnabled: boolean
  disabled: boolean
  onCommitMessageChange: (message: string) => void
}) {
  const { t } = useTranslation()
  const [scope, setScope] =
    useState<ObservationExportOptions['scope']>('loaded')
  const [error, setError] = useState('')
  const chosen = { [streamKey]: workspace }
  const options: ObservationExportOptions = {
    scope,
    utcOffset,
    versioningEnabled,
  }
  const count = Object.values(chosen).reduce(
    (sum, ws) => sum + observationExportRows(ws, scope).length,
    0
  )
  const problem = observationExportProblem(chosen, options)
  const control =
    'w-full rounded border border-default-300 bg-content1 px-3 py-2 text-sm disabled:opacity-50'
  return (
    <section
      className="space-y-3"
      aria-label={t('qc.observation_export.title')}
    >
      <label className="block text-sm">
        {t('qc.observation_export.scope')}
        <select
          className={control}
          disabled={disabled}
          value={scope}
          onChange={(event) => {
            setScope(event.target.value as ObservationExportOptions['scope'])
            setError('')
          }}
        >
          <option value="loaded">
            {t('qc.observation_export.all_loaded')}
          </option>
          <option value="changed">
            {t('qc.observation_export.only_changed')}
          </option>
        </select>
      </label>
      {scope === 'changed' && (
        <p className="text-xs text-default-500">
          {t('qc.observation_export.changed_hint')}
        </p>
      )}
      <label className="block text-sm">
        {t(
          versioningEnabled
            ? 'qc.observation_export.message_required'
            : 'qc.observation_export.message_optional'
        )}
        <input
          className={control}
          type="text"
          required={versioningEnabled}
          maxLength={32767}
          value={workspace.commitMessage ?? ''}
          disabled={disabled}
          placeholder={t('qc.observation_export.message_placeholder')}
          onChange={(event) => {
            onCommitMessageChange(event.target.value)
            setError('')
          }}
        />
      </label>

      <p className="text-xs">
        {t('qc.observation_export.row_count', { count })}
      </p>
      <Button
        className="w-full"
        color="primary"
        isDisabled={disabled || !count || !!problem}
        onPress={() => {
          try {
            exportObservations(chosen, options)
            setError('')
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : t('qc.observation_export.failed')
            )
          }
        }}
      >
        {t('qc.observation_export.download')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  )
}
