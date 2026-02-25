'use client'

/*
 * Copyright 2025 SUPSI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { buildObservedPropertyFields } from './utils'

interface ObservedPropertyCreatorProps {
  onCreate: (data: Record<string, any>) => Promise<void>
  onCancel: () => void
  isLoading: boolean
  error: string | null
}

interface ObservedPropertyValues {
  name: string
  description: string
  definition: string
  properties: Array<{ key: string; value: string }>
  [k: string]: any
}

const ObservedPropertyCreator: React.FC<ObservedPropertyCreatorProps> = ({
  onCreate,
  onCancel,
  isLoading,
  error,
}) => {
  const { t } = useTranslation()

  const fields = React.useMemo(() => buildObservedPropertyFields(t), [t])

  const [values, setValues] = React.useState<ObservedPropertyValues>(() => {
    const init: ObservedPropertyValues = {
      name: '',
      description: '',
      definition: '',
      properties: [],
    }
    fields.forEach((f) => {
      if (f.name === 'properties') return
      if (f.defaultValue !== undefined) (init as any)[f.name] = f.defaultValue
      else if ((init as any)[f.name] === undefined) (init as any)[f.name] = ''
    })
    return init
  })

  const [touched, setTouched] = React.useState<Record<string, boolean>>({})

  const handleChange = (name: string, value: any) =>
    setValues((v) => ({ ...v, [name]: value }))

  const addProperty = () =>
    setValues((v) => ({
      ...v,
      properties: [...v.properties, { key: '', value: '' }],
    }))

  const updateProperty = (idx: number, field: 'key' | 'value', val: string) =>
    setValues((v) => {
      const arr = [...v.properties]
      arr[idx] = { ...arr[idx], [field]: val }
      return { ...v, properties: arr }
    })

  const removeProperty = (idx: number) =>
    setValues((v) => ({
      ...v,
      properties: v.properties.filter((_, i) => i !== idx),
    }))

  const validate = () => {
    for (const f of fields) {
      if (f.required) {
        const val = (values as any)[f.name]
        if (
          val === '' ||
          val === null ||
          val === undefined ||
          (Array.isArray(val) && val.length === 0)
        )
          return false
      }
    }
    return true
  }

  const handleSubmit = async () => {
    setTouched(fields.reduce((acc, f) => ({ ...acc, [f.name]: true }), {}))
    if (!validate()) return

    const payload: Record<string, any> = {
      name: values.name,
      description: values.description,
      definition: values.definition,
      properties: Object.fromEntries(
        values.properties.filter((p) => p.key).map((p) => [p.key, p.value])
      ),
    }

    await onCreate(payload)
  }

  const renderPropertiesEditor = () => (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Properties</span>
        <Button
          size="sm"
          variant="bordered"
          onPress={addProperty}
          disabled={isLoading}
        >
          + Add
        </Button>
      </div>
      {values.properties.length === 0 && (
        <div className="text-xs text-default-500">No properties.</div>
      )}
      <div className="flex flex-col gap-2">
        {values.properties.map((p, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-2 items-center">
            <Input
              size="sm"
              variant="bordered"
              label="Key"
              value={p.key}
              onChange={(e) => updateProperty(idx, 'key', e.target.value)}
              className="col-span-2"
            />
            <Input
              size="sm"
              variant="bordered"
              label="Value"
              value={p.value}
              onChange={(e) => updateProperty(idx, 'value', e.target.value)}
              className="col-span-2"
            />
            <Button
              size="md"
              color="danger"
              variant="bordered"
              onPress={() => removeProperty(idx)}
              className="w-4"
            >
              -
            </Button>
          </div>
        ))}
      </div>
    </div>
  )

  const renderField = (field: any) => {
    if (field.name === 'properties') return renderPropertiesEditor()

    const invalid =
      field.required &&
      touched[field.name] &&
      (values as any)[field.name] === ''

    return (
      <Input
        size="sm"
        variant="bordered"
        label={field.label || field.name}
        value={(values as any)[field.name] ?? ''}
        onChange={(e) => handleChange(field.name, e.target.value)}
        isRequired={field.required}
        validationState={invalid ? 'invalid' : 'valid'}
        errorMessage={invalid ? 'Required field' : undefined}
      />
    )
  }

  const propertyField = fields.find((f) => f.name === 'properties')
  const definitionField = fields.find((f) => f.name === 'definition')
  const otherFields = fields.filter(
    (f) => f.name !== 'properties' && f.name !== 'definition'
  )

  return (
    <div className="flex flex-col gap-4 border border-default-200 rounded-md p-4 bg-content1 bg-gray-100">
      <div className="text-sm font-medium">Create ObservedProperty</div>

      {/* Name, Description */}
      <div className="grid grid-cols-2 gap-4">
        {otherFields.map((f) => (
          <div key={f.name}>{renderField(f)}</div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 items-start">
        {propertyField && <div>{renderField(propertyField)}</div>}
        {definitionField && <div>{renderField(definitionField)}</div>}
      </div>

      {error && <div className="text-danger text-xs">{error}</div>}
      <div className="flex gap-2">
        <Button
          size="sm"
          color="primary"
          isLoading={isLoading}
          onPress={handleSubmit}
          isDisabled={isLoading || !validate()}
        >
          Save ObservedProperty
        </Button>
        <Button
          size="sm"
          variant="bordered"
          onPress={onCancel}
          isDisabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default ObservedPropertyCreator
