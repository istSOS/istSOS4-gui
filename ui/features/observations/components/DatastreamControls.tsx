'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@heroui/popover'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CloseIcon, MoreIcon, PlusIcon } from '@/components/icons'

import {
  type DatastreamChoice,
  searchDatastreams,
} from '../lib/datastreamSelection'
import {
  SERIES_COLORS,
  type SeriesAppearance,
  type SeriesAppearances,
  resolveAppearance,
} from '../lib/seriesAppearance'

function StyleMenu({
  choice,
  style,
  color,
  onChange,
}: {
  choice: DatastreamChoice
  style?: SeriesAppearance
  color: string
  onChange: (key: string, value: SeriesAppearance | null) => void
}) {
  const { t } = useTranslation()
  const current = resolveAppearance(style, color)
  const update = (patch: SeriesAppearance) =>
    onChange(choice.key, { ...style, ...patch })
  return (
    <Popover placement="bottom-end" classNames={{ base: 'z-[6100]' }}>
      <PopoverTrigger>
        <button
          type="button"
          className="rounded p-1 text-default-500 hover:bg-default-100"
          aria-label={t('observations.style_for', {
            name: choice.datastream.name,
          })}
        >
          <MoreIcon size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[80dvh] w-64 items-stretch gap-3 overflow-y-auto p-4">
        <p className="truncate text-sm font-semibold">
          {t('observations.appearance')}
        </p>
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm">
            {t('observations.display_as')}
          </legend>
          {(['line', 'bar'] as const).map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-default-100"
            >
              <input
                type="radio"
                name={`display-${choice.key}`}
                value={type}
                checked={current.type === type}
                onChange={() => update({ type })}
              />
              {t(`observations.chart_types.${type}`)}
            </label>
          ))}
        </fieldset>
        {current.type === 'line' && (
          <>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm">{t('observations.line')}</legend>
              {(['solid', 'dashed', 'dotted', 'none'] as const).map((line) => (
                <label
                  key={line}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-default-100"
                >
                  <input
                    type="radio"
                    name={`line-${choice.key}`}
                    value={line}
                    checked={current.line === line}
                    onChange={() =>
                      update({
                        line,
                        ...(line === 'none' ? { points: true } : {}),
                      })
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="w-6 shrink-0 text-center"
                    style={{ color: current.color }}
                  >
                    {line === 'none' ? (
                      '●'
                    ) : (
                      <span
                        className="block border-t-2"
                        style={{ borderTopStyle: line }}
                      />
                    )}
                  </span>
                  {t(`observations.lines.${line}`)}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.points}
                disabled={current.line === 'none'}
                onChange={(event) => update({ points: event.target.checked })}
              />
              {t('observations.points')}
            </label>
          </>
        )}
        <fieldset className="space-y-2">
          <legend className="text-sm">{t('observations.color')}</legend>
          <div className="flex flex-wrap gap-2">
            {SERIES_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={t('observations.use_color', { color })}
                aria-pressed={current.color.toLowerCase() === color}
                className="h-6 w-6 rounded-full border-2 border-default-200 aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2"
                style={{ background: color }}
                onClick={() => update({ color })}
              />
            ))}
          </div>
          <label className="flex items-center justify-between gap-2 text-sm">
            {t('observations.custom_color')}
            <input
              type="color"
              aria-label={t('observations.custom_color')}
              value={current.color}
              onChange={(event) => update({ color: event.target.value })}
            />
          </label>
        </fieldset>
        <button
          type="button"
          className="text-left text-sm text-primary"
          onClick={() => onChange(choice.key, null)}
        >
          {t('observations.reset_style')}
        </button>
      </PopoverContent>
    </Popover>
  )
}

/** Search admits streams to the legend; grey entries can always replace B. */
export default function DatastreamControls({
  choices,
  listedKeys,
  activeKeys,
  onToggle,
  onRemove,
  styles,
  onStyleChange,
  snapshots,
}: {
  choices: DatastreamChoice[]
  listedKeys: string[]
  activeKeys: string[]
  onToggle: (key: string) => void
  onRemove: (key: string) => void
  styles: SeriesAppearances
  onStyleChange: (key: string, value: SeriesAppearance | null) => void
  snapshots: boolean
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const picker = useRef<HTMLDetailsElement>(null)
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (picker.current && !picker.current.contains(event.target as Node))
        picker.current.open = false
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  const results = useMemo(
    () => searchDatastreams(choices, query),
    [choices, query]
  )
  return (
    <div
      className="shrink-0 space-y-2"
      aria-label={t('observations.datastreams')}
    >
      <div
        className="relative flex flex-wrap items-center gap-2"
        aria-label={t('observations.stream_legend')}
      >
        {listedKeys.map((key) => {
          const choice = choices.find((choice) => choice.key === key)
          if (!choice) return null
          const slot = activeKeys.indexOf(key)
          const active = slot >= 0
          const defaultColor = slot === 0 ? SERIES_COLORS[0] : '#fb923c'
          const style = resolveAppearance(styles[key], defaultColor)
          return (
            <div
              key={key}
              className={`flex max-w-full sm:max-w-[26rem] items-center rounded border ${active ? 'border-default-300 bg-content1' : 'border-default-200 bg-default-100'}`}
            >
              <button
                type="button"
                aria-pressed={active}
                title={choice.label}
                className={`flex min-w-0 items-center gap-2 px-2 py-1.5 text-left text-xs ${active ? '' : 'text-default-500'}`}
                onClick={() => onToggle(key)}
              >
                {style.type === 'bar' ? (
                  <span
                    aria-hidden
                    className="w-7 shrink-0 text-center"
                    style={{ color: active ? style.color : '#9ca3af' }}
                  >
                    ▂▆▄
                  </span>
                ) : (
                  <span
                    aria-hidden
                    className="w-7 shrink-0 border-t-2"
                    style={{
                      borderColor: active ? style.color : '#9ca3af',
                      borderTopStyle:
                        style.line === 'dashed'
                          ? 'dashed'
                          : style.line === 'dotted'
                            ? 'dotted'
                            : 'solid',
                    }}
                  />
                )}
                <span className="shrink-0 font-semibold">
                  {active ? (snapshots ? 'A/B' : slot === 0 ? 'A' : 'B') : '○'}
                </span>
                <span className="truncate">
                  {[choice.thing?.name, choice.datastream.name]
                    .filter(Boolean)
                    .join(' · ') || choice.label}
                </span>
              </button>
              <StyleMenu
                choice={choice}
                style={styles[key]}
                color={defaultColor}
                onChange={onStyleChange}
              />
              <button
                type="button"
                className="rounded p-1 text-default-500 hover:bg-default-200 disabled:opacity-30"
                aria-label={t('observations.remove_stream', {
                  name: choice.datastream.name,
                })}
                disabled={active && activeKeys.length === 1}
                onClick={() => onRemove(key)}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          )
        })}
        <details
          ref={picker}
          className="shrink-0"
          onToggle={(event) => {
            if (event.currentTarget.open) search.current?.focus()
          }}
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded border border-default-300 px-3 py-1.5 text-sm text-primary">
            <PlusIcon size={16} />
            {t('observations.add_datastream')}
          </summary>
          <div className="absolute left-0 top-full z-30 mt-1 w-[min(540px,82vw)] rounded-lg border border-default-200 bg-content1 p-3 shadow-xl">
            <input
              ref={search}
              type="search"
              aria-label={t('observations.search_streams')}
              placeholder={t('observations.search_streams')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  if (picker.current) {
                    picker.current.open = false
                    picker.current.querySelector('summary')?.focus()
                  }
                }
              }}
              className="mb-2 w-full rounded border border-default-300 bg-content1 px-3 py-2 text-sm"
            />
            <ul
              className="max-h-64 overflow-y-auto"
              aria-label={t('observations.search_results')}
            >
              {results.map((choice) => (
                <li key={choice.key}>
                  <button
                    type="button"
                    disabled={activeKeys.includes(choice.key)}
                    className="flex w-full items-start justify-between gap-3 rounded px-2 py-2 text-left text-sm hover:bg-default-100 disabled:opacity-50"
                    onClick={() => {
                      onToggle(choice.key)
                      if (picker.current) {
                        picker.current.open = false
                        picker.current.querySelector('summary')?.focus()
                      }
                      setQuery('')
                    }}
                  >
                    <span>{choice.label}</span>
                    <span className="shrink-0 text-xs text-primary">
                      {t(
                        activeKeys.includes(choice.key)
                          ? 'observations.plotted'
                          : 'observations.show_stream'
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {!results.length && (
                <li className="p-3 text-sm text-default-500">
                  {t('observations.no_streams')}
                </li>
              )}
            </ul>
          </div>
        </details>
      </div>
    </div>
  )
}
