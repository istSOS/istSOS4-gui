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
import { Card } from '@heroui/card'
import { Chip } from '@heroui/chip'
import dayjs from 'dayjs'

import { HistoryResponse } from '@/features/history/types'

const actionColorMap = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
} as const

export default function HistoryDetails({
  data,
  loading,
}: {
  data: HistoryResponse | null
  loading: boolean
}) {
  if (loading) {
    return <p className="text-[var(--color-text-primary)]">Loading history…</p>
  }

  if (!data) {
    return <p className="text-[var(--color-text-secondary)]">No history data loaded.</p>
  }

  return (
    <div className="space-y-4">
      <Card className="section-card p-5 md:p-6">
        <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Entity snapshots</p>
        <div className="space-y-3">
          {data.value.map((snapshot) => (
            <div
              key={`${snapshot.id}-${snapshot.snapshotAt}`}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-semibold text-[var(--color-text-primary)]">{snapshot.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {dayjs(snapshot.snapshotAt).format('MMM D, YYYY HH:mm')}
                </p>
              </div>
              <p className="mb-1 text-sm text-[var(--color-text-secondary)]">{snapshot.description}</p>
              <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
                systemTimeValidity: {snapshot.systemTimeValidity || '-'}
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs text-[var(--color-text-secondary)] md:grid-cols-2">
                {Object.entries(snapshot.meta).map(([key, value]) => (
                  <p key={key}>
                    <span className="text-[var(--color-text-tertiary)]">{key}:</span> {value}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="section-card p-5 md:p-6">
        <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Commit history with field-level diff</p>
        <div className="space-y-3">
          {data.commits.map((commit) => (
            <div key={commit.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{commit.entityName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {commit.author} · {dayjs(commit.date).format('MMM D, YYYY HH:mm')}
                  </p>
                </div>
                <Chip size="sm" color={actionColorMap[commit.actionType]} variant="flat">
                  {commit.actionType}
                </Chip>
              </div>
              <p className="mb-2 text-sm text-[var(--color-text-secondary)]">{commit.message}</p>
              {commit.fieldDiff.length > 0 ? (
                <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                  {commit.fieldDiff.map((diff, index) => (
                    <p key={`${commit.id}-${diff.field}-${index}`}>
                      <span className="text-[var(--color-text-tertiary)]">{diff.field}</span>: “{diff.before}” → “{diff.after}”
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-tertiary)]">No field diff for this action.</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
