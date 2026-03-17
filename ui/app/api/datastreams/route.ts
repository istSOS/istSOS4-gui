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

const CURRENT_DATASTREAMS = [
  {
    '@iot.id': 1,
    name: 'Temperature',
    description: 'Air temp at 2m (updated metadata)',
    observationType: 'double',
    phenomenonTime: '2023-01-01T00:00:00Z/2024-12-31T23:59:59Z',
  },
  {
    '@iot.id': 2,
    name: 'Humidity',
    description: 'Relative humidity',
    observationType: 'double',
    phenomenonTime: '2023-06-01T00:00:00Z/2024-12-31T23:59:59Z',
  },
]

const HISTORICAL_DATASTREAMS = [
  {
    '@iot.id': 1,
    name: 'Temperature',
    description: 'Air temp at 2m',
    observationType: 'double',
    phenomenonTime: '2023-01-01T00:00:00Z/2024-12-31T23:59:59Z',
    systemTimeValidity: '[2023-01-01, 2024-06-01)',
  },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const asOf = searchParams.get('$as_of')
  const fromTo = searchParams.get('$from_to')

  if (asOf) {
    const asOfDate = new Date(asOf)
    if (asOfDate < new Date('2023-01-01T00:00:00Z')) {
      return NextResponse.json({ value: [] })
    }
    if (asOfDate < new Date('2024-06-01T00:00:00Z')) {
      return NextResponse.json({ value: HISTORICAL_DATASTREAMS })
    }
    return NextResponse.json({ value: CURRENT_DATASTREAMS })
  }

  if (fromTo) {
    const [from] = fromTo.split(',')
    if (from && new Date(from) < new Date('2023-01-01T00:00:00Z')) {
      return NextResponse.json({ value: [] })
    }
    return NextResponse.json({ value: HISTORICAL_DATASTREAMS })
  }

  return NextResponse.json({ value: CURRENT_DATASTREAMS })
}
