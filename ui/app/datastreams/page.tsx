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

import PhantomEditWarning from '@/components/PhantomEditWarning'
import TemporalConflictWarning from '@/components/TemporalConflictWarning'
import TemporalModeSwitch from '@/components/TemporalModeSwitch'
import { useTemporalQuery } from '@/components/hooks/useTemporalQuery'

import { useTemporal } from '@/context/TemporalContext'

type Datastream = {
  '@iot.id': number
  name: string
  description: string
  observationType: string
  phenomenonTime?: string
  systemTimeValidity?: string
}

export default function DatastreamsPage() {
  const { mode, asOf } = useTemporal()
  const { data, loading, error, activeUrl } = useTemporalQuery<{
    value: Datastream[]
  }>('/api/datastreams')

  const items = data?.value || []

  return (
    <div className="min-h-screen p-4 space-y-3">
      <h1 className="text-3xl font-bold text-white">Datastreams</h1>
      <TemporalModeSwitch />

      <Card className="p-2 bg-white/10 text-white/80 text-xs font-mono overflow-auto">
        GET {activeUrl}
      </Card>

      {mode !== 'current' && <PhantomEditWarning />}
      {mode !== 'current' && items.length === 0 && (
        <TemporalConflictWarning asOf={mode === 'as_of' ? asOf : null} />
      )}

      {loading && <p className="text-white">Loading...</p>}
      {error && <p className="text-danger">{error.message}</p>}

      <Table aria-label="Datastreams table" removeWrapper>
        <TableHeader>
          <TableColumn>ID</TableColumn>
          <TableColumn>Name</TableColumn>
          <TableColumn>Description</TableColumn>
          <TableColumn>Observation Type</TableColumn>
          <TableColumn>Phenomenon Time</TableColumn>
          <TableColumn>System validity</TableColumn>
        </TableHeader>
        <TableBody emptyContent="No datastreams found" items={items}>
          {(item) => (
            <TableRow key={item['@iot.id']}>
              <TableCell>{item['@iot.id']}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell>{item.observationType}</TableCell>
              <TableCell>{item.phenomenonTime || '-'}</TableCell>
              <TableCell>{item.systemTimeValidity || '-'}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
