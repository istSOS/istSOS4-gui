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

import { ActivityBucket } from '@/features/history/types'

const DAYS = 28

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'week'

  const today = new Date('2024-08-20T00:00:00Z')
  const buckets: ActivityBucket[] = []

  for (let index = DAYS - 1; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - index)
    const count = period === 'week' ? (index * 3) % 5 : (index * 7) % 9

    buckets.push({
      date: date.toISOString().slice(0, 10),
      count,
    })
  }

  return NextResponse.json({ value: buckets })
}
