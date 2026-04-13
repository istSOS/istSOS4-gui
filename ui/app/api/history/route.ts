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

import { HistoryResponse } from '@/features/history/types'

import { COMMITS, SNAPSHOTS, parseEntityType } from './data'

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
