'use client'

import { Button } from '@heroui/button'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useEffect, useState } from 'react'

import { getSchemaAndUiSchema } from '@/server/utils/schemaHelper'

interface ThingFormTabProps {
  operation: 'create' | 'edit'
  onSuccess: () => void
}

export default function ThingFormTab({
  operation,
  onSuccess,
}: ThingFormTabProps) {
  const [schema, setSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    const loadSchema = async () => {
      const schemaData = await getSchemaAndUiSchema('thing')

      setSchema(schemaData)
      setFormData({})
    }

    loadSchema()
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
