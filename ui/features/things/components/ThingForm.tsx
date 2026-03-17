'use client'

import { thingSchema } from '@/features/things/form/thingSchema'
import { thingUiSchema } from '@/features/things/form/thingUiSchema'
import { Button } from '@heroui/button'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useEffect, useState } from 'react'

interface ThingFormProps {
  operation: 'create' | 'edit'
  onSuccess: () => void
}

export default function ThingForm({ operation, onSuccess }: ThingFormProps) {
  const [schema, setSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    setSchema({
      schema: {
        ...thingSchema,
        properties: { ...thingSchema.properties },
      },
      uiSchema: { ...thingUiSchema },
    })
    setFormData({})
  }, [])

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
