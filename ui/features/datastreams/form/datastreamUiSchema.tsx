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
  KeyIcon,
  NameIcon,
  ObservationTypeIcon,
} from '@/components/icons'

import {
  DefinitionWidget,
  DescriptionWidget,
  KeyWidget,
  NameWidget,
  ObservationTypeWidget,
  SymbolWidget,
  ValueWidget,
} from './datastreamWidget'

export const DatastreamUiSchema = (t: TFunction): UiSchema => ({
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
              { 'ui:col': { size: 6, children: ['name'] } },
              { 'ui:col': { size: 6, children: ['observationType'] } },
            ],
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
            children: [
              { 'ui:col': { size: 12, children: ['unitOfMeasurement'] } },
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
      fieldLabel: t('datastreams.name'),
      placeholder: t('datastreams.name_placeholder'),
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="w-5 h-5" />,
      fieldLabel: t('datastreams.description'),
      placeholder: t('datastreams.description_placeholder'),
    },
  },
  unitOfMeasurement: {
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
                { 'ui:col': { size: 4, children: ['name'] } },
                { 'ui:col': { size: 4, children: ['symbol'] } },
                { 'ui:col': { size: 4, children: ['definition'] } },
              ],
            },
          },
        ],
      },
    },
    name: {
      'ui:widget': NameWidget,
      'ui:options': {
        icon: <NameIcon className="w-5 h-5" />,
        fieldLabel: t('datastreams.unit_of_measurement_name'),
        placeholder: t('datastreams.unit_of_measurement_name_placeholder'),
      },
    },
    symbol: {
      'ui:widget': SymbolWidget,
      'ui:options': {
        icon: <NameIcon className="w-5 h-5" />,
        fieldLabel: t('datastreams.unit_of_measurement_symbol'),
        placeholder: t('datastreams.unit_of_measurement_symbol_placeholder'),
      },
    },
    definition: {
      'ui:widget': DefinitionWidget,
      'ui:options': {
        icon: <NameIcon className="w-5 h-5" />,
        fieldLabel: t('datastreams.unit_of_measurement_definition'),
        placeholder: t(
          'datastreams.unit_of_measurement_definition_placeholder'
        ),
      },
    },
  },
  observationType: {
    'ui:widget': ObservationTypeWidget,
    'ui:options': {
      icon: <ObservationTypeIcon className="w-5 h-5" />,
      fieldLabel: t('datastreams.observation_type'),
      placeholder: t('datastreams.observation_type_placeholder'),
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
          fieldLabel: t('datastreams.propertiesKey'),
          placeholder: t('datastreams.propertiesKey_placeholder'),
        },
      },
      value: {
        'ui:widget': ValueWidget,
        'ui:options': {
          icon: <NameIcon className="h-5 w-5" />,
          fieldLabel: t('datastreams.propertiesValue'),
          placeholder: t('datastreams.propertiesValue_placeholder'),
        },
      },
    },
  },
})
