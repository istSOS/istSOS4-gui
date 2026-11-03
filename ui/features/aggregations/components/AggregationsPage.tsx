'use client'

import { Button } from '@heroui/button'
import { Chip } from '@heroui/chip'
import { Input } from '@heroui/input'
import { Spinner } from '@heroui/spinner'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import NextLink from 'next/link'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

import { getDataSourceToken } from '@/lib/dataSourceTokens'

import AggregationForm, { aggregationControl } from './AggregationForm'
import AggregationJobDetails, {
  jobRunState,
  jobTimestamp,
} from './AggregationJobDetails'

import { canManageAggregations } from '../lib/access'
import { AggregationRequestError, aggregationRequest } from '../lib/client'
import type {
  AggregationCreate,
  AggregationDatastream,
  AggregationJob,
  AggregationSource,
  AggregationTargetPayload,
} from '../lib/types'

function AggregationWorkspace({
  source,
  token,
  onBusyChange,
}: {
  source: AggregationSource
  token: string | null
  onBusyChange: (busy: boolean) => void
}) {
  const { t } = useTranslation()
  const [jobs, setJobs] = useState<AggregationJob[] | null>(null)
  const [streams, setStreams] = useState<AggregationDatastream[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [error, setError] = useState<AggregationRequestError | null>(null)
  const [success, setSuccess] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [catalogRefresh, setCatalogRefresh] = useState(0)
  const [creating, setCreating] = useState(false)
  const [mutation, setMutation] = useState<number | 'create' | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const alive = useRef(true)
  const mutationAbort = useRef<AbortController | null>(null)
  const listAbort = useRef<AbortController | null>(null)
  const mutationLock = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      mutationAbort.current?.abort()
    }
  }, [])
  useEffect(() => {
    onBusyChange(mutation !== null)
    return () => onBusyChange(false)
  }, [mutation, onBusyChange])

  useEffect(() => {
    const controller = new AbortController()
    listAbort.current = controller
    setLoading(true)
    setError(null)
    aggregationRequest(source.id, token, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setJobs(data.jobs)
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setError(problem)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [source.id, token, refresh])

  useEffect(() => {
    if (!creating || streams !== null) return
    const controller = new AbortController()
    setCatalogLoading(true)
    setError(null)
    aggregationRequest(source.id, token, {
      catalog: true,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setStreams(data.datastreams)
      })
      .catch((problem) => {
        if (!controller.signal.aborted) setError(problem)
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false)
      })
    return () => controller.abort()
  }, [creating, streams, source.id, token, catalogRefresh])

  const mutate = async (
    payload: AggregationCreate | AggregationJob,
    target?: AggregationTargetPayload
  ): Promise<AggregationDatastream | undefined> => {
    if (mutationLock.current) return
    mutationLock.current = true
    const isCreate = !('id' in payload)
    listAbort.current?.abort()
    setLoading(false)
    setMutation(isCreate ? 'create' : payload.id)
    setError(null)
    setSuccess('')
    const controller = new AbortController()
    mutationAbort.current = controller
    let confirmedTarget: AggregationDatastream | undefined
    try {
      if (target) {
        const created = await aggregationRequest(source.id, token, {
          resource: 'target',
          method: 'POST',
          body: { target },
          signal: controller.signal,
        })
        confirmedTarget = created.datastream
        if (!alive.current) return
        setStreams((previous) => [
          ...(previous ?? []).filter(
            (stream) => stream.id !== confirmedTarget.id
          ),
          confirmedTarget,
        ])
      }
      const data = await aggregationRequest(source.id, token, {
        method: isCreate ? 'POST' : 'PATCH',
        body: isCreate
          ? {
              job: {
                ...payload,
                ...(confirmedTarget
                  ? { targetDatastream: confirmedTarget.name }
                  : {}),
              },
            }
          : { id: payload.id, enabled: !payload.enabled },
        signal: controller.signal,
      })
      if (!alive.current) return
      setJobs((previous) =>
        [
          ...(previous ?? []).filter((job) => job.id !== data.job.id),
          data.job,
        ].sort((a, b) => a.id - b.id)
      )
      if (isCreate) setCreating(false)
      setSuccess(
        isCreate ? 'created' : data.job.enabled ? 'resumed' : 'suspended'
      )
      setRefresh((value) => value + 1)
      return undefined
    } catch (problem) {
      if (alive.current && !controller.signal.aborted)
        setError(problem as AggregationRequestError)
    } finally {
      mutationLock.current = false
      if (alive.current) setMutation(null)
    }
    return confirmedTarget
  }
  const busy = mutation !== null
  const filtered = (jobs ?? []).filter((job) => {
    const matches =
      `${job.id} ${job.sourceDatastream.name ?? ''} ${job.targetDatastream.name ?? ''} ${job.aggregation ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'enabled'
          ? job.enabled
          : filter === 'suspended'
            ? !job.enabled
            : jobRunState(job) === 'failed'))
    )
  })
  const failed = (jobs ?? []).filter(
    (job) => jobRunState(job) === 'failed'
  ).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <Chip variant="flat">
            {t('aggregations.jobCount', { count: jobs?.length ?? 0 })}
          </Chip>
          <Chip variant="flat" color="success">
            {t('aggregations.enabledCount', {
              count: jobs?.filter((job) => job.enabled).length ?? 0,
            })}
          </Chip>
          {!!failed && (
            <Chip variant="flat" color="danger">
              {t('aggregations.failedCount', { count: failed })}
            </Chip>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="bordered"
            isDisabled={busy || loading}
            onPress={() => setRefresh((value) => value + 1)}
          >
            {t('aggregations.refresh')}
          </Button>
          <Button
            size="sm"
            color="primary"
            isDisabled={busy || jobs === null || creating || loading}
            onPress={() => {
              setCreating(true)
              setSuccess('')
            }}
          >
            {t('aggregations.newJob')}
          </Button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700"
        >
          <p>{t(`aggregations.errors.${error.code ?? 'request'}`)}</p>
          {error.detail && error.code !== 'unsupportedCompleteness' && (
            <p className="mt-1">{error.detail}</p>
          )}
          {error.code === 'access' && (
            <NextLink
              className="mt-2 inline-block underline"
              href="/data-sources"
            >
              {t('aggregations.manageLogins')}
            </NextLink>
          )}
          {jobs !== null && error.code !== 'unsupportedCompleteness' && (
            <p className="mt-1">{t('aggregations.hints.refreshAfterError')}</p>
          )}
        </div>
      )}
      {success && (
        <p
          role="status"
          className="rounded-lg bg-success-50 p-3 text-sm text-success-700"
        >
          {t(`aggregations.messages.${success}`)}
        </p>
      )}
      {creating &&
        (streams === null ? (
          <div className="rounded-xl border border-default-200 bg-content1 p-5">
            {catalogLoading ? (
              <Spinner label={t('aggregations.loadingDatastreams')} />
            ) : (
              <div className="flex gap-2">
                <Button onPress={() => setCatalogRefresh((value) => value + 1)}>
                  {t('aggregations.retry')}
                </Button>
                <Button variant="light" onPress={() => setCreating(false)}>
                  {t('general.cancel')}
                </Button>
              </div>
            )}
          </div>
        ) : streams.length ? (
          <AggregationForm
            streams={streams}
            sourceId={source.id}
            token={token}
            busy={busy}
            onCreate={async (payload, target) => {
              return await mutate(payload, target)
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <div className="rounded-xl border border-default-200 bg-content1 p-5">
            <p className="mb-3 text-sm">{t('aggregations.noDatastreams')}</p>
            <Button onPress={() => setCreating(false)}>
              {t('general.close')}
            </Button>
          </div>
        ))}
      <section
        className="overflow-hidden rounded-xl border border-default-200 bg-content1 shadow-sm"
        aria-label={t('aggregations.jobs')}
        aria-busy={loading}
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-default-200 p-4">
          <Input
            className="max-w-sm"
            aria-label={t('aggregations.search')}
            placeholder={t('aggregations.search')}
            value={search}
            onValueChange={setSearch}
            isClearable
          />
          <label className="text-sm">
            <span className="sr-only">{t('aggregations.filter')}</span>
            <select
              className={aggregationControl}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {['all', 'enabled', 'suspended', 'failed'].map((value) => (
                <option key={value} value={value}>
                  {t(`aggregations.filters.${value}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading && (
          <div className="p-5">
            <Spinner size="sm" label={t('aggregations.loading')} />
          </div>
        )}
        {jobs !== null && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{t('aggregations.jobs')}</caption>
                <thead className="bg-default-50 text-xs text-default-600">
                  <tr>
                    {[
                      'datastreams',
                      'calculation',
                      'status',
                      'lastRun',
                      'nextRunAt',
                      'actions',
                    ].map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="px-4 py-3 font-medium"
                      >
                        {t(`aggregations.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-100">
                  {filtered.map((job) => {
                    const state = jobRunState(job)
                    return (
                      <tr
                        key={job.id}
                        className="align-top hover:bg-default-50"
                      >
                        <th
                          scope="row"
                          className="min-w-48 px-4 py-4 font-normal"
                        >
                          <span className="block font-medium">
                            {job.sourceDatastream.name ??
                              `#${job.sourceDatastream.id}`}
                          </span>
                          <span className="mt-1 block text-default-500">
                            →{' '}
                            {job.targetDatastream.name ??
                              `#${job.targetDatastream.id}`}
                          </span>
                          <span className="mt-1 block text-xs text-default-400">
                            #{job.id}
                          </span>
                        </th>
                        <td className="px-4 py-4">
                          <span className="block whitespace-nowrap">
                            {t(`aggregations.options.${job.aggregation}`)}
                          </span>
                          <span className="mt-1 block whitespace-nowrap text-default-500">
                            {t(`aggregations.options.${job.bucketInterval}`)}
                          </span>
                          <span className="mt-1 block text-xs text-default-400">
                            {job.bucketTimezone}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Chip
                            size="sm"
                            variant="flat"
                            color={job.enabled ? 'success' : 'default'}
                          >
                            {t(
                              job.enabled
                                ? 'aggregations.filters.enabled'
                                : 'aggregations.filters.suspended'
                            )}
                          </Chip>
                        </td>
                        <td className="px-4 py-4">
                          <Chip
                            size="sm"
                            variant="flat"
                            color={
                              state === 'failed'
                                ? 'danger'
                                : state === 'success'
                                  ? 'success'
                                  : 'default'
                            }
                          >
                            {state === 'other'
                              ? job.lastRunStatus
                              : t(`aggregations.runStates.${state}`)}
                          </Chip>
                          <span className="mt-2 block whitespace-nowrap text-xs text-default-500">
                            {jobTimestamp(job.lastRunStartedAt)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-default-500">
                          {job.enabled ? jobTimestamp(job.nextRunAt) : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="light"
                              onPress={() => setDetailId(job.id)}
                              aria-label={t('aggregations.jobDetails', {
                                id: job.id,
                              })}
                            >
                              {t('aggregations.details')}
                            </Button>
                            <Button
                              size="sm"
                              variant="flat"
                              color={job.enabled ? 'default' : 'primary'}
                              isDisabled={busy || loading}
                              isLoading={mutation === job.id}
                              aria-label={t(
                                job.enabled
                                  ? 'aggregations.suspendJob'
                                  : 'aggregations.resumeJob',
                                { id: job.id }
                              )}
                              onPress={() => {
                                void mutate(job)
                              }}
                            >
                              {t(
                                job.enabled
                                  ? 'aggregations.suspend'
                                  : 'aggregations.resume'
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="px-5 py-12 text-center">
                <p className="font-medium">
                  {t(
                    jobs.length
                      ? 'aggregations.noMatches'
                      : 'aggregations.empty'
                  )}
                </p>
                {!jobs.length && (
                  <p className="mt-2 text-sm text-default-500">
                    {t('aggregations.emptyHint')}
                  </p>
                )}
              </div>
            )}
            <p className="border-t border-default-100 px-4 py-3 text-xs text-default-500">
              {t('aggregations.utcHint')}
            </p>
          </>
        )}
      </section>
      <AggregationJobDetails
        job={jobs?.find((job) => job.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}

export default function AggregationsPage({
  sources,
}: {
  sources: AggregationSource[]
}) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [sourceId, setSourceId] = useState(
    sources.find((source) => source.isPrimary)?.id ?? sources[0]?.id ?? ''
  )
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const source = sources.find((item) => item.id === sourceId)
  const sourceToken =
    mounted && source?.authorizationEnabled
      ? source.isPrimary
        ? (token ?? getDataSourceToken(source.endpoint))
        : getDataSourceToken(source.endpoint)
      : null
  const allowed =
    source && canManageAggregations(sourceToken, source.authorizationEnabled)
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-default-50 px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('aggregations.title')}</h1>
            <p className="mt-1 max-w-3xl text-sm text-default-500">
              {t('aggregations.subtitle')}
            </p>
          </div>
          <Button as={NextLink} href="/" size="sm" variant="bordered">
            {t('data_sources.back_to_map')}
          </Button>
        </header>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-default-200 bg-content1 p-4">
          <label className="flex w-full max-w-sm flex-col gap-1.5 text-sm font-medium">
            {t('aggregations.source')}
            <select
              className={aggregationControl}
              value={sourceId}
              disabled={busy}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p className="pb-2 text-xs text-default-500">
            {t('aggregations.liveHint')}
          </p>
        </div>
        {!mounted ? (
          <Spinner label={t('aggregations.loading')} />
        ) : !allowed ? (
          <div
            role="alert"
            className="rounded-xl border border-warning-200 bg-warning-50 p-5 text-sm text-warning-800"
          >
            <p>{t('aggregations.errors.access')}</p>
            <NextLink
              className="mt-2 inline-block underline"
              href={
                source?.isPrimary && siteConfig.authorizationEnabled && !token
                  ? '/login'
                  : '/data-sources'
              }
            >
              {t('aggregations.manageLogins')}
            </NextLink>
          </div>
        ) : (
          <AggregationWorkspace
            key={source.id}
            source={source}
            token={sourceToken}
            onBusyChange={setBusy}
          />
        )}
      </div>
    </main>
  )
}
