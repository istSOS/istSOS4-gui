'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from './QcButton'

import { MANUAL_FLAG_CODES, QUALITY_FLAGS } from '../lib/qualityFlags'

export default function QcHumanReview({
  count,
  serviceMode = false,
  onApply,
  onClose,
  error,
}: {
  count: number
  serviceMode?: boolean
  onApply: (state: number | null, reason: string) => boolean
  onClose: () => void
  error?: string
}) {
  const { t } = useTranslation()
  const [state, setState] = useState('')
  const [reason, setReason] = useState('')
  const [allFlags, setAllFlags] = useState(false)
  const flags = allFlags
    ? QUALITY_FLAGS
    : QUALITY_FLAGS.filter((flag) => MANUAL_FLAG_CODES.includes(flag.code))
  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) node.showModal()
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-auto w-[min(95vw,580px)] rounded-lg border border-default-200 bg-content1 p-5 text-foreground shadow-xl backdrop:bg-black/40"
      aria-labelledby="qc-review-title"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!state || !reason.trim()) return
          const code =
            state === 'clear' ? (serviceMode ? null : 0) : Number(state)
          if (onApply(code, reason.trim())) onClose()
        }}
        className="space-y-4"
      >
        <h2 id="qc-review-title" className="text-lg font-semibold">
          {t(serviceMode ? 'qc.workflow.assign_flag' : 'qc.human_review')} ·{' '}
          {count} {t('qc.rows')}
        </h2>
        <p className="text-sm text-default-500">
          {t(serviceMode ? 'qc.workflow.catalog_hint' : 'qc.human_hint')}
        </p>
        <label className="block text-sm">
          {t(serviceMode ? 'qc.workflow.quality_flag' : 'qc.human_decision')}
          <select
            required
            aria-label={t(
              serviceMode ? 'qc.workflow.quality_flag' : 'qc.human_decision'
            )}
            className="mt-1 w-full rounded border border-default-300 bg-content1 p-2"
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">{t('qc.workflow.choose_decision')}</option>
            {serviceMode ? (
              flags.map((flag) => (
                <option key={flag.code} value={flag.code}>
                  {flag.code} —{' '}
                  {t(`qc.workflow.flags.${flag.code}`, {
                    defaultValue: flag.description,
                  })}
                </option>
              ))
            ) : (
              <>
                <option value="3">{t('qc.accepted')}</option>
                <option value="2">{t('qc.rejected')}</option>
              </>
            )}
            <option value="clear">{t('qc.clear_review')}</option>
          </select>
        </label>
        {serviceMode && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allFlags}
                onChange={(event) => {
                  setAllFlags(event.target.checked)
                  setState('')
                }}
              />
              {t('qc.workflow.all_flags')}
            </label>
            <p className="text-sm text-default-500">
              {
                QUALITY_FLAGS.find((flag) => flag.code === Number(state))
                  ?.description
              }
            </p>
          </>
        )}
        <label className="block text-sm">
          {t('qc.review_reason')}
          <textarea
            autoFocus
            required
            maxLength={2000}
            rows={3}
            className="mt-1 w-full rounded border border-default-300 bg-content1 p-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="light" onPress={onClose}>
            {t('general.cancel')}
          </Button>
          <Button
            color="primary"
            type="submit"
            isDisabled={!state || !reason.trim()}
          >
            {t(serviceMode ? 'qc.workflow.apply_flag' : 'qc.apply_review')}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </dialog>
  )
}
