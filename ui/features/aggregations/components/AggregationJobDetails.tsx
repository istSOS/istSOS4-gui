'use client'

import { Button } from '@heroui/button'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal'
import { useTranslation } from 'react-i18next'

import type { AggregationJob } from '../lib/types'

export function jobTimestamp(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, ' UTC')
    : value
}

export function jobRunState(job: AggregationJob) {
  if (job.jobStatus?.toLowerCase() === 'running') return 'running'
  const status = job.lastRunStatus?.toLowerCase()
  if (status === 'success' || status === 'succeeded') return 'success'
  if (status === 'failed' || status === 'failure') return 'failed'
  return status ? 'other' : 'never'
}

export default function AggregationJobDetails({
  job,
  onClose,
}: {
  job: AggregationJob | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const value = (raw: unknown) => {
    if (raw == null || raw === '') return t('aggregations.notSet')
    if (typeof raw === 'boolean')
      return t(raw ? 'aggregations.yes' : 'aggregations.no')
    return Array.isArray(raw)
      ? raw.join(', ') || t('aggregations.notSet')
      : String(raw)
  }
  const fields = [
    'aggregation',
    'bucketInterval',
    'bucketTimezone',
    'conversionFactor',
    'minObservations',
    'expectedObservationInterval',
    'maxConsecutiveMissing',
    'boundaryMode',
    'bucketsToRecompute',
    'systemTimeIncremental',
    'systemTimeOverlap',
    'resultQualityKey',
    'resultQualityAllowed',
    'resultQualityMin',
    'resultQualityMax',
    'availabilityMaxAge',
    'emptyBucketPolicy',
    'emptyBucketResultQuality',
    'scheduleInterval',
    'scheduleDelay',
    'scheduleTimezone',
    'fixedSchedule',
  ] as const
  return (
    <Modal isOpen={!!job} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          {t('aggregations.jobDetails', { id: job?.id })}
        </ModalHeader>
        <ModalBody>
          {job && (
            <>
              <p className="font-medium">
                {job.sourceDatastream.name ?? `#${job.sourceDatastream.id}`} →{' '}
                {job.targetDatastream.name ?? `#${job.targetDatastream.id}`}
              </p>
              <p className="text-sm text-default-500">
                {t('aggregations.detailsHint')}
              </p>
              <dl className="grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field} className="border-b border-default-100 py-2">
                    <dt className="text-default-500">
                      {t(`aggregations.fields.${field}`)}
                    </dt>
                    <dd className="mt-0.5 break-words font-medium">
                      {[
                        'aggregation',
                        'bucketInterval',
                        'boundaryMode',
                        'emptyBucketPolicy',
                      ].includes(field) && job[field]
                        ? t(`aggregations.options.${job[field]}`)
                        : value(job[field])}
                    </dd>
                  </div>
                ))}
                <div className="border-b border-default-100 py-2">
                  <dt className="text-default-500">
                    {t('aggregations.fields.availabilityDatastreams')}
                  </dt>
                  <dd>
                    {value(
                      job.availabilityDatastreams?.map(
                        (stream) => stream.name ?? `#${stream.id}`
                      )
                    )}
                  </dd>
                </div>
                {(
                  [
                    'nextRunAt',
                    'lastRunStartedAt',
                    'lastSuccessfulFinish',
                  ] as const
                ).map((field) => (
                  <div key={field} className="border-b border-default-100 py-2">
                    <dt className="text-default-500">
                      {t(`aggregations.${field}`)}
                    </dt>
                    <dd>{jobTimestamp(job[field])}</dd>
                  </div>
                ))}
                {(
                  [
                    'totalRuns',
                    'totalSuccesses',
                    'totalFailures',
                    'lastRunDuration',
                  ] as const
                ).map((field) => (
                  <div key={field} className="border-b border-default-100 py-2">
                    <dt className="text-default-500">
                      {t(`aggregations.${field}`)}
                    </dt>
                    <dd>{value(job[field])}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('general.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
