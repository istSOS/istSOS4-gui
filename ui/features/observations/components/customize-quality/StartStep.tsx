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

import {
  ISTSOS_QUALITY_SCHEME,
  QUALITY_PRESETS,
  matchQuality,
  sameQualityScheme,
  type QualityPresetKey,
  type QualityScheme,
} from '../../lib/resultQuality'
import StoredValues, { type StoredValue } from './StoredValues'

/** Which starting point is picked: the rules in use, a preset, or neither. */
export type StartChoice = 'current' | QualityPresetKey | 'edited'

/**
 * How many of the stored values a scheme explains — values a rule names, as
 * opposed to ones left to the fallback. A preset that explains everything in
 * the window is almost certainly the convention the data was written in.
 */
function explains(scheme: QualityScheme, values: StoredValue[]) {
  const stored = values.filter((value) => value.quality !== null)
  return {
    hit: stored.filter(
      (value) => typeof matchQuality(value.quality, scheme).rule === 'number'
    ).length,
    of: stored.length,
  }
}

export default function StartStep({
  choice,
  currentScheme,
  draftScheme,
  values,
  onChoose,
}: {
  choice: StartChoice
  currentScheme: QualityScheme
  draftScheme: QualityScheme
  values: StoredValue[]
  onChoose: (choice: StartChoice, scheme: QualityScheme) => void
}) {
  const { t } = useTranslation()
  const currentIsDefault = sameQualityScheme(currentScheme, ISTSOS_QUALITY_SCHEME)

  const options: Array<{
    key: StartChoice
    name: string
    desc: string
    scheme: QualityScheme
  }> = [
    {
      key: 'current',
      name: currentIsDefault
        ? t('quality.customize.start.current_default')
        : t('quality.customize.start.current'),
      desc: t('quality.customize.start.current_desc'),
      scheme: currentScheme,
    },
    ...(Object.keys(QUALITY_PRESETS) as QualityPresetKey[])
      // "Current" already is the istSOS index when nothing is customised.
      .filter((key) => !(key === 'istsos' && currentIsDefault))
      .map((key) => ({
        key,
        name: t(`quality.customize.preset.${key}.name`),
        desc: t(`quality.customize.preset.${key}.desc`),
        scheme: QUALITY_PRESETS[key] as QualityScheme,
      })),
  ]

  const fits = new Map(options.map((option) => [option.key, explains(option.scheme, values)]))
  let bestKey: StartChoice | null = null
  let bestHit = 0
  for (const option of options) {
    const hit = fits.get(option.key)?.hit ?? 0
    if (option.key !== 'blank' && hit > bestHit) {
      bestHit = hit
      bestKey = option.key
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div>
        <div className="mb-2 text-[13px] font-semibold">
          {t('quality.customize.start.question')}
        </div>
        <div
          role="radiogroup"
          aria-label={t('quality.customize.steps.start')}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {options.map((option) => {
            const checked = choice === option.key
            const fit = fits.get(option.key)
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => onChoose(option.key, option.scheme)}
                className={`relative flex flex-col gap-1 rounded-lg border py-2.5 pl-9 pr-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  checked
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-300'
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute left-3 top-3 h-3.5 w-3.5 rounded-full border-2 ${
                    checked ? 'border-[4.5px] border-primary' : 'border-default-300'
                  }`}
                />
                {option.key === bestKey && (
                  <span className="absolute right-2.5 top-2 rounded-full bg-primary-50 px-2 text-[10px] font-semibold text-primary">
                    {t('quality.customize.start.best_fit')}
                  </span>
                )}
                <span className="pr-16 text-[13px] font-semibold">{option.name}</span>
                <span className="text-xs text-default-500">{option.desc}</span>
                {option.key !== 'blank' && fit && fit.of > 0 && (
                  <span className="text-[11px] text-default-400">
                    {t('quality.customize.start.explains', fit)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold">
          {t('quality.customize.values.title')}
        </div>
        <StoredValues
          values={values}
          currentScheme={currentScheme}
          draftScheme={draftScheme}
        />
        <p className="m-0 text-[11px] text-default-500">
          {t('quality.customize.values.note_start')}
        </p>
      </div>
    </div>
  )
}
