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

import {
  DescriptionIcon,
  EncodingTypeIcon,
  KeyIcon,
  MetadataIcon,
  NameIcon,
} from '@/components/icons'

import {
  DescriptionWidget,
  EncodingTypeWidget,
  KeyWidget,
  MetadataWidget,
  NameWidget,
  ValueWidget,
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
      icon: <NameIcon className="w-5 h-5" />,
      fieldLabel: t('sensors.name'),
      placeholder: t('sensors.name_placeholder'),
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="h-5 w-5" />,
      fieldLabel: t('sensors.description'),
      placeholder: t('sensors.description_placeholder'),
    },
  },
  encodingType: {
    'ui:widget': EncodingTypeWidget,
    'ui:options': {
      icon: <EncodingTypeIcon className="h-5 w-5" />,
      fieldLabel: t('sensors.encoding_type'),
      placeholder: t('sensors.encoding_type_placeholder'),
    },
  },
  metadata: {
    'ui:widget': MetadataWidget,
    'ui:options': {
      icon: <MetadataIcon className="h-5 w-5" />,
      fieldLabel: t('sensors.metadata'),
      placeholder: t('sensors.metadata_placeholder'),
    },
  },
  properties: {
    items: {
      'ui:field': 'LayoutGridField',
      'ui:layoutGrid': {
        'ui:row': {
          spacing: 2,
          children: [
            {
              'ui:row': {
                spacing: 2,
                size: 12,
                children: [
                  { 'ui:col': { size: 6, children: ['key'] } },
                  { 'ui:col': { size: 6, children: ['value'] } },
                ],
              },
            },
          ],
        },
      },
      key: {
        'ui:widget': KeyWidget,
        'ui:options': {
          icon: <KeyIcon className="h-5 w-5" />,
          fieldLabel: t('sensors.propertiesKey'),
          placeholder: t('sensors.propertiesKey_placeholder'),
        },
      },
      value: {
        'ui:widget': ValueWidget,
        'ui:options': {
          icon: <NameIcon className="h-5 w-5" />,
          fieldLabel: t('sensors.propertiesValue'),
          placeholder: t('sensors.propertiesValue_placeholder'),
        },
      },
    },
  },
})
