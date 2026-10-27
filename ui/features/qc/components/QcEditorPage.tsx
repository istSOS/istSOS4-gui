'use client'

import { Spinner } from '@heroui/spinner'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'

import { isVersioningEnabled } from '@/config/versioning'

import { useAsOf } from '@/context/AsOfContext'

import QcAuditLog from './QcAuditLog'
import Button from './QcButton'
import QcChecks from './QcChecks'
import QcEditValues from './QcEditValues'
import QcHumanReview from './QcHumanReview'
import QcObservationExport from './QcObservationExport'
import QcResources from './QcResources'
import QcTable, { PAGE_SIZE } from './QcTable'

import { fitsMask, parseMask, slotState } from '../lib/bitmask'
import { unrunSlots } from '../lib/checks'
import { exportDrafts } from '../lib/export'
import { changed, rowValue } from '../lib/model'
import {
  UTC_OFFSETS,
  formatUtcOffset,
  fromOffsetInput,
  toOffsetInput,
} from '../lib/timezone'
import { useQcEditor } from '../lib/useQcEditor'

const QcGraph = dynamic(() => import('./QcGraph'), { ssr: false })
const STEPS = ['choose', 'inspect', 'correct', 'validate', 'review'] as const

export default function QcEditorPage({
  accessUnavailable,
}: {
  accessUnavailable: boolean
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const { isSnapshot, clearSnapshot } = useAsOf()
  const editor = useQcEditor(accessUnavailable)
  const mainRef = useRef<HTMLElement>(null)
  const navigationRef = useRef<HTMLElement>(null)
  const [step, setStep] = useState(1)
  const [furthest, setFurthest] = useState(1)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [showTable, setShowTable] = useState(true)
  const [discarding, setDiscarding] = useState(false)
  const [reviewKeys, setReviewKeys] = useState<string[] | null>(null)
  const [reviewEnabled, setReviewEnabled] = useState(false)
  const [reviewScope, setReviewScope] = useState('changed')
  const [cellReason, setCellReason] = useState('')
  const [preview, setPreview] = useState<Record<string, number | null>>({})
  const disabled = !!editor.busy || isSnapshot
  const blocked = disabled || editor.rangeChanged || editor.qualityBlocked
  const encoded =
    !!editor.loaded &&
    editor.constraints.length > 0 &&
    editor.constraints.length <= 4
  const offset = formatUtcOffset(editor.utcOffset)
  const rows = editor.rows
  const windowRows = rows.filter((row) => row.scope === 'window')
  const drafts = rows.filter((row) =>
    changed(row, rowValue(row, editor.workspace.drafts))
  )
  const corrected = windowRows.filter(
    (row) =>
      JSON.stringify(row.result) !==
      JSON.stringify(rowValue(row, editor.workspace.drafts).result)
  )
  const pending = rows.filter((row) => {
    const draft = rowValue(row, editor.workspace.drafts)
    return (
      draft.qualityPending ||
      draft.staleSlots.length > 0 ||
      (encoded && unrunSlots(draft, editor.constraints.length).length > 0)
    )
  })
  const failed = rows.filter((row) => {
    const draft = rowValue(row, editor.workspace.drafts)
    if (editor.serviceMode) return Number(draft.resultQuality) === 310
    if (!encoded || !fitsMask(draft.resultQuality, editor.constraints.length))
      return false
    const mask = parseMask(draft.resultQuality)
    return (
      mask !== null &&
      (slotState(mask, editor.constraints.length + 1) === 2 ||
        editor.constraints.some(
          (_, index) =>
            !draft.staleSlots.includes(index + 1) &&
            slotState(mask, index + 1) === 2
        ))
    )
  })
  const selected = new Set(editor.selected)
  const selectedWindowCount = windowRows.filter((row) =>
    selected.has(row.key)
  ).length
  const changedKeys = new Set(drafts.map((row) => row.key))
  const correctedKeys = new Set(corrected.map((row) => row.key))
  const pendingKeys = new Set(pending.map((row) => row.key))
  const failedKeys = new Set(failed.map((row) => row.key))
  const shown = rows.filter((row) =>
    filter === 'changed'
      ? changedKeys.has(row.key)
      : filter === 'selected'
        ? selected.has(row.key)
        : filter === 'pending'
          ? pendingKeys.has(row.key)
          : filter === 'failed'
            ? failedKeys.has(row.key)
            : true
  )
  const reviewTargets = windowRows
    .filter(
      (row) =>
        reviewScope === 'all' ||
        (reviewScope === 'selected'
          ? selected.has(row.key)
          : correctedKeys.has(row.key))
    )
    .map((row) => row.key)
  const control =
    'rounded border border-default-300 bg-content1 px-3 py-2 text-sm disabled:opacity-50'
  const lockedReason = isSnapshot
    ? t('qc.live_only')
    : editor.busy ||
      (editor.qualityBlocked
        ? t(`qc.workflow.bitmask_issues.${editor.qualityIssue}`)
        : editor.rangeChanged
          ? t('qc.reload_range')
          : !editor.confirmed
            ? t('qc.workflow.confirm_first')
            : '')

  useEffect(() => {
    const navigation = navigationRef.current
    const main = mainRef.current
    if (!navigation || !main) return
    const measure = () => {
      main.style.setProperty(
        '--qc-navigation-height',
        `${navigation.getBoundingClientRect().height}px`
      )
    }
    const resize = new ResizeObserver(measure)
    resize.observe(navigation)
    measure()
    return () => resize.disconnect()
  }, [])

  function go(next: number) {
    setStep(next)
    setFurthest((previous) => Math.max(previous, next))
    setReviewKeys(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function resetView() {
    setStep(1)
    setFurthest(1)
    setFilter('all')
    setShowTable(true)
    setPage(0)
    setReviewKeys(null)
    setReviewEnabled(false)
    setCellReason('')
    setPreview({})
  }

  function select(keys: string[], fromPlot = false) {
    if (disabled) return
    editor.setSelected(keys)
    if (fromPlot && keys.length) {
      const index = shown.findIndex((row) => row.key === keys[0])
      if (index >= 0) setPage(Math.floor(index / PAGE_SIZE))
    }
  }

  function applyFilter(value: string) {
    if (disabled) return
    const matching =
      value === 'changed'
        ? drafts
        : value === 'pending'
          ? pending
          : value === 'failed'
            ? failed
            : value === 'selected'
              ? rows.filter((row) => selected.has(row.key))
              : rows
    setFilter(value)
    setPage(0)
    setShowTable(true)
    select(matching.map((row) => row.key))
  }

  return (
    <main
      ref={mainRef}
      className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[1700px] flex-col gap-5 bg-content1 px-4 py-5 lg:px-8"
      style={{
        paddingBottom: 'calc(var(--qc-navigation-height, 8rem) + 1.5rem)',
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="light" onPress={() => router.push('/')}>
            {t('general.back')}
          </Button>
          <h1 className="text-xl font-semibold">{t('qc.workflow.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded bg-default-100 px-3 py-1 text-xs">
            {t('qc.workflow.draft_badge')}
          </span>
          <Button
            size="sm"
            variant="light"
            isDisabled={disabled || !editor.confirmed}
            onPress={() => setDiscarding(true)}
          >
            {t('qc.discard')}
          </Button>
        </div>
      </header>

      <nav
        aria-label={t('qc.workflow.steps_label')}
        className="overflow-x-auto"
      >
        <ol className="flex min-w-[650px] gap-2">
          {STEPS.map((name, index) => {
            const number = index + 1
            const unavailable =
              disabled ||
              number > furthest ||
              (number > 1 && (!editor.loaded || editor.rangeChanged)) ||
              (number > 2 && (!editor.confirmed || editor.qualityBlocked))
            return (
              <li key={name} className="min-w-0 flex-1">
                <button
                  type="button"
                  aria-current={step === number ? 'step' : undefined}
                  disabled={unavailable}
                  onClick={() => go(number)}
                  className={`flex w-full items-center gap-2 border-b-2 px-2 py-3 text-left text-sm disabled:cursor-default ${step === number ? 'border-primary font-semibold text-primary' : number < step ? 'border-primary-200 text-default-700' : 'border-default-200 text-default-400'}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step === number ? 'bg-primary text-primary-foreground' : 'bg-default-100'}`}
                  >
                    {number}
                  </span>
                  {t(`qc.workflow.steps.${name}`)}
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      {discarding && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded border border-warning p-3 text-sm"
        >
          <p>{t('qc.discard_confirm')}</p>
          <Button
            size="sm"
            color="warning"
            onPress={() => {
              editor.discard()
              setDiscarding(false)
              setPreview({})
              go(2)
              setFurthest(2)
            }}
          >
            {t('qc.discard')}
          </Button>
          <Button
            size="sm"
            variant="light"
            onPress={() => setDiscarding(false)}
          >
            {t('general.cancel')}
          </Button>
        </div>
      )}
      {isSnapshot && (
        <div className="flex items-center gap-3 rounded bg-warning-50 p-3 text-sm">
          {t('qc.live_only')}
          <Button size="sm" onPress={clearSnapshot}>
            {t('qc.return_live')}
          </Button>
        </div>
      )}
      <div
        role="status"
        aria-live="polite"
        className="space-y-1 text-sm empty:hidden"
      >
        {editor.error && (
          <p role="alert" className="text-danger">
            {editor.error}
          </p>
        )}
        {editor.qualityIssue && (
          <p className="text-warning-700">
            {t(`qc.workflow.bitmask_issues.${editor.qualityIssue}`)}
          </p>
        )}
        {editor.rangeChanged && (
          <p className="text-warning-700">{t('qc.reload_range')}</p>
        )}
      </div>

      {step === 1 && (
        <section className="mx-auto w-full max-w-4xl space-y-5 rounded-lg border border-default-200 p-5 lg:p-8">
          <div>
            <h2 className="text-xl font-semibold">
              {t('qc.workflow.steps.choose')}
            </h2>
            <p className="mt-1 text-sm text-default-500">
              {t('qc.workflow.hints.choose')}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              {t('qc.source')}
              <select
                className={control}
                value={editor.sourceId}
                disabled={disabled}
                onChange={(event) => {
                  resetView()
                  void editor.chooseSource(event.target.value)
                }}
              >
                <option value="">{t('qc.choose_source')}</option>
                {editor.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('qc.datastream')}
              <select
                className={control}
                value={editor.streamId}
                disabled={disabled}
                onChange={(event) => {
                  resetView()
                  editor.chooseStream(event.target.value)
                }}
              >
                <option value="">{t('qc.choose_datastream')}</option>
                {editor.streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.thing ? `${stream.thing} / ` : ''}
                    {stream.name}
                    {stream.unit ? ` (${stream.unit})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {editor.source &&
            !editor.busy &&
            !editor.error &&
            !editor.streams.length && (
              <p role="status" className="text-sm text-default-500">
                {t('qc.workflow.no_constrained_streams')}
              </p>
            )}
          <div className="flex flex-wrap gap-2">
            {[1, 7, 30].map((days) => (
              <Button
                key={days}
                size="sm"
                variant="flat"
                isDisabled={disabled}
                onPress={() => {
                  const end = new Date()
                  editor.setStart(
                    new Date(end.getTime() - days * 86400000)
                      .toISOString()
                      .slice(0, -1)
                  )
                  editor.setEnd(end.toISOString().slice(0, -1))
                }}
              >
                {t('qc.workflow.last_days', { count: days })}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              {t('qc.from_offset', { offset })}
              <input
                type="datetime-local"
                step="0.001"
                className={control}
                value={toOffsetInput(editor.start, editor.utcOffset)}
                disabled={disabled}
                onChange={(event) =>
                  editor.setStart(
                    fromOffsetInput(event.target.value, editor.utcOffset)
                  )
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('qc.to_offset', { offset })}
              <input
                type="datetime-local"
                step="0.001"
                className={control}
                value={toOffsetInput(editor.end, editor.utcOffset)}
                disabled={disabled}
                onChange={(event) =>
                  editor.setEnd(
                    fromOffsetInput(event.target.value, editor.utcOffset)
                  )
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t('qc.utc_offset')}
              <select
                className={control}
                value={editor.utcOffset}
                disabled={disabled}
                title={t('qc.fixed_offset_hint')}
                onChange={(event) =>
                  editor.setUtcOffset(Number(event.target.value))
                }
              >
                {UTC_OFFSETS.map((value) => (
                  <option key={value} value={value}>
                    UTC{formatUtcOffset(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {editor.loaded && (
        <div className={step === 1 ? 'hidden' : 'space-y-2'}>
          <div className="flex flex-wrap items-center gap-x-4 rounded-lg bg-default-50 px-4 py-3 text-sm">
            <strong>
              {editor.stream?.thing ? `${editor.stream.thing} / ` : ''}
              {editor.stream?.name}
            </strong>
            <span>
              {toOffsetInput(editor.start, editor.utcOffset).replace('T', ' ')}{' '}
              — {toOffsetInput(editor.end, editor.utcOffset).replace('T', ' ')}
            </span>
            <span>UTC{offset}</span>
            <span>{t('qc.workflow.mode_existing')}</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {t(`qc.workflow.steps.${STEPS[step - 1]}`)}
            </h2>
          </div>

          {(step === 2 || step === 4) && encoded && (
            <QcChecks
              constraints={editor.constraints}
              slots={editor.slots}
              onSlots={editor.setSlots}
              disabled={blocked}
            />
          )}

          <div className="space-y-4">
            {step === 2 && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  color="primary"
                  isDisabled={
                    blocked || !selectedWindowCount || !editor.slots.length
                  }
                  isLoading={editor.runningCheckScope === 'selected'}
                  onPress={() => void editor.runChecks('selected')}
                >
                  {t('qc.workflow.run_stored', {
                    count: selectedWindowCount,
                  })}
                </Button>
                <Button
                  variant="bordered"
                  isDisabled={
                    blocked || !windowRows.length || !editor.slots.length
                  }
                  isLoading={editor.runningCheckScope === 'all'}
                  onPress={() => void editor.runChecks('all')}
                >
                  {t('qc.workflow.run_all_stored', {
                    count: windowRows.length,
                  })}
                </Button>
              </div>
            )}
            {step === 3 && (
              <QcEditValues
                key={`${editor.key}:${editor.start}:${editor.end}`}
                rows={editor.contextRows}
                utcOffset={editor.utcOffset}
                drafts={editor.workspace.drafts}
                selected={editor.selected}
                start={editor.start}
                end={editor.end}
                checkCount={editor.constraints.length}
                lockedReason={lockedReason}
                encoded={encoded}
                unit={editor.stream?.unit ?? ''}
                onPreview={setPreview}
                onApply={(request) => {
                  const applied = editor.applyOperation(request)
                  setFilter('changed')
                  setPage(0)
                  return applied
                }}
              />
            )}
            {step === 4 && (
              <div className="grid gap-4 lg:grid-cols-1">
                <section className="space-y-3 rounded-lg border border-default-200 p-4">
                  <h3 className="font-medium">
                    {t('qc.workflow.optional_review')}
                  </h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={reviewEnabled}
                      onChange={(event) =>
                        setReviewEnabled(event.target.checked)
                      }
                    />
                    {t(
                      editor.serviceMode
                        ? 'qc.workflow.add_flag'
                        : 'qc.workflow.add_human_review'
                    )}
                  </label>
                  {reviewEnabled && (
                    <>
                      <label className="flex flex-col gap-1 text-sm">
                        {t('qc.workflow.apply_to')}
                        <select
                          className={control}
                          disabled={blocked}
                          value={reviewScope}
                          onChange={(event) =>
                            setReviewScope(event.target.value)
                          }
                        >
                          <option value="changed">
                            {t('qc.workflow.corrected_values')} (
                            {corrected.length})
                          </option>
                          <option value="selected">
                            {t('qc.selected_rows')} (
                            {
                              windowRows.filter((row) => selected.has(row.key))
                                .length
                            }
                            )
                          </option>
                          <option value="all">
                            {t('qc.all_rows')} ({windowRows.length})
                          </option>
                        </select>
                      </label>
                      <Button
                        className="w-full sm:w-auto"
                        variant="flat"
                        isDisabled={blocked || !reviewTargets.length}
                        onPress={() => {
                          editor.setError('')
                          setReviewKeys(reviewTargets)
                        }}
                      >
                        {t(
                          editor.serviceMode
                            ? 'qc.workflow.assign_flag'
                            : 'qc.human_review'
                        )}{' '}
                        ({reviewTargets.length})
                      </Button>
                    </>
                  )}
                </section>
              </div>
            )}
            {step === 5 && (
              <p className="rounded-lg bg-default-50 px-4 py-3 text-sm">
                {t('qc.workflow.corrected_values')}: {corrected.length}
                {' · '}
                {t('qc.workflow.filters.changed')}: {drafts.length}
                {' · '}
                {t('qc.workflow.filters.pending')}: {pending.length}
              </p>
            )}
          </div>

          {step < 5 && (
            <>
              <div className="min-w-0 space-y-3">
                <div className="h-[40vh] min-h-[320px] resize-y overflow-hidden rounded-lg border border-default-200">
                  <QcGraph
                    rows={rows}
                    unit={editor.stream?.unit}
                    utcOffset={editor.utcOffset}
                    drafts={editor.workspace.drafts}
                    checkCount={editor.constraints.length}
                    constraints={editor.constraints}
                    serviceMode={editor.serviceMode}
                    selected={editor.selected}
                    onSelect={(keys) => select(keys, true)}
                    encoded={encoded}
                    originalEncoded={encoded}
                    preview={step === 3 ? preview : undefined}
                  />
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['all', rows.length],
                        ['changed', drafts.length],
                        ['pending', pending.length],
                        ['failed', failed.length],
                      ] as const
                    ).map(([value, count]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={filter === value}
                        disabled={disabled}
                        onClick={() => applyFilter(value)}
                        className={`rounded-full border px-3 py-1 text-xs ${filter === value ? 'border-primary bg-primary-50 text-primary' : 'border-default-200 text-default-600'}`}
                      >
                        {t(`qc.workflow.filters.${value}`)} · {count}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>
                      {editor.selected.length} {t('qc.selected')}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      className="text-primary"
                      onClick={() => select([])}
                    >
                      {t('qc.clear_selection')}
                    </button>
                    {(step === 3 || step === 4) && (
                      <>
                        <Button
                          size="sm"
                          variant="flat"
                          isDisabled={disabled || !editor.workspace.undo.length}
                          onPress={editor.undo}
                        >
                          {t('qc.undo')}
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          isDisabled={disabled || !editor.workspace.redo.length}
                          onPress={editor.redo}
                        >
                          {t('qc.redo')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="text-sm text-primary"
                    aria-expanded={showTable}
                    onClick={() => setShowTable(!showTable)}
                  >
                    {t(
                      showTable
                        ? 'qc.workflow.hide_table'
                        : 'qc.workflow.show_table'
                    )}
                  </button>
                  <label className="text-sm">
                    {t('qc.show')}{' '}
                    <select
                      className={control}
                      value={filter}
                      disabled={disabled}
                      onChange={(event) => applyFilter(event.target.value)}
                    >
                      {['all', 'changed', 'selected', 'pending', 'failed'].map(
                        (value) => (
                          <option key={value} value={value}>
                            {t(`qc.workflow.filters.${value}`)}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>
                {showTable && (
                  <>
                    {step === 3 && (
                      <label className="flex flex-col gap-1 text-sm">
                        {t('qc.workflow.cell_reason')}
                        <input
                          className={control}
                          value={cellReason}
                          maxLength={2000}
                          disabled={blocked}
                          onChange={(event) =>
                            setCellReason(event.target.value)
                          }
                        />
                      </label>
                    )}
                    <QcTable
                      rows={shown}
                      unit={editor.stream?.unit}
                      utcOffset={editor.utcOffset}
                      drafts={editor.workspace.drafts}
                      constraints={editor.constraints}
                      selected={editor.selected}
                      onSelect={select}
                      onEdit={(key, value) =>
                        editor.edit(key, value, cellReason)
                      }
                      onReview={(keys) => {
                        editor.setError('')
                        setReviewKeys(keys)
                      }}
                      disabled={blocked}
                      editable={step === 3 && !!cellReason.trim()}
                      reviewable={step === 4 && editor.confirmed}
                      serviceMode={editor.serviceMode}
                      encoded={encoded}
                      originalEncoded={encoded}
                      page={page}
                      onPage={setPage}
                    />
                  </>
                )}
              </section>
            </>
          )}

          {step === 5 && (
            <section className="space-y-4 rounded-lg border border-default-200 p-4">
              <QcObservationExport
                workspace={editor.workspace}
                streamKey={editor.key}
                utcOffset={editor.utcOffset}
                versioningEnabled={isVersioningEnabled}
                disabled={blocked}
                onCommitMessageChange={editor.setCommitMessage}
              />
              <Button
                className="w-full"
                variant="flat"
                isDisabled={
                  blocked || (!drafts.length && !editor.workspace.audit?.length)
                }
                onPress={() => exportDrafts({ [editor.key]: editor.workspace })}
              >
                {t('qc.observation_export.backup')}
              </Button>
            </section>
          )}
          {step === 5 && <QcAuditLog entries={editor.workspace.audit ?? []} />}
        </div>
      )}

      <footer
        ref={navigationRef}
        aria-label={t('qc.workflow.navigation')}
        className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-teal-600 bg-teal-50 pb-[env(safe-area-inset-bottom)] shadow-lg dark:border-teal-400 dark:bg-teal-950"
      >
        <div className="mx-auto flex w-full max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Button
            variant="flat"
            isDisabled={disabled}
            onPress={() => (step === 1 ? router.push('/') : go(step - 1))}
          >
            {t('general.back')}
          </Button>
          <div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs font-medium text-default-700">
              {t('qc.workflow.progress', { step, total: STEPS.length })}
            </span>
            <QcResources
              loaded={editor.loaded}
              stream={editor.stream}
              workspace={editor.workspace}
              selected={editor.selected}
              slots={editor.slots}
              start={editor.start}
              end={editor.end}
            />
          </div>
          <div className="flex max-w-full flex-wrap justify-end gap-2">
            {step === 1 && (
              <Button
                color="primary"
                isDisabled={
                  disabled || !editor.streamId || !editor.start || !editor.end
                }
                isLoading={editor.busy.startsWith('Loading observations')}
                onPress={async () => {
                  if (
                    (editor.loaded && !editor.rangeChanged) ||
                    (await editor.load())
                  )
                    go(2)
                }}
              >
                {t('qc.workflow.load_next')}
              </Button>
            )}
            {step === 2 && (
              <Button
                variant="light"
                isDisabled={blocked || !editor.confirmed}
                onPress={() => go(4)}
              >
                {t('qc.workflow.skip_corrections')}
              </Button>
            )}
            {step > 1 && step < 5 && (
              <Button
                color="primary"
                isDisabled={blocked || !editor.confirmed}
                onPress={() => go(step + 1)}
              >
                {t(`qc.workflow.next.${STEPS[step]}`)}
              </Button>
            )}
          </div>
        </div>
      </footer>
      {reviewKeys && (
        <QcHumanReview
          count={reviewKeys.length}
          serviceMode={editor.serviceMode}
          error={editor.error}
          onClose={() => setReviewKeys(null)}
          onApply={(state, reason) => editor.review(reviewKeys, state, reason)}
        />
      )}
      {editor.busy && (
        <dialog
          ref={(node) => {
            if (node && !node.open) node.showModal()
          }}
          onCancel={(event) => event.preventDefault()}
          aria-labelledby="qc-loading-label"
          className="fixed inset-0 m-0 grid h-dvh max-h-none w-screen max-w-none place-items-center border-0 bg-content1/80 p-6 text-foreground backdrop:bg-black/20 backdrop:backdrop-blur-sm"
        >
          <div
            role="status"
            aria-live="polite"
            className="flex max-w-md flex-col items-center gap-4 text-center"
          >
            <Spinner size="lg" color="primary" aria-hidden="true" />
            <p id="qc-loading-label" className="text-lg font-medium">
              {editor.busy}
            </p>
          </div>
        </dialog>
      )}
    </main>
  )
}
