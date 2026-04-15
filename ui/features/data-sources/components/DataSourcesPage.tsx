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
import { Tooltip } from '@heroui/tooltip'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import {
  DataSourcesIconPlus,
  DeleteIcon,
  EditIcon,
  MapIcon,
} from '@/components/icons'

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}

export default function DataSourcesPage({
  dataSources,
}: {
  dataSources: UiDataSource[]
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const handleCreate = () => console.log('Create data source')

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
              onPress={handleCreate}
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

        {dataSources.length === 0 ? (
          <Card className="bg-white">
            <CardBody>
              <p className="text-sm text-slate-600">
                {t('data_sources.empty')}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dataSources.map((source) => {
              const handleEdit = () => console.log('Edit data source:', source)
              const handleDelete = () =>
                console.log('Delete data source:', source)

              return (
                <Card key={source.id} className="bg-white">
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <p className="text-lg font-semibold text-slate-900">
                        {source.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {source.endpoint}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Tooltip
                        color="primary"
                        offset={-5}
                        content={t('general.edit')}
                      >
                        <Button
                          isIconOnly
                          className="h-6 w-6 min-w-6"
                          size="sm"
                          variant="light"
                          color="primary"
                          onPress={handleEdit}
                        >
                          <EditIcon size={18} />
                        </Button>
                      </Tooltip>
                      <Tooltip
                        color="danger"
                        offset={-5}
                        content={t('general.delete')}
                      >
                        <Button
                          isIconOnly
                          className="h-6 w-6 min-w-6"
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={handleDelete}
                        >
                          <DeleteIcon size={18} />
                        </Button>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0">
                    <div className="mb-2 flex flex-row items-center gap-2">
                      <Chip
                        color={
                          source.accessMode === 'read_write'
                            ? 'primary'
                            : 'default'
                        }
                        variant="flat"
                      >
                        {source.accessMode === 'read_write'
                          ? t('data_sources.access_read_write')
                          : t('data_sources.access_anonymous')}
                      </Chip>
                      <Chip
                        color={
                          source.status === 'online' ? 'success' : 'danger'
                        }
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
                          <span className="font-medium text-slate-600">
                            {t('data_sources.error')}
                          </span>
                          <span className="break-words text-slate-900">
                            {source.error}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
