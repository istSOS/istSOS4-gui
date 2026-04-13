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
    <div className="page-shell">
      <div className="page-container space-y-8">
        <div className="page-header">
          <h1 className="page-title">Commits</h1>
          <p className="page-subtitle">Track changes by author and action type, then pivot into temporal entity views.</p>
        </div>

        <Card className="section-card p-5 md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              radius="sm"
              label="Action type"
              selectedKeys={actionType ? [actionType] : []}
              onChange={(event) => setActionType(event.target.value)}
              classNames={{
                label: 'text-[var(--color-text-secondary)]',
                trigger:
                  'bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)]',
                value: 'text-[var(--color-text-primary)]',
              }}
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
              classNames={{
                label: 'text-[var(--color-text-secondary)]',
                inputWrapper:
                  'bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)]',
                input: 'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
              }}
            />
          </div>
        </Card>

        {loading && <p className="text-[var(--color-text-primary)]">Loading...</p>}

        <div className="space-y-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="section-card p-5 md:p-6"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.message}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {item.author} · {dayjs(item.date).format('MMM D, YYYY HH:mm')}
                  </p>
                </div>
                <Chip color={actionColorMap[item.actionType]} size="sm" variant="flat">
                  {item.actionType}
                </Chip>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {item.affectedEntities.map((entity) => (
                  <Chip
                    key={`${item.id}-${entity}`}
                    size="sm"
                    variant="bordered"
                    className="border-[var(--color-border-strong)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"
                  >
                    {entity}
                  </Chip>
                ))}
              </div>
              {item.actionType === 'UPDATE' && (
                <button
                  className="text-sm text-[var(--color-accent)] underline"
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
    </div>
  )
}
