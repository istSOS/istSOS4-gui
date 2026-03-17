'use client'

import MapComponent from '@/features/map/components/LeafletMiniMap'
import { Button } from '@heroui/button'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useEffect, useRef, useState } from 'react'

import { getSchemaAndUiSchema } from '@/server/utils/schemaHelper'

interface LocationFormTabProps {
  operation: 'create' | 'edit'
  latitude?: number
  longitude?: number
  onSuccess: () => void
}

export default function LocationFormTab({
  operation,
  latitude,
  longitude,
  onSuccess,
}: LocationFormTabProps) {
  const [schema, setSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const mapRef = useRef(null)

  useEffect(() => {
    const loadSchema = async () => {
      const schemaData = await getSchemaAndUiSchema('location')

      const initialData: any = {}
      if (latitude !== undefined && longitude !== undefined) {
        initialData.location = `${latitude}, ${longitude}`
      }

      setSchema(schemaData)
      setFormData(initialData)
    }

    loadSchema()
  }, [latitude, longitude])

  const handleMapMove = (coords: { lat: number; lng: number }) => {
    setFormData((prev) => ({
      ...prev,
      location: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
    }))
  }

  const handleSubmit = async ({ formData }: any) => {
    try {
      console.log('submit thing', formData)
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
            Aggiorna
          </Button>
        ) : (
          <Button type="submit" variant="solid">
            Crea
          </Button>
        )}
        <Button variant="light" onPress={onSuccess}>
          Annulla
        </Button>
      </div>
    </Form>
  )
}
