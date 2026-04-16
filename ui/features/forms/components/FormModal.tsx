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
import {
  type CreateDatastreamPayload,
  createDatastream,
} from '@/services/datastreams'
import {
  type CreateLocationPayload,
  createLocation,
} from '@/services/locations'
import {
  type CreateObservedPropertyPayload,
  createObservedProperty,
} from '@/services/observedProperties'
import { type CreateSensorPayload, createSensor } from '@/services/sensors'
import { type CreateThingPayload, createThing } from '@/services/things'
import { Autocomplete, AutocompleteItem } from '@heroui/autocomplete'
import { Button } from '@heroui/button'
import { Form as HeroForm } from '@heroui/form'
import { Input, Textarea } from '@heroui/input'
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/modal'
import { Tab, Tabs } from '@heroui/tabs'
import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useRouter } from 'next/navigation'

import {
  CommitIcon,
  DatastreamIcon,
  LocationIcon,
  ObservedPropertyIcon,
  ReviewIcon,
  SensorIcon,
  ThingIcon,
} from '@/components/icons'

import { useAuth } from '@/context/AuthContext'
import { siteConfig } from '@/config/site'
import { getDataSourceToken, setDataSourceToken } from '@/lib/dataSourceTokens'

import { EntityFields, ExistingEntitySelect } from './wizard/fields'
import { ModeCard, SectionTitle, StepCard } from './wizard/primitives'
import {
  type AssociatedDraft,
  ENTITY_ORDER,
  type EntityDraft,
  type EntityKey,
  type FormDataMap,
  type FormTabKey,
  type WizardMode,
  createInitialAssociatedDraft,
  createInitialSingleDraft,
} from './wizard/types'
import {
  type ExistingEntities,
  type ExistingOptionsMap,
  buildExistingOptions,
  normalizeEntityPayload,
} from './wizard/utils'

interface FormProps {
  operation: 'create' | 'edit'
  latitude?: number
  longitude?: number
  initialTab?: FormTabKey
  isOpen: boolean
  onClose: () => void
  existingEntities?: ExistingEntities
  writableDataSources?: Array<{
    id: string
    name: string
    endpoint: string
  }>
}

const normalizeEndpoint = (value: string) => value.trim().replace(/\/+$/, '')
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? ''
const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
const inspectApiPath = `${normalizedBasePath}/api/data-sources/inspect`

type DataSourceInspectResponse =
  | {
      ok: true
      accessToken?: string | null
    }
  | {
      ok: false
      errorCode: string
    }

function StepIcon({
  icon: Icon,
  size = 16,
}: {
  icon: ComponentType<any>
  size?: number
}) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <Icon size={size} />
    </span>
  )
}

export default function FormModal({
  operation,
  latitude,
  longitude,
  initialTab = 'thing',
  isOpen,
  onClose,
  existingEntities = {
    things: [],
    locations: [],
    sensors: [],
    observedProperties: [],
    datastreams: [],
    networks: [],
  },
  writableDataSources = [],
}: FormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const { token } = useAuth()
  const primaryEndpoint = useMemo(
    () => normalizeEndpoint(siteConfig.api_root),
    []
  )

  const entityLabels = useMemo<Record<EntityKey, string>>(
    () => ({
      thing: 'Thing',
      location: 'Location',
      sensor: 'Sensor',
      observedProperty: 'Observed Property',
      datastream: 'Datastream',
    }),
    []
  )

  const entityIcons = useMemo<Record<EntityKey, ReactNode>>(
    () => ({
      thing: <StepIcon icon={ThingIcon} />,
      location: <StepIcon icon={LocationIcon} />,
      sensor: <StepIcon icon={SensorIcon} />,
      observedProperty: <StepIcon icon={ObservedPropertyIcon} />,
      datastream: <StepIcon icon={DatastreamIcon} />,
    }),
    []
  )

  const existingEntityTabLabels = useMemo<Record<EntityKey, string>>(
    () => ({
      thing: t('wizard.use_existing_entity_thing'),
      location: t('wizard.use_existing_entity_location'),
      sensor: t('wizard.use_existing_entity_sensor'),
      observedProperty: t('wizard.use_existing_entity_observed_property'),
      datastream: t('wizard.use_existing_entity_datastream'),
    }),
    [t]
  )

  const newEntityTabLabels = useMemo<Record<EntityKey, string>>(
    () => ({
      thing: t('wizard.create_new_entity_thing'),
      location: t('wizard.create_new_entity_location'),
      sensor: t('wizard.create_new_entity_sensor'),
      observedProperty: t('wizard.create_new_entity_observed_property'),
      datastream: t('wizard.create_new_entity_datastream'),
    }),
    [t]
  )

  const fullAccessDataSources = useMemo(
    () =>
      writableDataSources.map((source) => ({
        ...source,
        endpoint: normalizeEndpoint(source.endpoint),
      })),
    [writableDataSources]
  )
  const defaultSingleDataSourceEndpoint =
    fullAccessDataSources[0]?.endpoint ?? normalizeEndpoint(siteConfig.api_root)

  const [wizardMode, setWizardMode] = useState<WizardMode>('associated')
  const [singleEntity, setSingleEntity] = useState<EntityKey>(initialTab)
  const [singleDataSourceEndpoint, setSingleDataSourceEndpoint] = useState(
    defaultSingleDataSourceEndpoint
  )
  const [singleDraft, setSingleDraft] = useState<FormDataMap>(
    createInitialSingleDraft(latitude, longitude)
  )
  const [associatedDraft, setAssociatedDraft] = useState<AssociatedDraft>(
    createInitialAssociatedDraft(latitude, longitude)
  )
  const [associatedStepIndex, setAssociatedStepIndex] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [pendingDataSourceLogin, setPendingDataSourceLogin] = useState<{
    endpoint: string
    name: string
    resumeSubmit: boolean
  } | null>(null)
  const [dataSourceLoginForm, setDataSourceLoginForm] = useState({
    username: '',
    password: '',
  })
  const [dataSourceLoginSubmitted, setDataSourceLoginSubmitted] =
    useState(false)
  const [dataSourceLoginError, setDataSourceLoginError] = useState<
    string | null
  >(null)
  const [isDataSourceLoginSaving, setIsDataSourceLoginSaving] =
    useState(false)

  const requiresCommitMessage =
    wizardMode === 'single' &&
    (singleEntity === 'thing' ||
      singleEntity === 'location' ||
      singleEntity === 'sensor' ||
      singleEntity === 'observedProperty' ||
      singleEntity === 'datastream')

  const isReviewStep = associatedStepIndex === ENTITY_ORDER.length
  const associatedTotalSteps = ENTITY_ORDER.length + 1
  const associatedCurrentStep = associatedStepIndex + 1
  const associatedProgress = Math.round(
    (associatedCurrentStep / associatedTotalSteps) * 100
  )
  const currentAssociatedEntity = isReviewStep
    ? null
    : ENTITY_ORDER[associatedStepIndex]
  const currentAssociatedDraft = currentAssociatedEntity
    ? associatedDraft[currentAssociatedEntity]
    : null
  const sourceScopedExistingEntities = useMemo<ExistingEntities>(() => {
    if (wizardMode !== 'single') return existingEntities

    const selectedEndpoint =
      normalizeEndpoint(singleDataSourceEndpoint || defaultSingleDataSourceEndpoint) ||
      normalizeEndpoint(siteConfig.api_root)

    const resolveEntityEndpoint = (entity: any) =>
      normalizeEndpoint(String(entity?.__sourceEndpoint ?? siteConfig.api_root))

    const filterByEndpoint = (items: any[]) =>
      items.filter((item) => resolveEntityEndpoint(item) === selectedEndpoint)

    return {
      things: filterByEndpoint(existingEntities.things),
      locations: filterByEndpoint(existingEntities.locations),
      sensors: filterByEndpoint(existingEntities.sensors),
      observedProperties: filterByEndpoint(existingEntities.observedProperties),
      datastreams: filterByEndpoint(existingEntities.datastreams),
      networks: filterByEndpoint(existingEntities.networks),
    }
  }, [
    wizardMode,
    singleDataSourceEndpoint,
    defaultSingleDataSourceEndpoint,
    existingEntities,
  ])
  const existingOptions = useMemo<ExistingOptionsMap>(
    () => buildExistingOptions(sourceScopedExistingEntities),
    [sourceScopedExistingEntities]
  )

  useEffect(() => {
    if (!isOpen) return

    setSingleDataSourceEndpoint((current) => {
      if (
        current &&
        fullAccessDataSources.some((source) => source.endpoint === current)
      ) {
        return current
      }

      return defaultSingleDataSourceEndpoint
    })
  }, [defaultSingleDataSourceEndpoint, fullAccessDataSources, isOpen])

  const selectedDataSource = useMemo(
    () =>
      fullAccessDataSources.find(
        (source) => source.endpoint === normalizeEndpoint(singleDataSourceEndpoint)
      ) ?? null,
    [fullAccessDataSources, singleDataSourceEndpoint]
  )

  const resolveRequestToken = (
    endpoint: string,
    preferredToken?: string | null
  ) => {
    const normalizedEndpoint = normalizeEndpoint(endpoint)

    if (preferredToken?.trim()) return preferredToken.trim()

    const endpointToken = getDataSourceToken(normalizedEndpoint)
    if (endpointToken) return endpointToken

    if (normalizedEndpoint === primaryEndpoint) {
      return token ?? undefined
    }

    return undefined
  }

  const closeDataSourceLogin = () => {
    setPendingDataSourceLogin(null)
    setDataSourceLoginForm({ username: '', password: '' })
    setDataSourceLoginSubmitted(false)
    setDataSourceLoginError(null)
    setIsDataSourceLoginSaving(false)
  }

  const openDataSourceLogin = (
    source: { endpoint: string; name: string },
    resumeSubmit: boolean
  ) => {
    setPendingDataSourceLogin({
      endpoint: source.endpoint,
      name: source.name,
      resumeSubmit,
    })
    setDataSourceLoginForm({ username: '', password: '' })
    setDataSourceLoginSubmitted(false)
    setDataSourceLoginError(null)
    setIsDataSourceLoginSaving(false)
  }

  const selectedDataSourceRequiresLogin =
    !!selectedDataSource &&
    siteConfig.authorizationEnabled &&
    !resolveRequestToken(selectedDataSource.endpoint)

  const updateAssociatedEntity = <K extends EntityKey>(
    entity: K,
    updater: (current: EntityDraft<K>) => EntityDraft<K>
  ) => {
    setAssociatedDraft((current) => ({
      ...current,
      [entity]: updater(current[entity] as EntityDraft<K>),
    }))
  }

  const executeSingleSubmit = async (
    selectedEndpoint: string,
    requestToken?: string | null
  ) => {
    setIsSubmitting(true)

    try {
      let result = null

      if (singleEntity === 'thing') {
        const thingPayload = normalizeEntityPayload(
          'thing',
          singleDraft.thing
        ) as CreateThingPayload
        result = await createThing(
          {
            ...thingPayload,
            ...(requiresCommitMessage
              ? { commitMessage: commitMessage.trim() }
              : {}),
          },
          requestToken,
          selectedEndpoint
        )
      } else if (singleEntity === 'location') {
        const locationPayload = normalizeEntityPayload(
          'location',
          singleDraft.location
        ) as CreateLocationPayload
        result = await createLocation(
          {
            ...locationPayload,
            ...(requiresCommitMessage
              ? { commitMessage: commitMessage.trim() }
              : {}),
          },
          requestToken,
          selectedEndpoint
        )
      } else if (singleEntity === 'sensor') {
        const sensorPayload = normalizeEntityPayload(
          'sensor',
          singleDraft.sensor
        ) as CreateSensorPayload
        result = await createSensor(
          {
            ...sensorPayload,
            ...(requiresCommitMessage
              ? { commitMessage: commitMessage.trim() }
              : {}),
          },
          requestToken,
          selectedEndpoint
        )
      } else if (singleEntity === 'datastream') {
        const datastreamPayload = normalizeEntityPayload(
          'datastream',
          singleDraft.datastream
        ) as CreateDatastreamPayload
        result = await createDatastream(
          {
            ...datastreamPayload,
            ...(requiresCommitMessage
              ? { commitMessage: commitMessage.trim() }
              : {}),
          },
          requestToken,
          selectedEndpoint
        )
      } else {
        const observedPropertyPayload = normalizeEntityPayload(
          'observedProperty',
          singleDraft.observedProperty
        ) as CreateObservedPropertyPayload
        result = await createObservedProperty(
          {
            ...observedPropertyPayload,
            ...(requiresCommitMessage
              ? { commitMessage: commitMessage.trim() }
              : {}),
          },
          requestToken,
          selectedEndpoint
        )
      }

      if (!result) {
        setSubmitError(
          singleEntity === 'thing'
            ? 'Unable to create Thing'
            : singleEntity === 'location'
              ? 'Unable to create Location'
              : singleEntity === 'sensor'
                ? 'Unable to create Sensor'
                : singleEntity === 'datastream'
                  ? 'Unable to create Datastream'
                  : 'Unable to create Observed Property'
        )
        return
      }

      router.refresh()
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSingleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setSubmitError(null)

    if (!fullAccessDataSources.length) {
      setSubmitError(t('wizard.no_full_access_data_sources'))
      return
    }

    if (requiresCommitMessage && !commitMessage.trim()) {
      setSubmitError(t('commit.message_required'))
      return
    }

    const selectedEndpoint = normalizeEndpoint(singleDataSourceEndpoint)
    const currentSource = fullAccessDataSources.find(
      (source) => source.endpoint === selectedEndpoint
    )

    if (!currentSource) {
      setSubmitError(t('wizard.invalid_data_source_selection'))
      return
    }

    const requestToken = resolveRequestToken(selectedEndpoint)

    if (siteConfig.authorizationEnabled && !requestToken) {
      openDataSourceLogin(currentSource, true)
      return
    }

    await executeSingleSubmit(selectedEndpoint, requestToken)
  }

  const handleDataSourceLogin = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    if (!pendingDataSourceLogin || isDataSourceLoginSaving) return

    setDataSourceLoginSubmitted(true)
    setDataSourceLoginError(null)

    const username = dataSourceLoginForm.username.trim()
    const password = dataSourceLoginForm.password.trim()

    if (!username || !password) {
      setDataSourceLoginError(t('data_sources.validation_credentials_required'))
      return
    }

    setIsDataSourceLoginSaving(true)

    try {
      const response = await fetch(inspectApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'authenticated',
          apiRoot: pendingDataSourceLogin.endpoint,
          username,
          password,
        }),
        cache: 'no-store',
      })

      const data = (await response
        .json()
        .catch(() => null)) as DataSourceInspectResponse | null

      if (!data || typeof data !== 'object' || !('ok' in data)) {
        throw new Error('validation_probe_failed')
      }

      if (data.ok === false) {
        throw new Error(data.errorCode || 'validation_login_failed')
      }

      const accessToken =
        typeof data.accessToken === 'string' ? data.accessToken.trim() : ''

      if (!accessToken) {
        throw new Error('validation_login_failed')
      }

      setDataSourceToken(pendingDataSourceLogin.endpoint, accessToken)

      const shouldResume = pendingDataSourceLogin.resumeSubmit
      const endpoint = pendingDataSourceLogin.endpoint
      closeDataSourceLogin()

      if (shouldResume) {
        setSubmitError(null)
        await executeSingleSubmit(endpoint, accessToken)
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'validation_credentials_required') {
          setDataSourceLoginError(t('data_sources.validation_credentials_required'))
        } else if (error.message === 'validation_login_missing') {
          setDataSourceLoginError(t('data_sources.validation_login_missing'))
        } else if (error.message === 'validation_login_failed') {
          setDataSourceLoginError(t('data_sources.validation_login_failed'))
        } else if (error.message === 'validation_login_check_failed') {
          setDataSourceLoginError(t('data_sources.validation_login_check_failed'))
        } else {
          setDataSourceLoginError(t('data_sources.validation_probe_failed'))
        }
      } else {
        setDataSourceLoginError(t('data_sources.validation_probe_failed'))
      }
    } finally {
      setIsDataSourceLoginSaving(false)
    }
  }

  const handleAssociatedSubmit = () => {
    console.log('associated entity draft', associatedDraft)
    onClose()
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        placement="center"
        scrollBehavior="inside"
        backdrop="blur"
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        size="5xl"
        classNames={{
          wrapper: 'z-[6000]',
          base: 'z-[6001] h-[80vh] min-h-[80vh] max-h-[80vh]',
          backdrop: 'z-[5999]',
        }}
      >
        <ModalContent>
          <ModalBody className="h-full overflow-hidden py-5">
            <div className="flex h-full min-h-0 flex-col gap-5">
            <SectionTitle
              title={t('wizard.title')}
              description={t('wizard.subtitle')}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <ModeCard
                active={wizardMode === 'associated'}
                title={t('wizard.associated_mode')}
                description={t('wizard.associated_mode_description')}
                onClick={() => setWizardMode('associated')}
              />
              <ModeCard
                active={wizardMode === 'single'}
                title={t('wizard.single_mode')}
                description={t('wizard.single_mode_description')}
                onClick={() => setWizardMode('single')}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-auto pr-1">
              {wizardMode === 'single' ? (
                <HeroForm
                  className="block w-full min-w-0 space-y-4"
                  onSubmit={handleSingleSubmit}
                >
                  <div className="grid w-full min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {ENTITY_ORDER.map((entity) => {
                        const active = singleEntity === entity
                        const hasDraftData =
                          singleDraft[entity].name.trim().length > 0

                        return (
                          <StepCard
                            key={entity}
                            active={active}
                            complete={hasDraftData}
                            label={entityLabels[entity]}
                            icon={entityIcons[entity]}
                            onClick={() => setSingleEntity(entity)}
                          />
                        )
                      })}
                    </div>

                    <div className="min-w-0 space-y-4">
                      <SectionTitle
                        title={entityLabels[singleEntity]}
                        description={t('wizard.select_entity_type')}
                      />

                      {fullAccessDataSources.length > 0 ? (
                        <Autocomplete
                          label={t('wizard.data_source')}
                          labelPlacement="inside"
                          placeholder={t('wizard.data_source_placeholder')}
                          variant="underlined"
                          radius="sm"
                          size="sm"
                          isRequired
                          selectedKey={singleDataSourceEndpoint || null}
                          items={fullAccessDataSources}
                          onSelectionChange={(key) =>
                            setSingleDataSourceEndpoint(key ? String(key) : '')
                          }
                        >
                          {(source) => (
                            <AutocompleteItem
                              key={source.endpoint}
                              textValue={source.name}
                            >
                              <div className="flex flex-col">
                                <span>{source.name}</span>
                                <span className="line-clamp-1 text-xs text-default-500">
                                  {source.endpoint}
                                </span>
                              </div>
                            </AutocompleteItem>
                          )}
                        </Autocomplete>
                      ) : (
                        <div className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
                          {t('wizard.no_full_access_data_sources')}
                        </div>
                      )}

                      {selectedDataSourceRequiresLogin ? (
                        <div className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
                          <div className="mb-2">
                            {t('wizard.data_source_login_required')}
                          </div>
                          <Button
                            size="sm"
                            color="warning"
                            variant="flat"
                            onPress={() =>
                              openDataSourceLogin(selectedDataSource, false)
                            }
                          >
                            {t('login.login')}
                          </Button>
                        </div>
                      ) : null}

                      <EntityFields
                        entity={singleEntity}
                        data={singleDraft[singleEntity]}
                        onChange={(value) =>
                          setSingleDraft((current) => ({
                            ...current,
                            [singleEntity]: value,
                          }))
                        }
                        labels={entityLabels}
                        existingOptions={existingOptions}
                        showSingleAssociations
                      />

                      {requiresCommitMessage ? (
                        <Textarea
                          label={t('commit.message')}
                          labelPlacement="inside"
                          value={commitMessage}
                          onValueChange={setCommitMessage}
                          placeholder={t('commit.message_placeholder')}
                          variant="underlined"
                          radius="sm"
                          minRows={3}
                          isRequired
                          startContent={<StepIcon icon={CommitIcon} />}
                          size="sm"
                        />
                      ) : null}

                      {submitError ? (
                        <div className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                          {submitError}
                        </div>
                      ) : null}

                      <div className="flex justify-between gap-2">
                        <div />
                        <div className="flex gap-2">
                          <Button variant="light" onPress={onClose}>
                            {t('general.cancel')}
                          </Button>
                          <Button
                            color="primary"
                            type="submit"
                            isDisabled={isSubmitting}
                          >
                            {isSubmitting
                              ? `${
                                  operation === 'edit'
                                    ? t('general.edit')
                                    : t('general.create')
                                }...`
                              : operation === 'edit'
                                ? t('general.edit')
                                : t('general.create')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </HeroForm>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    {ENTITY_ORDER.map((entity, index) => {
                      const item = associatedDraft[entity]
                      const hasDraftData =
                        item.source === 'existing'
                          ? item.existingId.trim().length > 0
                          : item.formData.name.trim().length > 0

                      return (
                        <StepCard
                          key={entity}
                          active={associatedStepIndex === index}
                          complete={hasDraftData}
                          label={entityLabels[entity]}
                          icon={entityIcons[entity]}
                          onClick={() => setAssociatedStepIndex(index)}
                        />
                      )
                    })}
                    <StepCard
                      active={isReviewStep}
                      complete={false}
                      label={t('wizard.review_title')}
                      icon={<StepIcon icon={ReviewIcon} />}
                      onClick={() =>
                        setAssociatedStepIndex(ENTITY_ORDER.length)
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-xs text-default-500">
                        <span>
                          {t(
                            'wizard.progress_label',
                            `Step ${associatedCurrentStep} of ${associatedTotalSteps}`,
                            {
                              current: associatedCurrentStep,
                              total: associatedTotalSteps,
                            }
                          )}
                        </span>
                        <span>{associatedProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-default-100">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${associatedProgress}%` }}
                        />
                      </div>
                    </div>
                    {!isReviewStep &&
                    currentAssociatedEntity &&
                    currentAssociatedDraft ? (
                      <>
                        <Tabs
                          selectedKey={currentAssociatedDraft.source}
                          onSelectionChange={(key) =>
                            updateAssociatedEntity(
                              currentAssociatedEntity,
                              (current) => ({
                                ...current,
                                source: String(key) as 'new' | 'existing',
                              })
                            )
                          }
                          color="primary"
                          variant="underlined"
                          classNames={{
                            tabList: 'gap-4',
                            cursor: 'bg-primary',
                          }}
                        >
                          <Tab
                            key="existing"
                            title={
                              existingEntityTabLabels[currentAssociatedEntity]
                            }
                          />
                          <Tab
                            key="new"
                            title={newEntityTabLabels[currentAssociatedEntity]}
                          />
                        </Tabs>

                        {currentAssociatedDraft.source === 'existing' ? (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                              <div className="space-y-4">
                                <ExistingEntitySelect
                                  entity={currentAssociatedEntity}
                                  label={t('wizard.select_existing_entity', {
                                    entity:
                                      entityLabels[currentAssociatedEntity],
                                  })}
                                  placeholder={t(
                                    'wizard.select_existing_entity_placeholder'
                                  )}
                                  value={currentAssociatedDraft.existingId}
                                  options={
                                    existingOptions[currentAssociatedEntity]
                                  }
                                  onChange={(value) =>
                                    updateAssociatedEntity(
                                      currentAssociatedEntity,
                                      (current) => ({
                                        ...current,
                                        existingId: value,
                                      })
                                    )
                                  }
                                  emptyText={t('wizard.no_existing_entities')}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                              <div className="flex justify-center">
                                <div className="w-full max-w-3xl">
                                  <EntityFields
                                    entity={currentAssociatedEntity}
                                    data={currentAssociatedDraft.formData}
                                    onChange={(value) =>
                                      updateAssociatedEntity(
                                        currentAssociatedEntity,
                                        (current) => ({
                                          ...current,
                                          formData: value as any,
                                        })
                                      )
                                    }
                                    labels={entityLabels}
                                    existingOptions={existingOptions}
                                    showSingleAssociations={false}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between gap-2">
                          <Button
                            variant="light"
                            onPress={() =>
                              setAssociatedStepIndex((current) =>
                                Math.max(0, current - 1)
                              )
                            }
                            isDisabled={associatedStepIndex === 0}
                          >
                            {t('general.back')}
                          </Button>

                          <div className="flex gap-2">
                            <Button variant="light" onPress={onClose}>
                              {t('general.cancel')}
                            </Button>
                            <Button
                              color="primary"
                              onPress={() =>
                                setAssociatedStepIndex((current) =>
                                  Math.min(ENTITY_ORDER.length, current + 1)
                                )
                              }
                            >
                              {t('general.next', 'Next')}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <SectionTitle
                          title={t('wizard.review_title')}
                          description={t('wizard.review_description')}
                        />

                        <div className="grid gap-3 md:grid-cols-2">
                          {ENTITY_ORDER.map((entity) => {
                            const item = associatedDraft[entity]
                            const summary =
                              item.source === 'existing'
                                ? existingOptions[entity].find(
                                    (option) => option.value === item.existingId
                                  )?.label || 'Missing selection'
                                : item.formData.name ||
                                  t('wizard.ready_to_submit')

                            return (
                              <div
                                key={entity}
                                className="rounded-2xl border border-default-200 p-4"
                              >
                                <div className="text-sm font-semibold">
                                  {entityLabels[entity]}
                                </div>
                                <div className="mt-1 text-xs uppercase tracking-wide text-default-400">
                                  {item.source === 'new'
                                    ? t('wizard.create_new')
                                    : t('wizard.use_existing')}
                                </div>
                                <div className="mt-2 text-sm text-default-600">
                                  {summary}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div className="flex justify-between gap-2">
                          <Button
                            variant="light"
                            onPress={() =>
                              setAssociatedStepIndex(ENTITY_ORDER.length - 1)
                            }
                          >
                            {t('general.back')}
                          </Button>

                          <div className="flex gap-2">
                            <Button variant="light" onPress={onClose}>
                              {t('general.cancel')}
                            </Button>
                            <Button
                              color="primary"
                              onPress={handleAssociatedSubmit}
                            >
                              {t('general.finish', 'Finish')}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!pendingDataSourceLogin}
        onOpenChange={(open) => {
          if (!open) closeDataSourceLogin()
        }}
        backdrop="blur"
        placement="center"
        classNames={{
          wrapper: 'z-[6100]',
          base: 'z-[6101]',
          backdrop: 'z-[6099]',
        }}
      >
        <ModalContent>
          <form onSubmit={handleDataSourceLogin}>
            <ModalHeader>{t('data_sources.login_form_title')}</ModalHeader>
            <ModalBody className="flex flex-col gap-4">
              <p className="text-sm text-default-500">
                {t('data_sources.login_form_subtitle')}
              </p>

              {pendingDataSourceLogin ? (
                <div className="rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-xs text-default-600">
                  <div>{pendingDataSourceLogin.name}</div>
                  <div className="line-clamp-1">
                    {pendingDataSourceLogin.endpoint}
                  </div>
                </div>
              ) : null}

              <Input
                isRequired
                label={t('data_sources.username')}
                placeholder={t('data_sources.username_placeholder')}
                value={dataSourceLoginForm.username}
                onValueChange={(value) =>
                  setDataSourceLoginForm((current) => ({
                    ...current,
                    username: value,
                  }))
                }
                isInvalid={
                  dataSourceLoginSubmitted &&
                  !dataSourceLoginForm.username.trim()
                }
              />

              <Input
                isRequired
                type="password"
                label={t('data_sources.password')}
                placeholder={t('data_sources.password_placeholder')}
                value={dataSourceLoginForm.password}
                onValueChange={(value) =>
                  setDataSourceLoginForm((current) => ({
                    ...current,
                    password: value,
                  }))
                }
                isInvalid={
                  dataSourceLoginSubmitted &&
                  !dataSourceLoginForm.password.trim()
                }
              />

              {dataSourceLoginError ? (
                <p className="text-sm text-danger">{dataSourceLoginError}</p>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={closeDataSourceLogin}>
                {t('general.cancel')}
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={isDataSourceLoginSaving}
              >
                {t('login.login')}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  )
}
