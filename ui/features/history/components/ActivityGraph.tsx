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

import { ActivityBucket } from '@/features/history/types'

function getIntensity(count: number) {
  if (count <= 0) return 'bg-[#1f2937]'
  if (count === 1) return 'bg-[#14532d]'
  if (count <= 3) return 'bg-[#15803d]'
  return 'bg-[#22c55e]'
}

export default function ActivityGraph({ buckets }: { buckets: ActivityBucket[] }) {
  return (
    <Card className="section-card p-5 md:p-6">
      <p className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">Activity (weekly view)</p>
      <div className="grid grid-cols-7 gap-2">
        {buckets.map((bucket) => (
          <div
            key={bucket.date}
            className={`h-7 rounded ${getIntensity(bucket.count)}`}
            title={`${bucket.date}: ${bucket.count} commit${bucket.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
    </Card>
  )
}
