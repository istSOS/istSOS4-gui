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

import { DescriptionIcon, KeyIcon, NameIcon } from '@/components/icons'

import {
  DescriptionWidget,
  KeyWidget,
  NameWidget,
  ValueWidget,
} from './thingWidget'

export const ThingUiSchema = (t: TFunction): UiSchema => ({
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
      icon: <NameIcon className="h-5 w-5" />,
      fieldLabel: t('things.name'),
      placeholder: t('things.name_placeholder'),
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="h-5 w-5" />,
      fieldLabel: t('things.description'),
      placeholder: t('things.description_placeholder'),
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
          fieldLabel: t('things.propertiesKey'),
          placeholder: t('things.propertiesKey_placeholder'),
        },
      },
      value: {
        'ui:widget': ValueWidget,
        'ui:options': {
          icon: <NameIcon className="h-5 w-5" />,
          fieldLabel: t('things.propertiesValue'),
          placeholder: t('things.propertiesValue_placeholder'),
        },
      },
    },
  },
})
