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
import { Input } from '@heroui/input'
import { Tab, Tabs } from '@heroui/tabs'
import React from 'react'

import { useTemporal } from '@/context/TemporalContext'

function toLocalInputValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

function fromLocalInputValue(value: string) {
  if (!value) return null
  return new Date(value).toISOString()
}

export default function TemporalModeSwitch() {
  const { mode, asOf, fromTo, setMode, setAsOf, setFromTo } = useTemporal()

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <Tabs
        selectedKey={mode}
        onSelectionChange={(key) => setMode(String(key) as 'current' | 'as_of' | 'from_to')}
        aria-label="Temporal mode switch"
        variant="solid"
        color="primary"
        classNames={{
          tabList: 'bg-[var(--color-surface-elevated)] border border-[var(--color-border)]',
          tab: 'text-[var(--color-text-secondary)] data-[selected=true]:text-white',
          cursor: 'bg-[var(--color-accent)]',
        }}
      >
        <Tab key="current" title="Current" />
        <Tab key="as_of" title="As-of" />
        <Tab key="from_to" title="From-to" />
      </Tabs>

      {mode === 'as_of' && (
        <div className="mt-3">
          <Input
            type="datetime-local"
            label="As-of timestamp"
            value={toLocalInputValue(asOf)}
            onChange={(event) => setAsOf(fromLocalInputValue(event.target.value))}
            size="sm"
            radius="sm"
            classNames={{
              label: 'text-[var(--color-text-secondary)]',
              inputWrapper:
                'bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)]',
              input: 'text-[var(--color-text-primary)]',
            }}
          />
        </div>
      )}

      {mode === 'from_to' && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            type="datetime-local"
            label="From"
            value={toLocalInputValue(fromTo?.[0] ?? null)}
            onChange={(event) =>
              setFromTo([
                fromLocalInputValue(event.target.value) || new Date().toISOString(),
                fromTo?.[1] || new Date().toISOString(),
              ])
            }
            size="sm"
            radius="sm"
            classNames={{
              label: 'text-[var(--color-text-secondary)]',
              inputWrapper:
                'bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)]',
              input: 'text-[var(--color-text-primary)]',
            }}
          />
          <Input
            type="datetime-local"
            label="To"
            value={toLocalInputValue(fromTo?.[1] ?? null)}
            onChange={(event) =>
              setFromTo([
                fromTo?.[0] || new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                fromLocalInputValue(event.target.value) || new Date().toISOString(),
              ])
            }
            size="sm"
            radius="sm"
            classNames={{
              label: 'text-[var(--color-text-secondary)]',
              inputWrapper:
                'bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)]',
              input: 'text-[var(--color-text-primary)]',
            }}
          />
        </div>
      )}
    </div>
  )
}
