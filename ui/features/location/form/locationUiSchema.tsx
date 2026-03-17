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

import { DescriptionIcon, LocationIcon, MarkerIcon } from '@/components/icons'

import {
  DescriptionWidget,
  EncodingTypeWidget,
  LocationWidget,
  NameWidget,
} from './locationWidget'

export const LocationUiSchema = (t: TFunction): UiSchema => ({
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
              { 'ui:col': { size: 6, children: ['location'] } },
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
            children: [{ 'ui:col': { size: 12, children: ['encodingType'] } }],
          },
        },
      ],
    },
  },
  name: {
    'ui:widget': NameWidget,
    'ui:options': {
      icon: <LocationIcon className="w-5 h-5" />,
      fieldLabel: t('locations.name'),
      placeholder: t('locations.namePlaceholder', 'Nome della Location'),
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="w-5 h-5" />,
      fieldLabel: t('locations.description'),
      placeholder: t(
        'locations.descriptionPlaceholder',
        'Descrizione della Location'
      ),
    },
  },
  encodingType: {
    'ui:widget': EncodingTypeWidget,
    'ui:options': {
      icon: <DescriptionIcon className="w-5 h-5" />,
      fieldLabel: t('locations.encodingType'),
      placeholder: t(
        'locations.encodingTypePlaceholder',
        "Tipo di codifica della posizione (es. 'application/vnd.geo+json')"
      ),
    },
  },
  location: {
    'ui:widget': LocationWidget,
    'ui:options': {
      icon: <MarkerIcon className="w-5 h-5" />,
      fieldLabel: t('locations.location'),
      placeholder: t(
        'locations.locationPlaceholder',
        'Posizione della Location'
      ),
    },
  },
})
