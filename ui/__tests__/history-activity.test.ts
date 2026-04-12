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

import { buildActivityBuckets, COMMITS } from '@/app/api/history/data'

describe('History Activity API — buildActivityBuckets()', () => {
    it('returns buckets derived from Thing commits by default', () => {
        const buckets = buildActivityBuckets({})

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        const thingCommits = COMMITS.filter((c) => c.entityType === 'Thing')
        expect(totalCount).toBe(thingCommits.length)
    })

    it('filters by entityType=Sensor', () => {
        const buckets = buildActivityBuckets({ entityType: 'Sensor' })

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        const sensorCommits = COMMITS.filter((c) => c.entityType === 'Sensor')
        expect(totalCount).toBe(sensorCommits.length)
    })

    it('filters by entityType=Location', () => {
        const buckets = buildActivityBuckets({ entityType: 'Location' })

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        const locationCommits = COMMITS.filter((c) => c.entityType === 'Location')
        expect(totalCount).toBe(locationCommits.length)
    })

    it('applies $as_of filter — excludes future commits', () => {
        // Thing commit is at 2024-06-01, $as_of before that should yield 0
        const buckets = buildActivityBuckets({
            entityType: 'Thing',
            $as_of: '2024-01-01T00:00:00Z',
        })

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        expect(totalCount).toBe(0)
    })

    it('applies $as_of filter — includes commits at or before date', () => {
        // Thing commit is at 2024-06-01T08:00:00Z
        const buckets = buildActivityBuckets({
            entityType: 'Thing',
            $as_of: '2024-07-01T00:00:00Z',
        })

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        expect(totalCount).toBe(1)
    })

    it('applies $from_to filter — only commits in range', () => {
        const buckets = buildActivityBuckets({
            entityType: 'Sensor',
            $from_to: '2024-03-01T00:00:00Z,2024-03-31T23:59:59Z',
        })

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        expect(totalCount).toBe(1) // Only the Sensor commit in March
    })

    it('applies $from_to filter — excludes commits outside range', () => {
        const buckets = buildActivityBuckets({
            entityType: 'Sensor',
            $from_to: '2025-01-01T00:00:00Z,2025-12-31T23:59:59Z',
        })

        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        expect(totalCount).toBe(0) // No Sensor commits in 2025
    })

    it('returns zero-count fallback buckets when no commits match', () => {
        const buckets = buildActivityBuckets({
            entityType: 'Thing',
            $as_of: '2020-01-01T00:00:00Z', // Before all commits
        })

        expect(buckets.length).toBe(28)
        const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
        expect(totalCount).toBe(0)
    })

    it('returns 28 buckets for non-empty results', () => {
        const buckets = buildActivityBuckets({ entityType: 'Thing' })
        expect(buckets.length).toBe(28)
    })

    it('each bucket has a date string and numeric count', () => {
        const buckets = buildActivityBuckets({ entityType: 'Thing' })

        for (const bucket of buckets) {
            expect(typeof bucket.date).toBe('string')
            expect(bucket.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
            expect(typeof bucket.count).toBe('number')
            expect(bucket.count).toBeGreaterThanOrEqual(0)
        }
    })

    it('different entity types produce different activity data', () => {
        const thingBuckets = buildActivityBuckets({ entityType: 'Thing' })
        const sensorBuckets = buildActivityBuckets({ entityType: 'Sensor' })

        // Thing commit is on 2024-06-01, Sensor commit is on 2024-03-11
        const thingActive = thingBuckets.filter((b) => b.count > 0)
        const sensorActive = sensorBuckets.filter((b) => b.count > 0)

        expect(thingActive[0].date).not.toBe(sensorActive[0].date)
    })
})
