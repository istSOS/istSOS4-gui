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
import type { UiDataSource } from '@/types'
import { Button } from '@heroui/button'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Input } from '@heroui/input'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal'
import { Switch } from '@heroui/switch'
import { Tooltip } from '@heroui/tooltip'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import {
  DataSourcesIconPlus,
  DeleteIcon,
  EditIcon,
  MapIcon,
} from '@/components/icons'
import {
  removeDataSourceToken,
  setDataSourceToken,
} from '@/lib/dataSourceTokens'

type EditableDataSource = UiDataSource & {
  authorizationEnabled: boolean
  networkEnabled: boolean
}

type DataSourceFormState = {
  name: string
  apiRoot: string
  anonymous: boolean
}

type LoginFormState = {
  username: string
  password: string
}

type EditorState =
  | {
      mode: 'create' | 'edit'
      sourceId?: string
      previousEndpoint?: string
    }
  | null

type PendingAuthenticatedSave = {
  mode: 'create' | 'edit'
  sourceId?: string
  name: string
  endpoint: string
  previousEndpoint?: string
}

type DataSourceInspectRequest =
  | {
      mode: 'anonymous'
      apiRoot: string
    }
  | {
      mode: 'login-check'
      apiRoot: string
    }
  | {
      mode: 'authenticated'
      apiRoot: string
      username: string
      password: string
    }

type DataSourceInspectResponse =
  | {
      ok: true
      networkEnabled?: boolean
      status?: UiDataSource['status']
      error?: string | null
      accessToken?: string | null
    }
  | {
      ok: false
      errorCode: string
    }

type DataSourceInspectFailure = Extract<DataSourceInspectResponse, { ok: false }>

type DataSourceConfigSource = {
  id: string
  name: string
  apiRoot: string
  authorizationEnabled: boolean
  networkEnabled: boolean
}

type DataSourceConfigResponse =
  | {
      ok: true
      sources: DataSourceConfigSource[]
    }
  | {
      ok: false
      errorCode: string
    }

const normalizeApiRoot = (value: string) => value.trim().replace(/\/+$/, '')
const normalizeSourceName = (value: string) => value.trim().toLowerCase()
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
const inspectApiPath = `${normalizedBasePath}/api/data-sources/inspect`
const configApiPath = `${normalizedBasePath}/api/data-sources/config`

const toEditableDataSource = (source: UiDataSource): EditableDataSource => {
  const sourceWithFlags = source as UiDataSource & {
    authorizationEnabled?: boolean
    networkEnabled?: boolean
  }

  const authorizationEnabled =
    sourceWithFlags.authorizationEnabled ?? source.accessMode === 'read_write'
  const accessMode = authorizationEnabled ? 'read_write' : 'anonymous'
  const networkEnabled = sourceWithFlags.networkEnabled ?? false

  return {
    ...source,
    authorizationEnabled,
    networkEnabled,
    accessMode,
  }
}

const withDerivedAccessMode = (sources: UiDataSource[]): EditableDataSource[] => {
  return sources.map(
    (source): EditableDataSource => toEditableDataSource(source)
  )
}

const buildNextId = (sources: EditableDataSource[]) => {
  const numericIds = sources
    .map((source) => Number(source.id))
    .filter((value) => Number.isFinite(value))

  if (numericIds.length > 0) {
    return String(Math.max(...numericIds) + 1)
  }

  return `source-${sources.length + 1}`
}

async function inspectDataSource(
  payload: DataSourceInspectRequest
): Promise<DataSourceInspectResponse> {
  try {
    const response = await fetch(inspectApiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const data = await response
      .json()
      .catch((): DataSourceInspectResponse => ({
        ok: false,
        errorCode: 'validation_probe_failed',
      }))

    if (typeof data !== 'object' || data === null || !('ok' in data)) {
      return { ok: false, errorCode: 'validation_probe_failed' }
    }

    return data as DataSourceInspectResponse
  } catch {
    return { ok: false, errorCode: 'validation_probe_failed' }
  }
}

const isInspectFailure = (
  result: DataSourceInspectResponse
): result is DataSourceInspectFailure => result.ok === false

const toConfigSource = (source: EditableDataSource): DataSourceConfigSource => ({
  id: source.id,
  name: source.name,
  apiRoot: normalizeApiRoot(source.endpoint),
  authorizationEnabled: source.authorizationEnabled,
  networkEnabled: source.networkEnabled,
})

async function persistSourcesConfiguration(
  sources: EditableDataSource[]
): Promise<DataSourceConfigResponse> {
  try {
    const response = await fetch(configApiPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: sources.map((source) => toConfigSource(source)),
      }),
      cache: 'no-store',
    })

    const data = await response
      .json()
      .catch((): DataSourceConfigResponse => ({
        ok: false,
        errorCode: 'validation_config_write_failed',
      }))

    if (!response.ok) {
      return {
        ok: false,
        errorCode:
          typeof data === 'object' &&
          data !== null &&
          'errorCode' in data &&
          typeof data.errorCode === 'string'
            ? data.errorCode
            : 'validation_config_write_failed',
      }
    }

    if (
      !data ||
      typeof data !== 'object' ||
      !('ok' in data) ||
      data.ok !== true ||
      !Array.isArray(data.sources)
    ) {
      return { ok: false, errorCode: 'validation_config_write_failed' }
    }

    return data as DataSourceConfigResponse
  } catch {
    return { ok: false, errorCode: 'validation_config_write_failed' }
  }
}

export default function DataSourcesPage({
  dataSources,
}: {
  dataSources: UiDataSource[]
}) {
  const { t } = useTranslation()
  const router = useRouter()

  const [sources, setSources] = useState<EditableDataSource[]>(() =>
    withDerivedAccessMode(dataSources)
  )

  const [editor, setEditor] = useState<EditorState>(null)

  const [form, setForm] = useState<DataSourceFormState>({
    name: '',
    apiRoot: '',
    anonymous: true,
  })

  const [submitted, setSubmitted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)

  const [pendingAuthenticatedSave, setPendingAuthenticatedSave] =
    useState<PendingAuthenticatedSave | null>(null)

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    username: '',
    password: '',
  })
  const [loginSubmitted, setLoginSubmitted] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoginSaving, setIsLoginSaving] = useState(false)

  useEffect(() => {
    setSources(withDerivedAccessMode(dataSources))
  }, [dataSources])

  const closeEditor = () => {
    setEditor(null)
    setSubmitted(false)
    setFormError(null)
    setIsSaving(false)
  }

  const resetLoginForm = () => {
    setLoginForm({ username: '', password: '' })
    setLoginSubmitted(false)
    setLoginError(null)
    setIsLoginSaving(false)
  }

  const closeLoginForm = () => {
    setPendingAuthenticatedSave(null)
    resetLoginForm()
  }

  const openCreate = () => {
    setPageError(null)
    setForm({
      name: '',
      apiRoot: '',
      anonymous: true,
    })
    setSubmitted(false)
    setFormError(null)
    setEditor({ mode: 'create' })
  }

  const openEdit = (source: EditableDataSource) => {
    setPageError(null)
    setForm({
      name: source.name,
      apiRoot: source.endpoint,
      anonymous: !source.authorizationEnabled,
    })
    setSubmitted(false)
    setFormError(null)
    setEditor({
      mode: 'edit',
      sourceId: source.id,
      previousEndpoint: source.endpoint,
    })
  }

  const handleDelete = async (source: EditableDataSource) => {
    const confirmed = window.confirm(
      t('data_sources.delete_confirm', { name: source.name })
    )

    if (!confirmed) return

    const nextSources = sources.filter((it) => it.id !== source.id)
    const result = await persistSourcesConfiguration(nextSources)

    if (result.ok === false) {
      setPageError(t('data_sources.config_save_failed'))
      return
    }

    removeDataSourceToken(source.endpoint)
    setPageError(null)
    setSources(nextSources)
    router.refresh()
  }

  const persistSource = async (
    payload: PendingAuthenticatedSave,
    authorizationEnabled: boolean,
    networkEnabled: boolean,
    status: UiDataSource['status'],
    error: string | null
  ) => {
    let nextSources: EditableDataSource[] = []

    if (payload.mode === 'create') {
      nextSources = withDerivedAccessMode([
        ...sources,
        {
          id: buildNextId(sources),
          name: payload.name,
          endpoint: payload.endpoint,
          authorizationEnabled,
          networkEnabled,
          status,
          accessMode: authorizationEnabled ? 'read_write' : 'anonymous',
          error,
        },
      ])
    } else {
      if (!payload.sourceId) return

      nextSources = withDerivedAccessMode(
        sources.map((source) => {
          if (source.id !== payload.sourceId) return source

          return {
            ...source,
            name: payload.name,
            endpoint: payload.endpoint,
            authorizationEnabled,
            networkEnabled,
            status,
            accessMode: authorizationEnabled ? 'read_write' : 'anonymous',
            error,
          }
        })
      )
    }

    const result = await persistSourcesConfiguration(nextSources)
    if (result.ok === false) {
      throw new Error(result.errorCode)
    }

    setPageError(null)
    setSources(nextSources)
    router.refresh()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor || isSaving) return

    setSubmitted(true)
    setFormError(null)
    setPageError(null)

    const name = form.name.trim()
    const endpoint = normalizeApiRoot(form.apiRoot)

    if (!name || !endpoint) {
      setFormError(t('data_sources.validation_required'))
      return
    }

    const duplicateName = sources.some(
      (source) =>
        source.id !== editor.sourceId &&
        normalizeSourceName(source.name) === normalizeSourceName(name)
    )
    if (duplicateName) {
      setFormError(t('data_sources.validation_duplicate_name'))
      return
    }

    const duplicateEndpoint = sources.some(
      (source) =>
        source.id !== editor.sourceId &&
        normalizeApiRoot(source.endpoint) === endpoint
    )
    if (duplicateEndpoint) {
      setFormError(t('data_sources.validation_duplicate_api_root'))
      return
    }

    const payload: PendingAuthenticatedSave = {
      mode: editor.mode,
      sourceId: editor.sourceId,
      name,
      endpoint,
      previousEndpoint: editor.previousEndpoint,
    }

    setIsSaving(true)

    try {
      if (form.anonymous) {
        const inspection = await inspectDataSource({
          mode: 'anonymous',
          apiRoot: endpoint,
        })

        if (isInspectFailure(inspection)) {
          throw new Error(inspection.errorCode)
        }

        await persistSource(
          payload,
          false,
          !!inspection.networkEnabled,
          inspection.status ?? 'offline',
          inspection.error ?? null
        )

        if (payload.previousEndpoint && payload.previousEndpoint !== endpoint) {
          removeDataSourceToken(payload.previousEndpoint)
        }
        removeDataSourceToken(endpoint)

        closeEditor()
        return
      }

      const loginCheck = await inspectDataSource({
        mode: 'login-check',
        apiRoot: endpoint,
      })

      if (isInspectFailure(loginCheck)) {
        throw new Error(loginCheck.errorCode)
      }

      setPendingAuthenticatedSave(payload)
      resetLoginForm()
      closeEditor()
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'validation_login_check_failed') {
          setFormError(t('data_sources.validation_login_check_failed'))
        } else if (error.message === 'validation_login_missing') {
          setFormError(t('data_sources.validation_login_missing'))
        } else if (error.message === 'validation_duplicate_id') {
          setFormError(t('data_sources.validation_duplicate_id'))
        } else if (error.message === 'validation_duplicate_name') {
          setFormError(t('data_sources.validation_duplicate_name'))
        } else if (error.message === 'validation_duplicate_api_root') {
          setFormError(t('data_sources.validation_duplicate_api_root'))
        } else if (error.message === 'validation_config_payload_invalid') {
          setFormError(t('data_sources.config_save_failed'))
        } else if (error.message === 'validation_config_write_failed') {
          setFormError(t('data_sources.config_save_failed'))
        } else if (error.message === 'validation_probe_failed') {
          setFormError(t('data_sources.validation_probe_failed'))
        } else {
          setFormError(t('data_sources.validation_probe_failed'))
        }
      } else {
        setFormError(t('data_sources.error'))
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDatasourceLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!pendingAuthenticatedSave || isLoginSaving) return

    setLoginSubmitted(true)
    setLoginError(null)
    setPageError(null)

    const username = loginForm.username.trim()
    const password = loginForm.password.trim()

    if (!username || !password) {
      setLoginError(t('data_sources.validation_credentials_required'))
      return
    }

    setIsLoginSaving(true)

    try {
      const inspection = await inspectDataSource({
        mode: 'authenticated',
        apiRoot: pendingAuthenticatedSave.endpoint,
        username,
        password,
      })

      if (isInspectFailure(inspection)) {
        throw new Error(inspection.errorCode)
      }

      if (pendingAuthenticatedSave.previousEndpoint) {
        const previousEndpoint = pendingAuthenticatedSave.previousEndpoint
        if (previousEndpoint !== pendingAuthenticatedSave.endpoint) {
          removeDataSourceToken(previousEndpoint)
        }
      }

      if (inspection.accessToken) {
        setDataSourceToken(pendingAuthenticatedSave.endpoint, inspection.accessToken)
      }

      await persistSource(
        pendingAuthenticatedSave,
        true,
        !!inspection.networkEnabled,
        inspection.status ?? 'offline',
        inspection.error ?? null
      )
      closeLoginForm()
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'validation_login_missing') {
          setLoginError(t('data_sources.validation_login_missing'))
        } else if (error.message === 'validation_credentials_required') {
          setLoginError(t('data_sources.validation_credentials_required'))
        } else if (error.message === 'validation_login_failed') {
          setLoginError(t('data_sources.validation_login_failed'))
        } else if (error.message === 'validation_login_check_failed') {
          setLoginError(t('data_sources.validation_login_check_failed'))
        } else if (error.message === 'validation_duplicate_id') {
          setLoginError(t('data_sources.validation_duplicate_id'))
        } else if (error.message === 'validation_duplicate_name') {
          setLoginError(t('data_sources.validation_duplicate_name'))
        } else if (error.message === 'validation_duplicate_api_root') {
          setLoginError(t('data_sources.validation_duplicate_api_root'))
        } else if (error.message === 'validation_config_payload_invalid') {
          setLoginError(t('data_sources.config_save_failed'))
        } else if (error.message === 'validation_config_write_failed') {
          setLoginError(t('data_sources.config_save_failed'))
        } else {
          setLoginError(t('data_sources.validation_probe_failed'))
        }
      } else {
        setLoginError(t('data_sources.validation_probe_failed'))
      }
    } finally {
      setIsLoginSaving(false)
    }
  }

  const formTitle =
    editor?.mode === 'create'
      ? t('data_sources.form_create_title')
      : t('data_sources.form_edit_title')

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[var(--color-primary)] text-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('data_sources.title')}</h1>
            <p className="text-sm ">{t('data_sources.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onPress={openCreate}
              radius="sm"
              size="sm"
              color="primary"
              variant="faded"
              startContent={<DataSourcesIconPlus size={18} />}
            >
              {t('data_sources.new')}
            </Button>
            <Button
              onPress={() => router.push('/')}
              radius="sm"
              size="sm"
              color="primary"
              variant="faded"
              startContent={<MapIcon size={18} />}
            >
              {t('data_sources.back_to_map')}
            </Button>
          </div>
        </div>

        {pageError ? <p className="mb-4 text-sm text-danger">{pageError}</p> : null}

        {sources.length === 0 ? (
          <Card className="bg-white">
            <CardBody>
              <p className="text-sm text-slate-600">{t('data_sources.empty')}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => (
              <Card key={source.id} className="bg-white">
                <CardHeader className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <p className="text-lg font-semibold text-slate-900">{source.name}</p>
                    <p className="text-xs text-slate-500">{source.endpoint}</p>
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Tooltip color="primary" offset={-5} content={t('general.edit')}>
                      <Button
                        isIconOnly
                        className="h-6 w-6 min-w-6"
                        size="sm"
                        variant="light"
                        color="primary"
                        onPress={() => openEdit(source)}
                      >
                        <EditIcon size={18} />
                      </Button>
                    </Tooltip>
                    <Tooltip color="danger" offset={-5} content={t('general.delete')}>
                      <Button
                        isIconOnly
                        className="h-6 w-6 min-w-6"
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => handleDelete(source)}
                      >
                        <DeleteIcon size={18} />
                      </Button>
                    </Tooltip>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="mb-2 flex flex-row items-center gap-2">
                    <Chip
                      color={source.authorizationEnabled ? 'primary' : 'default'}
                      variant="flat"
                    >
                      {source.authorizationEnabled
                        ? t('data_sources.access_read_write')
                        : t('data_sources.access_anonymous')}
                    </Chip>
                    <Chip
                      color={source.status === 'online' ? 'success' : 'danger'}
                      variant="flat"
                      className="capitalize"
                    >
                      {source.status === 'online'
                        ? t('data_sources.status_online')
                        : t('data_sources.status_offline')}
                    </Chip>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                    {source.error ? (
                      <>
                        <span className="font-medium text-slate-600">{t('data_sources.error')}</span>
                        <span className="break-words text-slate-900">{source.error}</span>
                      </>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!editor}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeEditor()
        }}
        backdrop="blur"
        placement="center"
      >
        <ModalContent>
          <form onSubmit={handleSubmit}>
            <ModalHeader>{formTitle}</ModalHeader>
            <ModalBody className="flex flex-col gap-4">
              <Input
                isRequired
                label={t('data_sources.name')}
                placeholder={t('data_sources.name_placeholder')}
                value={form.name}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, name: value }))
                }
                isInvalid={submitted && !form.name.trim()}
                errorMessage={
                  submitted && !form.name.trim() ? t('data_sources.validation_required') : ''
                }
              />

              <Input
                isRequired
                label={t('data_sources.api_root')}
                placeholder={t('data_sources.api_root_placeholder')}
                value={form.apiRoot}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, apiRoot: value }))
                }
                isInvalid={submitted && !form.apiRoot.trim()}
                errorMessage={
                  submitted && !form.apiRoot.trim()
                    ? t('data_sources.validation_required')
                    : ''
                }
              />

              <Switch
                isSelected={form.anonymous}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    anonymous: value,
                  }))
                }
              >
                {t('data_sources.anonymous')}
              </Switch>

              {formError ? <p className="text-danger text-sm">{formError}</p> : null}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={closeEditor}>
                {t('general.cancel')}
              </Button>
              <Button type="submit" color="primary" isLoading={isSaving}>
                {editor?.mode === 'create' ? t('general.create') : t('general.save')}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!pendingAuthenticatedSave}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeLoginForm()
        }}
        backdrop="blur"
        placement="center"
      >
        <ModalContent>
          <form onSubmit={handleDatasourceLogin}>
            <ModalHeader>{t('data_sources.login_form_title')}</ModalHeader>
            <ModalBody className="flex flex-col gap-4">
              <p className="text-sm text-slate-500">
                {t('data_sources.login_form_subtitle')}
              </p>

              <Input
                isRequired
                label={t('data_sources.username')}
                placeholder={t('data_sources.username_placeholder')}
                value={loginForm.username}
                onValueChange={(value) =>
                  setLoginForm((prev) => ({ ...prev, username: value }))
                }
                isInvalid={loginSubmitted && !loginForm.username.trim()}
              />

              <Input
                isRequired
                type="password"
                label={t('data_sources.password')}
                placeholder={t('data_sources.password_placeholder')}
                value={loginForm.password}
                onValueChange={(value) =>
                  setLoginForm((prev) => ({ ...prev, password: value }))
                }
                isInvalid={loginSubmitted && !loginForm.password.trim()}
              />

              {loginError ? <p className="text-danger text-sm">{loginError}</p> : null}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={closeLoginForm}>
                {t('general.cancel')}
              </Button>
              <Button type="submit" color="primary" isLoading={isLoginSaving}>
                {t('login.login')}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </main>
  )
}
