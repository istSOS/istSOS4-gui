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
import { Tab, Tabs } from '@heroui/tabs'
import * as React from 'react'

import ActivityGraph from '@/features/history/components/ActivityGraph'
import HistoryDetails from '@/features/history/components/HistoryDetails'
import {
	ActivityBucket,
	HistoryEntityType,
	HistoryResponse,
} from '@/features/history/types'

import TemporalModeSwitch from '@/components/TemporalModeSwitch'

import { useTemporal } from '@/context/TemporalContext'

import { appendTemporalParams } from '@/server/temporal'

const ENTITY_TYPES: HistoryEntityType[] = [
	'Thing',
	'Sensor',
	'Datastream',
	'Location',
	'ObservedProperty',
	'FeatureOfInterest',
]

export default function HistoryPage() {
	const { mode, asOf, fromTo } = useTemporal()
	const [entityType, setEntityType] = React.useState<HistoryEntityType>('Thing')
	const [loading, setLoading] = React.useState(true)
	const [data, setData] = React.useState<HistoryResponse | null>(null)
	const [activity, setActivity] = React.useState<ActivityBucket[]>([])

	const historyUrl = React.useMemo(() => {
		const baseUrl = `/api/history?entityType=${entityType}`
		return appendTemporalParams(baseUrl, { mode, asOf, fromTo })
	}, [entityType, mode, asOf, fromTo])

	const activityUrl = React.useMemo(() => {
		const baseUrl = `/api/history/activity?entityType=${entityType}&period=week`
		return appendTemporalParams(baseUrl, { mode, asOf, fromTo })
	}, [entityType, mode, asOf, fromTo])

	React.useEffect(() => {
		setLoading(true)

		Promise.all([
			fetch(historyUrl).then((response) => response.json()),
			fetch(activityUrl).then((response) => response.json()),
		])
			.then(([historyPayload, activityPayload]) => {
				setData(historyPayload)
				setActivity(activityPayload?.value || [])
			})
			.finally(() => setLoading(false))
	}, [historyUrl, activityUrl])

	return (
		<div className="page-shell">
			<div className="page-container space-y-8">
				<div className="page-header">
					<h1 className="page-title">History Explorer</h1>
					<p className="page-subtitle">
						Explore temporal snapshots and commit evolution with a clear, time-aware view.
					</p>
				</div>

				<Card className="section-card p-5 md:p-6">
					<div className="space-y-5">
						<TemporalModeSwitch />

						<div className="space-y-3">
							<Tabs
								selectedKey={entityType}
								onSelectionChange={(key) =>
									setEntityType(String(key) as HistoryEntityType)
								}
								variant="solid"
								color="primary"
								classNames={{
									tabList: 'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
									tab: 'text-[var(--color-text-secondary)] data-[selected=true]:text-white',
									cursor: 'bg-[var(--color-accent)]',
								}}
							>
								{ENTITY_TYPES.map((type) => (
									<Tab key={type} title={type} />
								))}
							</Tabs>

							<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3">
								<p className="mb-1 text-xs text-[var(--color-text-secondary)]">History query</p>
								<p className="break-all font-mono text-xs text-[var(--color-text-primary)]">
									GET {historyUrl}
								</p>
							</div>
						</div>
					</div>
				</Card>

				<ActivityGraph buckets={activity} />
				<HistoryDetails data={data} loading={loading} />
			</div>
		</div>
	)
}
