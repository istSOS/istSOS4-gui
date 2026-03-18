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
import { Button } from '@heroui/button'
import { Form as HeroForm } from '@heroui/form'
import { Modal, ModalBody, ModalContent } from '@heroui/modal'
import { Tab, Tabs } from '@heroui/tabs'
import { type ComponentType, type ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DatastreamIcon,
  LocationIcon,
  ObservedPropertyIcon,
  ReviewIcon,
  SensorIcon,
  ThingIcon,
} from '@/components/icons'

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
import { buildExistingOptions, normalizeEntityPayload } from './wizard/utils'

interface FormProps {
  operation: 'create' | 'edit'
  latitude?: number
  longitude?: number
  initialTab?: FormTabKey
  isOpen: boolean
  onClose: () => void
  things?: any[]
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
  things = [],
}: FormProps) {
  const { t } = useTranslation()

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

  const existingOptions = useMemo(() => buildExistingOptions(things), [things])

  const [wizardMode, setWizardMode] = useState<WizardMode>('associated')
  const [singleEntity, setSingleEntity] = useState<EntityKey>(initialTab)
  const [singleDraft, setSingleDraft] = useState<FormDataMap>(
    createInitialSingleDraft(latitude, longitude)
  )
  const [associatedDraft, setAssociatedDraft] = useState<AssociatedDraft>(
    createInitialAssociatedDraft(latitude, longitude)
  )
  const [associatedStepIndex, setAssociatedStepIndex] = useState(0)

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

  const updateAssociatedEntity = <K extends EntityKey>(
    entity: K,
    updater: (current: EntityDraft<K>) => EntityDraft<K>
  ) => {
    setAssociatedDraft((current) => ({
      ...current,
      [entity]: updater(current[entity] as EntityDraft<K>),
    }))
  }

  const handleSingleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.log('single entity draft', {
      entity: singleEntity,
      payload: normalizeEntityPayload(singleEntity, singleDraft[singleEntity]),
    })
    onClose()
  }

  const handleAssociatedSubmit = () => {
    console.log('associated entity draft', associatedDraft)
    onClose()
  }

  return (
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

                      <div className="flex justify-between gap-2">
                        <div />
                        <div className="flex gap-2">
                          <Button variant="light" onPress={onClose}>
                            {t('general.cancel')}
                          </Button>
                          <Button color="primary" type="submit">
                            {operation === 'edit'
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
                                  label={t(
                                    'wizard.select_existing_entity',
                                    {
                                      entity: entityLabels[currentAssociatedEntity],
                                    }
                                  )}
                                  placeholder={t('wizard.select_existing_entity_placeholder')}
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
  )
}
