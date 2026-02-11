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

export function buildObservedPropertyFields(t: (k: string) => string) {
  return [
    {
      name: 'name',
      label: 'Name',
      required: true,
      defaultValue: 'New ObservedProperty',
    },
    {
      name: 'description',
      label: 'Description',
      required: false,
      defaultValue: 'Default Description',
    },
    {
      name: 'definition',
      label: 'Definition',
      required: false,
      defaultValue:
        'http://www.qudt.org/qudt/owl/1.0.0/quantity/Instances.html/Observed_Property',
    },
    {
      name: 'properties',
      label: 'Properties',
      type: 'properties',
      required: false,
    },
  ]
}
