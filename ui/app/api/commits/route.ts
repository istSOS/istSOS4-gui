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
import { NextResponse } from 'next/server'

import { CommitItem } from '@/types/temporal'

const COMMITS: CommitItem[] = [
  {
    id: 1,
    author: 'admin',
    message: 'Initial setup of weather station',
    date: '2023-01-15T09:00:00Z',
    actionType: 'CREATE',
    affectedEntities: ['Thing', 'Location', 'Datastream'],
  },
  {
    id: 2,
    author: 'operator1',
    message: 'Calibration update for temperature sensor',
    date: '2023-06-20T14:30:00Z',
    actionType: 'UPDATE',
    affectedEntities: ['Sensor'],
  },
  {
    id: 3,
    author: 'admin',
    message: 'Added air quality monitoring node',
    date: '2024-02-10T11:00:00Z',
    actionType: 'CREATE',
    affectedEntities: ['Thing', 'Sensor', 'Datastream'],
  },
  {
    id: 4,
    author: 'operator2',
    message: 'Corrected station location metadata',
    date: '2024-03-05T16:45:00Z',
    actionType: 'UPDATE',
    affectedEntities: ['Location'],
  },
  {
    id: 5,
    author: 'admin',
    message: 'Upgraded weather station firmware description',
    date: '2024-06-01T08:00:00Z',
    actionType: 'UPDATE',
    affectedEntities: ['Thing'],
  },
  {
    id: 6,
    author: 'operator1',
    message: 'Decommissioned old humidity sensor',
    date: '2024-08-15T13:00:00Z',
    actionType: 'DELETE',
    affectedEntities: ['Sensor', 'Datastream'],
  },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const actionType = searchParams.get('actionType')
  const author = searchParams.get('author')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let items = [...COMMITS]

  if (actionType) {
    items = items.filter((item) => item.actionType === actionType)
  }

  if (author) {
    const normalized = author.toLowerCase()
    items = items.filter((item) => item.author.toLowerCase().includes(normalized))
  }

  if (from) {
    const fromDate = new Date(from)
    items = items.filter((item) => new Date(item.date) >= fromDate)
  }

  if (to) {
    const toDate = new Date(to)
    items = items.filter((item) => new Date(item.date) <= toDate)
  }

  return NextResponse.json({ value: items })
}
