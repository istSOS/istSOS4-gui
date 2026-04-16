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

import { readDataSourcesConfigFile, writeDataSourcesConfigFile } from '@/server/data-sources/config'
import type { ConfiguredDataSource } from '@/types'

type RequestPayload = {
  sources?: unknown
}

const normalizeApiRoot = (value: string) => value.trim().replace(/\/+$/, '')
const normalizeSourceName = (value: string) => value.trim().toLowerCase()

const isConfiguredDataSource = (value: unknown): value is ConfiguredDataSource => {
  if (!value || typeof value !== 'object') return false

  const source = value as Partial<ConfiguredDataSource>
  return (
    typeof source.id === 'string' &&
    typeof source.name === 'string' &&
    typeof source.apiRoot === 'string' &&
    typeof source.authorizationEnabled === 'boolean' &&
    typeof source.networkEnabled === 'boolean'
  )
}

export async function GET() {
  try {
    const sources = await readDataSourcesConfigFile()
    return NextResponse.json({ ok: true, sources }, { status: 200 })
  } catch {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_config_read_failed' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const payload = (await request.json().catch(() => null)) as RequestPayload | null

  if (!payload || !Array.isArray(payload.sources)) {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_config_payload_invalid' },
      { status: 400 }
    )
  }

  if (!payload.sources.every((source) => isConfiguredDataSource(source))) {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_config_payload_invalid' },
      { status: 400 }
    )
  }

  const uniqueIds = new Set(payload.sources.map((source) => source.id))
  if (uniqueIds.size !== payload.sources.length) {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_duplicate_id' },
      { status: 400 }
    )
  }

  const uniqueNames = new Set(
    payload.sources.map((source) => normalizeSourceName(source.name))
  )
  if (uniqueNames.size !== payload.sources.length) {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_duplicate_name' },
      { status: 400 }
    )
  }

  const uniqueApiRoots = new Set(
    payload.sources.map((source) => normalizeApiRoot(source.apiRoot))
  )
  if (uniqueApiRoots.size !== payload.sources.length) {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_duplicate_api_root' },
      { status: 400 }
    )
  }

  try {
    const sources = await writeDataSourcesConfigFile(payload.sources)
    return NextResponse.json({ ok: true, sources }, { status: 200 })
  } catch {
    return NextResponse.json(
      { ok: false, errorCode: 'validation_config_write_failed' },
      { status: 500 }
    )
  }
}
