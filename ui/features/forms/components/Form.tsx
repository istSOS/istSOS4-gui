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
import DatastreamForm from '@/features/datastreams/components/DatastremForm'
import LocationForm from '@/features/location/components/LocationForm'
import ObservedPropertyForm from '@/features/observedProperty/components/ObservedPropertyForm'
import SensorForm from '@/features/sensors/components/SensorForm'
import ThingForm from '@/features/things/components/ThingForm'
import { Modal, ModalBody, ModalContent } from '@heroui/modal'
import { Tab, Tabs } from '@heroui/tabs'
import { useState } from 'react'

import {
  DatastreamIcon,
  LocationIcon,
  ObservedPropertyIcon,
  SensorIcon,
  ThingIcon,
} from '@/components/icons'

interface FormProps {
  operation: 'create' | 'edit'
  latitude?: number
  longitude?: number
  isOpen: boolean
  onClose: () => void
}

type FormTabKey = string

export default function Form({
  operation,
  latitude,
  longitude,
  isOpen,
  onClose,
}: FormProps) {
  const [selectedTab, setSelectedTab] = useState<FormTabKey>('thing')

  return (
    <Modal
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="4xl"
      classNames={{
        wrapper: 'z-[6000]',
        base: 'z-[6001]',
        backdrop: 'z-[5999]',
      }}
    >
      <ModalContent>
        <ModalBody>
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as FormTabKey)}
            variant="underlined"
          >
            <Tab
              key="thing"
              title={
                <div className="flex items-center space-x-2">
                  <ThingIcon />
                  <span>Thing</span>
                </div>
              }
            >
              <ThingForm operation={operation} onSuccess={onClose} />
            </Tab>

            <Tab
              key="location"
              title={
                <div className="flex items-center space-x-2">
                  <LocationIcon />
                  <span>Location</span>
                </div>
              }
            >
              <LocationForm
                operation={operation}
                latitude={latitude}
                longitude={longitude}
                onSuccess={onClose}
              />
            </Tab>

            <Tab
              key="sensor"
              title={
                <div className="flex items-center space-x-2">
                  <SensorIcon />
                  <span>Sensor</span>
                </div>
              }
            >
              <SensorForm operation={operation} onSuccess={onClose} />
            </Tab>

            <Tab
              key="observedProperty"
              title={
                <div className="flex items-center space-x-2">
                  <ObservedPropertyIcon />
                  <span>Observed Property</span>
                </div>
              }
            >
              <ObservedPropertyForm operation={operation} onSuccess={onClose} />
            </Tab>

            <Tab
              key="datastream"
              title={
                <div className="flex items-center space-x-2">
                  <DatastreamIcon />
                  <span>Datastream</span>
                </div>
              }
            >
              <DatastreamForm operation={operation} onSuccess={onClose} />
            </Tab>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
