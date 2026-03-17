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
import { UiSchema } from '@rjsf/utils'
import { TFunction } from 'i18next'

import { DescriptionIcon } from '@/components/icons'

import {
  DescriptionWidget,
  EncodingTypeWidget,
  MetadataWidget,
  NameWidget,
} from './sensorWidget'

export const SensorUiSchema = (t: TFunction): UiSchema => ({
  'ui:field': 'LayoutGridField',
  'ui:layoutGrid': {
    'ui:row': {
      spacing: 2,
      children: [
        {
          'ui:row': {
            spacing: 2,
            size: 12,
            children: [{ 'ui:col': { size: 12, children: ['name'] } }],
          },
        },
        {
          'ui:row': {
            size: 12,
            children: [{ 'ui:col': { size: 12, children: ['description'] } }],
          },
        },
        {
          'ui:row': {
            spacing: 2,
            size: 12,
            children: [
              { 'ui:col': { size: 6, children: ['encodingType'] } },
              { 'ui:col': { size: 6, children: ['metadata'] } },
            ],
          },
        },
        {
          'ui:row': {
            size: 12,
            children: [{ 'ui:col': { size: 12, children: ['properties'] } }],
          },
        },
      ],
    },
  },
  name: {
    'ui:widget': NameWidget,
    'ui:options': {
      fieldLabel: t('sensors.name'),
      placeholder: t('sensors.namePlaceholder', 'Nome del sensore'),
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="h-5 w-5" />,
      fieldLabel: t('sensors.description'),
      placeholder: t(
        'sensors.descriptionPlaceholder',
        'Descrizione del sensore'
      ),
    },
  },
  encodingType: {
    'ui:widget': EncodingTypeWidget,
    'ui:options': {
      fieldLabel: t('sensors.encodingType'),
      placeholder: t(
        'sensors.encodingTypePlaceholder',
        'Tipo di codifica del sensore'
      ),
    },
  },
  metadata: {
    'ui:widget': MetadataWidget,
    'ui:options': {
      fieldLabel: t('sensors.metadata'),
      placeholder: t('sensors.metadataPlaceholder', 'Metadata del sensore'),
    },
  },
  properties: {
    'ui:options': {
      fieldLabel: t('sensors.properties'),
    },
  },
})
