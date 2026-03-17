import { locationSchema } from '@/components/form/location/locationSchema'
import { locationUiSchema } from '@/components/form/location/locationUiSchema'
import { thingSchema } from '@/components/form/thing/thingSchema'
import { thingUiSchema } from '@/components/form/thing/thingUiSchema'

export interface SchemaUiPair {
  schema: any
  uiSchema: any
}

export type FormType = string

export async function getSchemaAndUiSchema(
  type: FormType
): Promise<SchemaUiPair> {
  let baseSchema: any
  let baseUiSchema: any

  switch (type) {
    case 'thing':
      baseSchema = { ...thingSchema, properties: { ...thingSchema.properties } }
      baseUiSchema = { ...thingUiSchema }
      return { schema: baseSchema, uiSchema: baseUiSchema }

    case 'location':
      baseSchema = {
        ...locationSchema,
        properties: { ...locationSchema.properties },
      }
      baseUiSchema = { ...locationUiSchema }

      return { schema: baseSchema, uiSchema: baseUiSchema }

    default:
      throw new Error(`Unsupported schema type: ${type}`)
  }
}
