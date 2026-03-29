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
import { NextResponse } from 'next/server'

import {
  HistoryCommit,
  HistoryEntityType,
  HistoryResponse,
  HistorySnapshot,
} from '@/features/history/types'

const ENTITY_TYPES: HistoryEntityType[] = [
  'Thing',
  'Sensor',
  'Datastream',
  'Location',
  'ObservedProperty',
  'FeatureOfInterest',
]

const SNAPSHOTS: Record<HistoryEntityType, HistorySnapshot[]> = {
  Thing: [
    {
      id: 1,
      label: 'Weather Station Alpha',
      description: 'Main station metadata snapshot',
      snapshotAt: '2024-06-01T08:00:00Z',
      systemTimeValidity: '[2023-01-15, infinity)',
      meta: { network: 'Campus', status: 'active' },
    },
  ],
  Sensor: [
    {
      id: 11,
      label: 'Temp Sensor T-2M',
      description: 'Sensor calibration profile',
      snapshotAt: '2024-03-11T12:00:00Z',
      systemTimeValidity: '[2023-01-15, infinity)',
      meta: { encodingType: 'application/pdf', model: 'TS-200' },
    },
  ],
  Datastream: [
    {
      id: 21,
      label: 'Temperature',
      description: 'Air temperature stream',
      snapshotAt: '2024-06-01T08:00:00Z',
      systemTimeValidity: '[2023-01-15, infinity)',
      meta: { observationType: 'double', uom: '°C' },
    },
  ],
  Location: [
    {
      id: 31,
      label: 'Campus Roof',
      description: 'Station location metadata',
      snapshotAt: '2024-03-05T16:45:00Z',
      systemTimeValidity: '[2023-01-15, infinity)',
      meta: { latitude: '46.026', longitude: '8.955' },
    },
  ],
  ObservedProperty: [
    {
      id: 41,
      label: 'Air Temperature',
      description: 'Observed property definition',
      snapshotAt: '2024-01-17T10:30:00Z',
      systemTimeValidity: '[2023-01-15, infinity)',
      meta: { definition: 'http://qudt.org/vocab/quantitykind/Temperature' },
    },
  ],
  FeatureOfInterest: [
    {
      id: 51,
      label: 'Monitoring Zone A',
      description: 'FOI polygon metadata',
      snapshotAt: '2024-02-15T09:10:00Z',
      systemTimeValidity: '[2023-01-15, infinity)',
      meta: { geometryType: 'Polygon', area: '2.3km²' },
    },
  ],
}

const COMMITS: HistoryCommit[] = [
  {
    id: 1001,
    entityType: 'Thing',
    entityId: 1,
    entityName: 'Weather Station Alpha',
    author: 'admin',
    message: 'Updated station description after firmware migration',
    date: '2024-06-01T08:00:00Z',
    actionType: 'UPDATE',
    fieldDiff: [{ field: 'description', before: 'Main campus station (original)', after: 'Main campus station (upgraded 2024)' }],
  },
  {
    id: 1002,
    entityType: 'Sensor',
    entityId: 11,
    entityName: 'Temp Sensor T-2M',
    author: 'operator1',
    message: 'Adjusted calibration coefficient',
    date: '2024-03-11T12:00:00Z',
    actionType: 'UPDATE',
    fieldDiff: [{ field: 'properties.calibration', before: '1.00', after: '1.02' }],
  },
  {
    id: 1003,
    entityType: 'Datastream',
    entityId: 21,
    entityName: 'Temperature',
    author: 'admin',
    message: 'Datastream initialized',
    date: '2023-01-15T09:00:00Z',
    actionType: 'CREATE',
    fieldDiff: [],
  },
  {
    id: 1004,
    entityType: 'Location',
    entityId: 31,
    entityName: 'Campus Roof',
    author: 'operator2',
    message: 'Corrected location coordinates precision',
    date: '2024-03-05T16:45:00Z',
    actionType: 'UPDATE',
    fieldDiff: [{ field: 'location.coordinates', before: '[8.954,46.025]', after: '[8.955,46.026]' }],
  },
  {
    id: 1005,
    entityType: 'ObservedProperty',
    entityId: 41,
    entityName: 'Air Temperature',
    author: 'admin',
    message: 'Observed property created',
    date: '2023-01-15T08:55:00Z',
    actionType: 'CREATE',
    fieldDiff: [],
  },
  {
    id: 1006,
    entityType: 'FeatureOfInterest',
    entityId: 51,
    entityName: 'Monitoring Zone A',
    author: 'operator1',
    message: 'FOI boundary update',
    date: '2024-02-15T09:10:00Z',
    actionType: 'UPDATE',
    fieldDiff: [{ field: 'description', before: 'Zone A', after: 'Monitoring Zone A' }],
  },
]

function parseEntityType(value: string | null): HistoryEntityType {
  if (value && ENTITY_TYPES.includes(value as HistoryEntityType)) {
    return value as HistoryEntityType
  }
  return 'Thing'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entityType = parseEntityType(searchParams.get('entityType'))
  const asOf = searchParams.get('$as_of')
  const fromTo = searchParams.get('$from_to')

  let snapshots = [...SNAPSHOTS[entityType]]
  let commits = COMMITS.filter((item) => item.entityType === entityType)

  if (asOf) {
    const asOfDate = new Date(asOf)
    snapshots = snapshots.filter((snapshot) => new Date(snapshot.snapshotAt) <= asOfDate)
    commits = commits.filter((commit) => new Date(commit.date) <= asOfDate)
  }

  if (fromTo) {
    const [fromRaw, toRaw] = fromTo.split(',')
    const fromDate = fromRaw ? new Date(fromRaw) : null
    const toDate = toRaw ? new Date(toRaw) : null

    commits = commits.filter((commit) => {
      const commitDate = new Date(commit.date)
      if (fromDate && commitDate < fromDate) return false
      if (toDate && commitDate > toDate) return false
      return true
    })
  }

  const response: HistoryResponse = {
    entityType,
    value: snapshots,
    commits,
  }

  return NextResponse.json(response)
}
