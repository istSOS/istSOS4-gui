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

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { GraphRow } from '../../lib/observationGraphUtils'
import {
  QUALITY_CLASSES,
  QUALITY_COLORS,
  QUALITY_OPS,
  classifyQuality,
  findShadowedRules,
  isRuleComplete,
  qualityLabel,
  type QualityClass,
  type QualityOp,
  type QualityRule,
  type QualityScheme,
} from '../../lib/resultQuality'
import StoredValues, { type StoredValue } from './StoredValues'

const fieldClass =
  'rounded-md border border-default-300 bg-content1 px-1.5 py-0.5 text-xs focus:border-primary focus:outline-none'

const parseNumber = (text: string): number | null => {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

const parseList = (text: string): number[] =>
  text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite)

/**
 * A number typed into a rule.
 *
 * The text is kept as typed and only its parsed value is handed up, so "-" or
 * "9." on the way to a number are not wiped by a re-render. When the value
 * changes from outside (rows reordered, a preset loaded) the field shows that
 * value instead of stale text.
 */
function NumberField({
  value,
  onChange,
  label,
}: {
  value: number | null | undefined
  onChange: (value: number | null) => void
  label: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const shown = parseNumber(text) === (value ?? null) ? text : value == null ? '' : String(value)
  return (
    <input
      className={`${fieldClass} w-16 font-mono tabular-nums`}
      inputMode="decimal"
      aria-label={label}
      value={shown}
      onChange={(event) => {
        setText(event.target.value)
        onChange(parseNumber(event.target.value))
      }}
    />
  )
}

function ListField({
  values,
  onChange,
  label,
}: {
  values: number[]
  onChange: (values: number[]) => void
  label: string
}) {
  const [text, setText] = useState(values.join(', '))
  const same = (a: number[], b: number[]) =>
    a.length === b.length && a.every((value, index) => value === b[index])
  const shown = same(parseList(text), values) ? text : values.join(', ')
  return (
    <input
      className={`${fieldClass} w-28 font-mono tabular-nums`}
      aria-label={label}
      placeholder="90, 91"
      value={shown}
      onChange={(event) => {
        setText(event.target.value)
        onChange(parseList(event.target.value))
      }}
    />
  )
}

function VerdictSelect({
  value,
  scheme,
  allowNone,
  onChange,
}: {
  value: QualityClass
  scheme: QualityScheme
  allowNone: boolean
  onChange: (value: QualityClass) => void
}) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: QUALITY_COLORS[value] }}
      />
      <select
        className={fieldClass}
        aria-label={t('quality.customize.rules.verdict')}
        value={value}
        onChange={(event) => onChange(event.target.value as QualityClass)}
      >
        {QUALITY_CLASSES.filter((key) => allowNone || key !== 'none').map((key) => (
          <option key={key} value={key}>
            {qualityLabel(key, scheme, t)}
          </option>
        ))}
      </select>
    </span>
  )
}

const iconButton =
  'h-6 w-6 rounded text-[13px] leading-none text-default-500 hover:bg-default-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'

export default function RulesStep({
  draftScheme,
  currentScheme,
  draftRows,
  values,
  onChange,
}: {
  draftScheme: QualityScheme
  currentScheme: QualityScheme
  draftRows: GraphRow[]
  values: StoredValue[]
  onChange: (scheme: QualityScheme) => void
}) {
  const { t } = useTranslation()
  const rules = draftScheme.rules
  const shadowed = findShadowedRules(draftScheme)

  const perRule = rules.map(() => 0)
  let fallbackCount = 0
  let noValueCount = 0
  for (const row of draftRows) {
    if (typeof row.qualityRule === 'number') perRule[row.qualityRule] += 1
    else if (row.qualityRule === 'fallback') fallbackCount += 1
    else noValueCount += 1
  }

  const setRules = (next: QualityRule[]) => onChange({ ...draftScheme, rules: next })
  const updateRule = (index: number, patch: Partial<QualityRule>) =>
    setRules(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)))

  const changeOp = (index: number, op: QualityOp) => {
    const rule = rules[index]
    const patch: Partial<QualityRule> = { op }
    // Carry the operand across so switching "is" to "is between" or "is one
    // of" starts from what was typed rather than from empty.
    if (op === 'between' && rule.max == null && rule.value != null) {
      patch.max = rule.value
    }
    if (op === 'in' && !(rule.values?.length) && rule.value != null) {
      patch.values = [rule.value]
    }
    if (rule.op === 'in' && op !== 'in' && rule.value == null && rule.values?.length) {
      patch.value = rule.values[0]
    }
    updateRule(index, patch)
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...rules]
    const [rule] = next.splice(index, 1)
    next.splice(index + by, 0, rule)
    setRules(next)
  }

  const addRuleFor = (quality: number) => {
    // A rule for one stored value only earns its place if it changes that
    // value's verdict, so it starts on the other side of pass/fail.
    const verdict = classifyQuality(quality, draftScheme) === 'pass' ? 'suspect' : 'pass'
    setRules([{ op: 'eq', value: quality, verdict }, ...rules])
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <div className="mb-2 text-[13px] font-semibold">
          {t('quality.customize.rules.intro')}
        </div>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rules.length === 0 && (
            <li className="rounded-lg border border-dashed border-default-300 p-2.5 text-xs text-default-500">
              {t('quality.customize.rules.empty')}
            </li>
          )}
          {rules.map((rule, index) => {
            const incomplete = !isRuleComplete(rule)
            const shadow = shadowed[index]
            const warn = incomplete || !!shadow
            return (
              <li
                key={index}
                className={`grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg border px-2 py-1.5 ${
                  warn ? 'border-warning/60' : 'border-default-200'
                }`}
              >
                <span className="text-right text-[11px] tabular-nums text-default-400">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-default-500">{t('quality.customize.rules.if')}</span>
                  <select
                    className={fieldClass}
                    aria-label={t('quality.customize.rules.condition')}
                    value={rule.op}
                    onChange={(event) => changeOp(index, event.target.value as QualityOp)}
                  >
                    {QUALITY_OPS.map((op) => (
                      <option key={op} value={op}>
                        {t(`quality.customize.rules.op.${op}`)}
                      </option>
                    ))}
                  </select>
                  {rule.op === 'in' ? (
                    <ListField
                      values={rule.values ?? []}
                      label={t('quality.customize.rules.values')}
                      onChange={(next) => updateRule(index, { values: next })}
                    />
                  ) : (
                    <NumberField
                      value={rule.value}
                      label={
                        rule.op === 'between'
                          ? t('quality.customize.rules.from')
                          : t('quality.customize.rules.value')
                      }
                      onChange={(next) => updateRule(index, { value: next })}
                    />
                  )}
                  {rule.op === 'between' && (
                    <>
                      <span className="text-default-500">{t('quality.customize.rules.and')}</span>
                      <NumberField
                        value={rule.max}
                        label={t('quality.customize.rules.to')}
                        onChange={(next) => updateRule(index, { max: next })}
                      />
                    </>
                  )}
                  <span className="text-default-500">{t('quality.customize.rules.mark')}</span>
                  <VerdictSelect
                    value={rule.verdict}
                    scheme={draftScheme}
                    allowNone
                    onChange={(verdict) => updateRule(index, { verdict })}
                  />
                </div>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={t('quality.customize.rules.move_up')}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={t('quality.customize.rules.move_down')}
                    disabled={index === rules.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={t('quality.customize.rules.delete')}
                    onClick={() => setRules(rules.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                </div>
                <div className="col-start-2 col-end-4 flex flex-wrap gap-x-3 text-[11px] text-default-500">
                  <span>{t('quality.customize.rules.count', { count: perRule[index] })}</span>
                  {incomplete ? (
                    <span className="font-medium text-warning-700">
                      {t('quality.customize.rules.incomplete')}
                    </span>
                  ) : shadow ? (
                    <span className="font-medium text-warning-700">
                      {t('quality.customize.rules.shadowed', {
                        rules: shadow.map((i) => i + 1).join(', '),
                      })}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
        <button
          type="button"
          className="mt-2 rounded-md border border-default-300 px-2.5 py-1 text-xs font-medium hover:bg-default-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          onClick={() =>
            setRules([...rules, { op: 'le', value: null, verdict: 'suspect' }])
          }
        >
          {t('quality.customize.rules.add')}
        </button>

        <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
          <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg border border-dashed border-default-300 px-2 py-1.5">
            <span className="text-right text-[11px] text-default-400">·</span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-default-500">{t('quality.customize.rules.otherwise')}</span>
              <span className="text-default-400">→</span>
              <VerdictSelect
                value={draftScheme.fallback}
                scheme={draftScheme}
                allowNone={false}
                onChange={(verdict) =>
                  onChange({
                    ...draftScheme,
                    fallback: verdict as QualityScheme['fallback'],
                  })
                }
              />
            </div>
            <span className="text-[11px] text-default-400">
              {t('quality.customize.rules.fallback_tag')}
            </span>
            <div className="col-start-2 col-end-4 text-[11px] text-default-500">
              {t('quality.customize.rules.count', { count: fallbackCount })}
            </div>
          </li>
          <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-lg border border-dashed border-default-300 px-2 py-1.5">
            <span className="text-right text-[11px] text-default-400">·</span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-default-500">{t('quality.customize.rules.no_value')}</span>
              <span className="text-default-400">→</span>
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: QUALITY_COLORS.none }}
              />
              <span>{qualityLabel('none', draftScheme, t)}</span>
            </div>
            <span className="text-[11px] text-default-400">
              {t('quality.customize.rules.fixed_tag')}
            </span>
            <div className="col-start-2 col-end-4 text-[11px] text-default-500">
              {t('quality.customize.rules.count', { count: noValueCount })} ·{' '}
              {t('quality.customize.rules.no_value_note')}
            </div>
          </li>
        </ol>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold">
          {t('quality.customize.values.title')}
        </div>
        <StoredValues
          values={values}
          currentScheme={currentScheme}
          draftScheme={draftScheme}
          onAddRule={addRuleFor}
        />
        <p className="m-0 text-[11px] text-default-500">
          {t('quality.customize.values.note_rules')}
        </p>
      </div>
    </div>
  )
}
