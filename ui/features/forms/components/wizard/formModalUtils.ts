import { siteConfig } from '@/config/site'

export const normalizeEndpoint = (value: string) =>
  value.trim().replace(/\/+$/, '')

const runtimeBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim()
const basePath = runtimeBasePath && runtimeBasePath.length ? runtimeBasePath : '/NEXT_APP_URL'
const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')

export const inspectApiPath = `${normalizedBasePath}/api/data-sources/inspect`

export type DataSourceInspectResponse =
  | {
      ok: true
      accessToken?: string | null
    }
  | {
      ok: false
      errorCode: string
    }

export const parseCreatedEntityId = (
  value: { '@iot.id'?: string | number; id?: string | number } | null
): string => {
  const raw = value?.['@iot.id'] ?? value?.id
  if (raw === undefined || raw === null) return ''
  return String(raw).trim()
}

export const toEntityReferenceId = (id: string) => {
  const trimmed = id.trim()
  if (!trimmed) return trimmed
  const numericId = Number(trimmed)
  return Number.isFinite(numericId) ? numericId : trimmed
}

export const resolveEntityEndpoint = (entity: { __sourceEndpoint?: string } | null) =>
  normalizeEndpoint(String(entity?.__sourceEndpoint ?? siteConfig.api_root))
