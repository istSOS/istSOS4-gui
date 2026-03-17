'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Chip } from '@heroui/chip'
import dayjs from 'dayjs'

import { useTemporal } from '@/context/TemporalContext'

export default function TemporalBadge() {
  const { mode, asOf, fromTo, reset } = useTemporal()

  if (mode === 'current') {
    return (
      <Chip size="sm" color="success" variant="flat" data-testid="temporal-badge-current">
        ● Live
      </Chip>
    )
  }

  if (mode === 'as_of') {
    const label = asOf ? dayjs(asOf).format('MMM D, YYYY, HH:mm') : 'Not set'
    return (
      <Chip
        size="sm"
        color="warning"
        variant="flat"
        onClose={reset}
        data-testid="temporal-badge-as-of"
      >
        ◷ As-of: {label}
      </Chip>
    )
  }

  const fromLabel = fromTo?.[0] ? dayjs(fromTo[0]).format('MMM D, YYYY HH:mm') : '-'
  const toLabel = fromTo?.[1] ? dayjs(fromTo[1]).format('MMM D, YYYY HH:mm') : '-'
  return (
    <Chip
      size="sm"
      color="primary"
      variant="flat"
      onClose={reset}
      data-testid="temporal-badge-from-to"
    >
      ↔ {fromLabel} – {toLabel}
    </Chip>
  )
}
