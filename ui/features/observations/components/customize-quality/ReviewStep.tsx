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

import { useTranslation } from 'react-i18next'

import type { QualitySchemeScope } from '../../lib/qualitySchemeStore'
import {
  QUALITY_CLASSES,
  QUALITY_COLORS,
  QUALITY_LABEL_KEYS,
  classifyQuality,
  judgedCount,
  qualityLabel,
  type QualityClass,
  type QualityScheme,
  type QualityTally,
} from '../../lib/resultQuality'
import type { StoredValue } from './StoredValues'

function Verdict({
  qualityClass,
  scheme,
  strong = false,
}: {
  qualityClass: QualityClass
  scheme: QualityScheme
  strong?: boolean
}) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: QUALITY_COLORS[qualityClass] }}
      />
      <span className={strong ? 'font-semibold' : ''}>
        {qualityLabel(qualityClass, scheme, t)}
      </span>
    </span>
  )
}

const passRate = (tally: QualityTally) => {
  const judged = judgedCount(tally)
  return judged ? `${Math.round((tally.pass / judged) * 100)}%` : '—'
}

export default function ReviewStep({
  currentScheme,
  draftScheme,
  currentTally,
  draftTally,
  values,
  scope,
  datastreamName,
  sourceName,
  onLabelsChange,
}: {
  currentScheme: QualityScheme
  draftScheme: QualityScheme
  currentTally: QualityTally
  draftTally: QualityTally
  values: StoredValue[]
  scope: QualitySchemeScope
  datastreamName: string
  sourceName: string
  onLabelsChange: (labels: QualityScheme['labels']) => void
}) {
  const { t } = useTranslation()

  const changes = values
    .map((value) => ({
      ...value,
      before: classifyQuality(value.quality, currentScheme),
      after: classifyQuality(value.quality, draftScheme),
    }))
    .filter((value) => value.before !== value.after)
  const moved = changes.reduce((sum, value) => sum + value.count, 0)

  const kpi = 'min-w-[150px] rounded-lg border border-default-200 px-3 py-2'

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2.5">
          <div className={kpi}>
            <div className="text-[11px] text-default-500">
              {t('quality.customize.review.pass_rate')}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {passRate(currentTally)}
              <span className="mx-1 font-normal text-default-400">→</span>
              {passRate(draftTally)}
            </div>
          </div>
          <div className={kpi}>
            <div className="text-[11px] text-default-500">
              {t('quality.customize.review.changed')}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {moved.toLocaleString()}
            </div>
          </div>
          <div className={kpi}>
            <div className="text-[11px] text-default-500">
              {t('quality.customize.review.not_checked')}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {currentTally.none.toLocaleString()}
              <span className="mx-1 font-normal text-default-400">→</span>
              {draftTally.none.toLocaleString()}
            </div>
          </div>
        </div>
        {changes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-default-200 text-left text-[11px] text-default-500">
                  <th className="px-2 py-1 font-semibold">{t('quality.customize.review.value')}</th>
                  <th className="px-2 py-1 text-right font-semibold">
                    {t('quality.customize.review.readings')}
                  </th>
                  <th className="px-2 py-1 font-semibold">{t('quality.customize.review.now')}</th>
                  <th className="px-2 py-1 font-semibold">{t('quality.customize.review.new')}</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((value) => (
                  <tr key={value.quality ?? 'none'} className="border-b border-default-200">
                    <td className="px-2 py-1 font-mono tabular-nums">
                      {value.quality ?? t('quality.customize.values.no_value')}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {value.count.toLocaleString()}
                    </td>
                    <td className="px-2 py-1">
                      <Verdict qualityClass={value.before} scheme={currentScheme} />
                    </td>
                    <td className="px-2 py-1">
                      <Verdict qualityClass={value.after} scheme={draftScheme} strong />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-default-300 p-2.5 text-xs text-default-500">
            {t('quality.customize.review.same')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-default-200 px-3 py-2.5">
          <div className="text-[13px] font-semibold">
            {t('quality.customize.review.saves_to')}
          </div>
          <p className="m-0 text-xs text-default-500">
            {scope === 'datastream'
              ? t('quality.customize.review.saves_datastream', { name: datastreamName })
              : t('quality.customize.review.saves_source', { source: sourceName })}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-default-200 px-3 py-2.5">
          <div className="text-[13px] font-semibold">
            {t('quality.customize.review.labels_title')}{' '}
            <span className="font-normal text-default-500">
              ({t('quality.customize.review.labels_optional')})
            </span>
          </div>
          <p className="m-0 text-[11px] text-default-500">
            {t('quality.customize.review.labels_note')}
          </p>
          {QUALITY_CLASSES.map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-md border border-default-200 px-2 py-1 focus-within:border-primary"
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: QUALITY_COLORS[key] }}
              />
              <input
                id={`quality-label-${key}`}
                className="w-full min-w-0 bg-transparent text-xs outline-none"
                maxLength={40}
                placeholder={t(QUALITY_LABEL_KEYS[key])}
                value={draftScheme.labels?.[key] ?? ''}
                onChange={(event) => {
                  const labels = { ...(draftScheme.labels ?? {}) }
                  if (event.target.value.trim()) labels[key] = event.target.value
                  else delete labels[key]
                  onLabelsChange(Object.keys(labels).length ? labels : undefined)
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
