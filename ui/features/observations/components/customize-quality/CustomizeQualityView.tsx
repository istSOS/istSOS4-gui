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

/**
 * @file features/observations/components/customize-quality/CustomizeQualityView.tsx
 *
 * The chart modal's second view: a guided editor for how a datastream's
 * `resultQuality` values are read.
 *
 * It replaces the chart view inside the same modal rather than opening beside
 * it. The right of the chart already belongs to the reading details rail, and
 * the modal is already as large as the page allows — so this view takes the
 * modal's height instead: the controls row becomes a one-line context bar, the
 * chart becomes a fixed preview, and the steps get the rest, scrolling on
 * their own under a pinned footer.
 *
 * Nothing is saved until the last step. Until then every edit is a draft that
 * the preview, the legend and the value list re-read live.
 */

import { Button } from '@heroui/button'
import {
  useImperativeHandle,
  useMemo,
  useState,
  type Ref,
} from 'react'
import { useTranslation } from 'react-i18next'

import type { Datastream, Observation } from '@/types/domain'

import {
  buildRows,
  type GraphSeriesEntry,
} from '../../lib/observationGraphUtils'
import {
  saveQualityScheme,
  type QualitySchemeScope,
} from '../../lib/qualitySchemeStore'
import {
  ISTSOS_QUALITY_SCHEME,
  sameQualityScheme,
  tallyQuality,
  type QualityScheme,
} from '../../lib/resultQuality'
import { useQualitySchemeResolver } from '../../lib/useQualitySchemes'
import QualityLegend from '../QualityLegend'
import QualityPreviewChart from './QualityPreviewChart'
import ReviewStep from './ReviewStep'
import RulesStep from './RulesStep'
import StartStep, { type StartChoice } from './StartStep'
import { distinctStoredValues } from './StoredValues'

/** A datastream the rules can be written for, with the readings on screen. */
export type QualityCustomizeTarget = {
  key: string
  datastream: Datastream
  observations: Observation[]
}

export type CustomizeQualityHandle = {
  /** Leave the view — straight away, or after confirming a discard. */
  requestExit: () => void
}

type Step = 1 | 2 | 3
const STEPS: Array<{ step: Step; key: string }> = [
  { step: 1, key: 'start' },
  { step: 2, key: 'rules' },
  { step: 3, key: 'review' },
]

const clone = (scheme: QualityScheme): QualityScheme =>
  JSON.parse(JSON.stringify(scheme))

const datastreamLabel = (datastream: Datastream) =>
  String(
    datastream?.name ??
      datastream?.['@iot.id'] ??
      datastream?.id ??
      ''
  )

function sourceLabel(datastream: Datastream) {
  if (datastream?.__sourceName) return datastream.__sourceName
  const endpoint = String(datastream?.__sourceEndpoint ?? '')
  try {
    return endpoint ? new URL(endpoint).host : ''
  } catch {
    return endpoint
  }
}

export default function CustomizeQualityView({
  targets,
  windowLabel,
  onExit,
  ref,
}: {
  targets: QualityCustomizeTarget[]
  /** The time range on screen, already formatted. */
  windowLabel?: string | null
  onExit: () => void
  ref?: Ref<CustomizeQualityHandle>
}) {
  const { t } = useTranslation()
  const resolveScheme = useQualitySchemeResolver()

  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? '')
  const target = targets.find((entry) => entry.key === targetKey) ?? targets[0]
  const current = resolveScheme(target?.datastream)
  const initialScope: QualitySchemeScope =
    current.source === 'source' ? 'source' : 'datastream'

  const [draft, setDraft] = useState<QualityScheme>(() => clone(current.scheme))
  const [choice, setChoice] = useState<StartChoice>('current')
  const [scope, setScope] = useState<QualitySchemeScope>(initialScope)
  const [step, setStep] = useState<Step>(1)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const dirty =
    !sameQualityScheme(draft, current.scheme) || scope !== initialScope

  useImperativeHandle(
    ref,
    () => ({
      requestExit: () => {
        if (dirty) setConfirmingDiscard(true)
        else onExit()
      },
    }),
    [dirty, onExit]
  )

  const primaryColor = useMemo(() => {
    if (typeof window === 'undefined') return '#008374'
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#008374'
    )
  }, [])

  const observations = target?.observations
  const currentRows = useMemo(
    () => buildRows(observations ?? [], current.scheme),
    [observations, current.scheme]
  )
  const draftRows = useMemo(
    () => buildRows(observations ?? [], draft),
    [observations, draft]
  )
  const values = useMemo(() => distinctStoredValues(draftRows), [draftRows])
  const currentTally = useMemo(() => tallyQuality(currentRows), [currentRows])
  const draftTally = useMemo(() => tallyQuality(draftRows), [draftRows])

  const previewEntry = useMemo<GraphSeriesEntry | null>(() => {
    if (!target) return null
    const ds = target.datastream
    return {
      id: target.key,
      name: datastreamLabel(ds),
      unit: String(ds?.unitOfMeasurement?.symbol ?? ''),
      observedProperty: String(ds?.ObservedProperty?.name ?? ''),
      rows: draftRows,
      qualityScheme: draft,
    }
  }, [target, draftRows, draft])

  if (!target) return null

  const switchTarget = (key: string) => {
    const next = targets.find((entry) => entry.key === key)
    if (!next) return
    const resolved = resolveScheme(next.datastream)
    setTargetKey(key)
    setDraft(clone(resolved.scheme))
    setScope(resolved.source === 'source' ? 'source' : 'datastream')
    setChoice('current')
    setStep(1)
  }

  const editDraft = (next: QualityScheme) => {
    setDraft(next)
    setChoice('edited')
  }

  const save = (scheme: QualityScheme) => {
    saveQualityScheme(target.datastream, scope, scheme)
    onExit()
  }

  const stepTab = (step: Step, key: string, done: boolean, active: boolean) => (
    <button
      key={key}
      type="button"
      aria-current={active ? 'step' : undefined}
      onClick={() => setStep(step)}
      className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2 pt-2.5 text-[12.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        active
          ? 'border-primary font-semibold'
          : 'border-transparent text-default-500 hover:text-foreground'
      }`}
    >
      <span
        aria-hidden
        className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full text-[10.5px] font-semibold ${
          active
            ? 'bg-primary text-primary-foreground'
            : done
              ? 'bg-primary-50 text-primary'
              : 'border border-default-300'
        }`}
      >
        {done ? '✓' : step}
      </span>
      {t(`quality.customize.steps.${key}`)}
    </button>
  )

  const segButton = (value: QualitySchemeScope, label: string) => (
    <button
      type="button"
      aria-pressed={scope === value}
      onClick={() => setScope(value)}
      className={`px-2.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        scope === value
          ? 'bg-primary-50 font-semibold text-primary'
          : 'text-default-500 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Context bar — stands in for the Thing / property / range controls,
          which are fixed while rules for this datastream are being written. */}
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-xs text-default-500">
        {targets.length > 1 ? (
          <label className="inline-flex items-center gap-2">
            <span>{t('quality.customize.datastream')}</span>
            <select
              className="rounded-md border border-default-300 bg-content1 px-1.5 py-0.5 text-xs font-semibold text-foreground disabled:opacity-60"
              value={target.key}
              disabled={dirty}
              title={dirty ? t('quality.customize.datastream_locked') : undefined}
              onChange={(event) => switchTarget(event.target.value)}
            >
              {targets.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {datastreamLabel(entry.datastream)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="font-semibold text-foreground">
            {datastreamLabel(target.datastream)}
          </span>
        )}
        <span className="tabular-nums">
          {windowLabel ? `${windowLabel} · ` : ''}
          {t('quality.customize.readings', { count: draftRows.length })}
        </span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-2">
          <span>{t('quality.customize.apply_to')}</span>
          <span
            role="group"
            aria-label={t('quality.customize.apply_to')}
            className="inline-flex overflow-hidden rounded-md border border-default-300 bg-content1"
          >
            {segButton('datastream', t('quality.customize.scope_datastream'))}
            {segButton('source', t('quality.customize.scope_source'))}
          </span>
        </span>
      </div>

      {/* Preview: the same readings under the rules in use and under the draft. */}
      <div className="h-[clamp(140px,24vh,210px)] shrink-0">
        {previewEntry && draftRows.length > 0 ? (
          <QualityPreviewChart
            entry={previewEntry}
            currentRows={currentRows}
            currentScheme={current.scheme}
            draftRows={draftRows}
            draftScheme={draft}
            primaryColor={primaryColor}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-default-300 text-xs text-default-500">
            {t('quality.customize.no_readings')}
          </div>
        )}
      </div>
      {draftRows.length > 0 && (
        <div className="shrink-0">
          <QualityLegend
            lanes={[
              { tally: draftTally, baseline: currentTally, scheme: draft },
            ]}
          />
          <p className="m-0 pl-[50px] pt-0.5 text-[11px] text-default-400">
            {t('quality.customize.preview_hint')}
          </p>
        </div>
      )}

      <nav
        aria-label={t('quality.customize.title')}
        className="mt-1.5 flex shrink-0 gap-1 overflow-x-auto border-b border-default-200"
      >
        {STEPS.map(({ step: value, key }) =>
          stepTab(value, key, step > value, step === value)
        )}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-0.5 pb-2.5 pt-3.5">
        {step === 1 && (
          <StartStep
            choice={choice}
            currentScheme={current.scheme}
            draftScheme={draft}
            values={values}
            onChoose={(next, scheme) => {
              setChoice(next)
              setDraft(clone(scheme))
            }}
          />
        )}
        {step === 2 && (
          <RulesStep
            draftScheme={draft}
            currentScheme={current.scheme}
            draftRows={draftRows}
            values={values}
            onChange={editDraft}
          />
        )}
        {step === 3 && (
          <ReviewStep
            currentScheme={current.scheme}
            draftScheme={draft}
            currentTally={currentTally}
            draftTally={draftTally}
            values={values}
            scope={scope}
            datastreamName={datastreamLabel(target.datastream)}
            sourceName={sourceLabel(target.datastream)}
            onLabelsChange={(labels) => {
              const next = { ...draft }
              if (labels) next.labels = labels
              else delete next.labels
              setDraft(next)
            }}
          />
        )}
      </div>

      {/* Pinned, so Save is always one press away however long a step runs. */}
      <div className="-mx-4 -mb-4 flex shrink-0 flex-wrap items-center gap-2 border-t border-default-200 px-4 py-2.5">
        {confirmingDiscard ? (
          <>
            <span className="min-w-[160px] flex-1 text-xs font-medium text-warning-700">
              {t('quality.customize.footer.discard_question')}
            </span>
            <Button size="sm" variant="bordered" radius="sm" onPress={() => setConfirmingDiscard(false)}>
              {t('quality.customize.footer.keep')}
            </Button>
            <Button size="sm" color="danger" radius="sm" onPress={onExit}>
              {t('quality.customize.footer.discard')}
            </Button>
          </>
        ) : (
          <>
            <span className="min-w-[160px] flex-1 text-xs text-default-500">
              {dirty
                ? step < 3
                  ? t('quality.customize.footer.draft_early')
                  : t('quality.customize.footer.draft_final')
                : t('quality.customize.footer.no_changes')}
            </span>
            {step === 3 && current.source !== 'default' && (
              <Button
                size="sm"
                variant="light"
                radius="sm"
                onPress={() => save(ISTSOS_QUALITY_SCHEME)}
              >
                {t('quality.customize.footer.restore')}
              </Button>
            )}
            <Button
              size="sm"
              variant="light"
              radius="sm"
              onPress={() => (dirty ? setConfirmingDiscard(true) : onExit())}
            >
              {t('quality.customize.footer.cancel')}
            </Button>
            {step > 1 && (
              <Button
                size="sm"
                variant="bordered"
                radius="sm"
                onPress={() => setStep((step - 1) as Step)}
              >
                {t('quality.customize.footer.back')}
              </Button>
            )}
            {step < 3 ? (
              <Button
                size="sm"
                color="primary"
                radius="sm"
                onPress={() => setStep((step + 1) as Step)}
              >
                {t('quality.customize.footer.next')}
              </Button>
            ) : (
              <Button
                size="sm"
                color="primary"
                radius="sm"
                isDisabled={!dirty}
                onPress={() => save(draft)}
              >
                {t('quality.customize.footer.save')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
