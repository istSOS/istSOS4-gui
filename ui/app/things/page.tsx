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
import { Card } from '@heroui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/table'
import * as React from 'react'

import TemporalConflictWarning from '@/components/TemporalConflictWarning'
import TemporalModeSwitch from '@/components/TemporalModeSwitch'
import { useTemporalQuery } from '@/components/hooks/useTemporalQuery'

import { useTemporal } from '@/context/TemporalContext'

type Thing = {
  '@iot.id': number
  name: string
  description: string
  systemTimeValidity?: string
}

export default function ThingsPage() {
  const { mode, asOf } = useTemporal()
  const { data, loading, error, activeUrl } = useTemporalQuery<{ value: Thing[] }>(
    '/api/things'
  )

  const items = data?.value || []

  return (
    <div className="page-shell">
      <div className="page-container space-y-8">
        <div className="page-header">
          <h1 className="page-title">Things</h1>
          <p className="page-subtitle">Review entity metadata across live and historical states.</p>
        </div>

        <Card className="section-card p-5 md:p-6">
          <div className="space-y-4">
            <TemporalModeSwitch />
            <div className="overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 font-mono text-xs text-[var(--color-text-secondary)]">
              GET {activeUrl}
            </div>
          </div>
        </Card>

        {mode !== 'current' && items.length === 0 && (
          <TemporalConflictWarning asOf={mode === 'as_of' ? asOf : null} />
        )}

        {loading && <p className="text-[var(--color-text-primary)]">Loading...</p>}
        {error && <p className="text-danger">{error.message}</p>}

        <Card className="section-card p-3 md:p-4">
          <Table
            aria-label="Things table"
            removeWrapper
            classNames={{
              th: '!bg-[var(--color-surface-elevated)] !text-[var(--color-text-secondary)]',
              td: 'text-[var(--color-text-primary)]',
              tr: 'border-b border-[var(--color-border)]',
            }}
          >
            <TableHeader>
              <TableColumn>ID</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn>System validity</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No things found" items={items}>
              {(item) => (
                <TableRow key={item['@iot.id']}>
                  <TableCell>{item['@iot.id']}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.systemTimeValidity || '-'}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
