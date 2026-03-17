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
import { SensorSchema } from '@/features/sensors/form/sensorSchema'
import { SensorUiSchema } from '@/features/sensors/form/sensorUiSchema'
import { Button } from '@heroui/button'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SensorFormProps {
  operation: 'create' | 'edit'
  onSuccess: () => void
}

export default function SensorForm({ operation, onSuccess }: SensorFormProps) {
  const [schema, setSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const { t } = useTranslation()

  useEffect(() => {
    setSchema({
      schema: {
        ...SensorSchema,
        properties: { ...SensorSchema.properties },
      },
      uiSchema: SensorUiSchema(t),
    })
    setFormData({})
  }, [])

  const handleSubmit = async ({ formData }: any) => {
    try {
      console.log('submit sensor', formData)
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
