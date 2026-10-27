'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from './QcButton'
import QcExplanation from './QcExplanation'

import { QC_LIMITS } from '../lib/limits'
import { canMeasurePageMemory, measurePageMemory } from '../lib/pageMemory'
import type { PageMemoryReader } from '../lib/pageMemory'
import type { LoadedData, QcDatastream, Workspace } from '../lib/types'
import { qcWorkload } from '../lib/workload'

type Sample = { bytes: number; time: number }

export default function QcResources(props: {
  loaded: LoadedData | null
  stream?: QcDatastream
  workspace: Workspace
  selected: string[]
  slots: number[]
  start: string
  end: string
}) {
  const { t, i18n } = useTranslation()
  const { loaded, stream, workspace, selected, slots, start, end } = props
  const workload = useMemo(
    () =>
      qcWorkload({
        loaded,
        stream,
        workspace,
        selected,
        slots,
        start,
        end,
      }),
    [loaded, stream, workspace, selected, slots, start, end]
  )
  const [supported, setSupported] = useState<boolean | null>(null)
  const [measuring, setMeasuring] = useState(false)
  const [failed, setFailed] = useState(false)
  // Two numeric readings only: no serialized workspaces, sampling history,
  // browser storage, telemetry, automatic polling or deprecated heap counters.
  const [memory, setMemory] = useState<{
    baseline: Sample
    latest: Sample
  } | null>(null)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  useEffect(() => {
    mounted.current = true
    Promise.resolve().then(() => {
      if (mounted.current)
        setSupported(
          canMeasurePageMemory(
            window.performance as Performance & PageMemoryReader,
            window.crossOriginIsolated === true
          )
        )
    })
    return () => {
      mounted.current = false
    }
  }, [])

  async function measure() {
    if (inFlight.current || !supported) return
    inFlight.current = true
    setMeasuring(true)
    setFailed(false)
    try {
      const sample = await measurePageMemory(
        window.performance as Performance & PageMemoryReader,
        window.crossOriginIsolated === true
      )
      if (mounted.current)
        setMemory((previous) => ({
          baseline: previous?.baseline ?? sample,
          latest: sample,
        }))
    } catch {
      if (mounted.current) setFailed(true)
    } finally {
      inFlight.current = false
      if (mounted.current) setMeasuring(false)
    }
  }

  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language).format(value)
  const mib = (value: number) =>
    `${new Intl.NumberFormat(i18n.language, {
      maximumFractionDigits: 1,
    }).format(value / 1048576)} MiB`
  const tone =
    workload.status === 'limit'
      ? 'text-danger'
      : workload.status === 'heavy'
        ? 'text-warning-700'
        : workload.status === 'normal'
          ? 'text-success-700'
          : 'text-default-500'
  const metrics: Array<[string, number]> = [
    ['observations', workload.period],
    ['context', workload.context],
    ['modified', workload.modified],
    ['checks', workload.checks],
    ['targets', workload.targets],
    ['buffer', workload.buffer],
    ['work', workload.bufferValues],
    ['undo', workspace.undo.length + workspace.redo.length],
    ['audit', workspace.audit?.length ?? 0],
  ]

  return (
    <div
      className="inline-flex max-w-full items-center gap-1 text-xs"
      aria-label={t('qc.resources.title')}
    >
      <QcExplanation
        icon
        title={t('qc.resources.title')}
        content={
          <div className="space-y-4">
            <p className={tone}>
              {t(`qc.resources.states.${workload.status}`)}
            </p>
            <dl className="space-y-1 text-xs">
              {metrics.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt>{t(`qc.resources.metrics.${label}`)}</dt>
                  <dd className="shrink-0 tabular-nums">
                    {Number.isFinite(value) ? number(value) : '—'}
                  </dd>
                </div>
              ))}
              {workload.expected !== null && (
                <div className="flex justify-between gap-4">
                  <dt>{t('qc.resources.expected')}</dt>
                  <dd className="tabular-nums">{number(workload.expected)}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-default-500">
              {t('qc.resources.work_hint')}
            </p>
            {workload.expected !== null && (
              <p className="text-xs text-default-500">
                {t('qc.resources.expected_hint')}
              </p>
            )}
            <div className="space-y-1 border-t border-default-200 pt-3 text-xs">
              <p>
                {t('qc.resources.limit_hint', {
                  observations: number(QC_LIMITS.observations),
                  context: number(QC_LIMITS.contextBuffer),
                  preview: number(QC_LIMITS.previewRows),
                })}
              </p>
              {workload.limits.map((limit) => (
                <p key={limit} className="text-danger">
                  {t(`qc.resources.limits.${limit}`)}
                </p>
              ))}
              {workload.status === 'heavy' && (
                <p className="text-warning-700">
                  {t('qc.resources.heavy_hint')}
                </p>
              )}
            </div>
            <section
              className="space-y-2 border-t border-default-200 pt-3"
              aria-label={t('qc.resources.memory')}
            >
              <h4 className="font-medium">{t('qc.resources.memory')}</h4>
              {memory && (
                <dl className="space-y-1 text-xs">
                  {[
                    [t('qc.resources.latest'), mib(memory.latest.bytes)],
                    [t('qc.resources.baseline'), mib(memory.baseline.bytes)],
                    [
                      t('qc.resources.change'),
                      `${memory.latest.bytes >= memory.baseline.bytes ? '+' : '−'}${mib(Math.abs(memory.latest.bytes - memory.baseline.bytes))}`,
                    ],
                    [
                      t('qc.resources.measured_at'),
                      new Date(memory.latest.time).toLocaleTimeString(
                        i18n.language
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {supported === null ? (
                <p className="text-xs text-default-500">
                  {t('qc.resources.detecting')}
                </p>
              ) : !supported ? (
                <p className="text-xs text-default-500">
                  {t('qc.resources.unavailable')}
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="flat"
                  isDisabled={measuring}
                  onPress={() => void measure()}
                >
                  {t(
                    measuring
                      ? 'qc.resources.measuring'
                      : 'qc.resources.measure'
                  )}
                </Button>
              )}
              {failed && (
                <p role="status" className="text-xs text-warning-700">
                  {t('qc.resources.failed')}
                </p>
              )}
              <p className="text-xs text-default-500">
                {t('qc.resources.memory_hint')}
              </p>
            </section>
            <p className="text-xs text-default-500">
              {t('qc.resources.backend_hint')}
            </p>
          </div>
        }
      >
        <span className={`inline-flex flex-wrap items-center gap-1 ${tone}`}>
          <span aria-hidden="true">●</span>
          {t('qc.resources.indicator', {
            state: t(`qc.resources.states.${workload.status}`),
          })}
          {loaded && (
            <span className="hidden text-default-500 sm:inline">
              {' '}
              · {t('qc.resources.row_count', { count: workload.period })}
            </span>
          )}
        </span>
      </QcExplanation>
    </div>
  )
}
