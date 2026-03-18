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
import { LocationSchema } from '@/features/location/form/locationSchema'
import { LocationUiSchema } from '@/features/location/form/locationUiSchema'
import MapComponent from '@/features/map/components/LeafletMiniMap'
import { Button } from '@heroui/button'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface LocationFormProps {
  operation: 'create' | 'edit'
  latitude?: number
  longitude?: number
  onSuccess: () => void
}

export default function LocationForm({
  operation,
  latitude,
  longitude,
  onSuccess,
}: LocationFormProps) {
  const [schema, setSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const { t } = useTranslation()
  const mapRef = useRef(null)

  useEffect(() => {
    const initialData: any = {}
    if (latitude !== undefined && longitude !== undefined) {
      initialData.location = `${latitude}, ${longitude}`
    }

    setSchema({
      schema: {
        ...LocationSchema,
        properties: { ...LocationSchema.properties },
      },
      uiSchema: LocationUiSchema(t),
    })
    setFormData(initialData)
  }, [latitude, longitude])

  const handleMapMove = (coords: { lat: number; lng: number }) => {
    setFormData((prev) => ({
      ...prev,
      location: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    }))
  }

  const handleSubmit = async ({ formData }: any) => {
    try {
      console.log('submit location', formData)
      onSuccess()
    } catch (error) {
      console.error(error)
    }
  }

  if (!schema) return null

  return (
    <Form
      schema={schema.schema}
      uiSchema={schema.uiSchema}
      formData={formData}
      onChange={(e) => setFormData(e.formData)}
      onSubmit={handleSubmit}
      validator={validator}
    >
      <br />
      <MapComponent
        ref={mapRef}
        onCenterChange={handleMapMove}
        coordinates={formData?.location}
      />
      <div className="flex justify-end gap-2 mt-4">
        {operation === 'edit' ? (
          <Button type="submit" variant="solid">
            {t('general.save')}
          </Button>
        ) : (
          <Button type="submit" variant="solid">
            {t('general.create')}
          </Button>
        )}
        <Button variant="light" onPress={onSuccess}>
          {t('general.cancel')}
        </Button>
      </div>
    </Form>
  )
}
