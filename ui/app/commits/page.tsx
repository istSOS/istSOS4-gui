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
import { Chip } from '@heroui/chip'
import { Input } from '@heroui/input'
import { Select, SelectItem } from '@heroui/select'
import dayjs from 'dayjs'
import * as React from 'react'

import { useRouter } from 'next/navigation'

import { SecNavbar } from '@/components/bars/secNavbar'

import { useTemporal } from '@/context/TemporalContext'

import { CommitItem } from '@/types/temporal'

const actionColorMap = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
} as const

export default function CommitsPage() {
  const router = useRouter()
  const { setAsOf } = useTemporal()
  const [items, setItems] = React.useState<CommitItem[]>([])
  const [actionType, setActionType] = React.useState<string>('')
  const [author, setAuthor] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const params = new URLSearchParams()
    if (actionType) params.set('actionType', actionType)
    if (author) params.set('author', author)

    const url = params.toString()
      ? `/api/commits?${params.toString()}`
      : '/api/commits'

    setLoading(true)
    fetch(url)
      .then((response) => response.json())
      .then((payload) => setItems(payload?.value || []))
      .finally(() => setLoading(false))
  }, [actionType, author])

  return (
    <div className="min-h-screen p-4">
      <div className="mb-4">
        <SecNavbar title="Commits" />
      </div>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          radius="sm"
          label="Action type"
          selectedKeys={actionType ? [actionType] : []}
          onChange={(event) => setActionType(event.target.value)}
        >
          <SelectItem key="">All</SelectItem>
          <SelectItem key="CREATE">CREATE</SelectItem>
          <SelectItem key="UPDATE">UPDATE</SelectItem>
          <SelectItem key="DELETE">DELETE</SelectItem>
        </Select>
        <Input
          radius="sm"
          label="Author"
          placeholder="Filter by author"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
      </div>

      {loading && <p className="text-white">Loading...</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4 bg-white/10 border border-white/15">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-white">{item.message}</p>
                <p className="text-sm text-white/70">
                  {item.author} · {dayjs(item.date).format('MMM D, YYYY HH:mm')}
                </p>
              </div>
              <Chip color={actionColorMap[item.actionType]} size="sm" variant="flat">
                {item.actionType}
              </Chip>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {item.affectedEntities.map((entity) => (
                <Chip key={`${item.id}-${entity}`} size="sm" variant="bordered">
                  {entity}
                </Chip>
              ))}
            </div>
            {item.actionType === 'UPDATE' && (
              <button
                className="text-sm underline text-primary-300"
                onClick={() => {
                  setAsOf(item.date)
                  router.push('/things')
                }}
              >
                View Things at this time
              </button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
