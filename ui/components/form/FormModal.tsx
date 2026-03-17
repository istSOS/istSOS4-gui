'use client'

import LocationFormTab from '@/features/location/components/LocationFormTab'
import ThingFormTab from '@/features/things/components/ThingFormTab'
import { Modal, ModalBody, ModalContent } from '@heroui/modal'
import { Tab, Tabs } from '@heroui/tabs'
import { useState } from 'react'

interface FormModalProps {
  operation: 'create' | 'edit'
  latitude?: number
  longitude?: number
  isOpen: boolean
  onClose: () => void
}

type FormTabKey = string

export default function FormModal({
  operation,
  latitude,
  longitude,
  isOpen,
  onClose,
}: FormModalProps) {
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
            aria-label="Form tabs"
            variant="underlined"
          >
            <Tab key="thing" title="Thing">
              <ThingFormTab operation={operation} onSuccess={onClose} />
            </Tab>

            <Tab key="location" title="Location">
              <LocationFormTab
                operation={operation}
                latitude={latitude}
                longitude={longitude}
                onSuccess={onClose}
              />
            </Tab>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
