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

export function buildThingFields(params: {
  t: (k: string) => string
  locationOptions: Array<{ label: string; value: any; disabled?: boolean }>
}) {
  const { t, locationOptions } = params

  return [
    {
      name: 'name',
      label: t('things.name'),
      required: true,
      defaultValue: 'New Thing',
    },
    {
      name: 'description',
      label: t('things.description'),
      required: false,
      defaultValue: 'Thing Description',
    },
    {
      name: 'properties',
      label: 'Properties',
      type: 'properties',
      required: false,
    },
    {
      name: 'Location',
      label: 'Location',
      required: false,
      type: 'select',
      options: locationOptions,
    },
  ]
}
