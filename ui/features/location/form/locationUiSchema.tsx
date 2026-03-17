// Copyright 2025 SUPSI
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

import {
  DescriptionWidget,
  EncodingTypeWidget,
  LocationWidget,
  NameWidget,
} from '@/features/location/form/locationWidget'
import { DescriptionIcon, LocationIcon, MarkerIcon } from '@/components/icons'

export const locationUiSchema: UiSchema = {
  'ui:field': 'LayoutGridField',
  'ui:layoutGrid': {
    'ui:row': {
      spacing: 2,
      children: [
        {
          'ui:row': {
            size: 12,
            children: [{ 'ui:col': { size: 12, children: ['__header'] } }],
          },
        },
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
      fieldLabel: 'Nome',
      placeholder: 'Nome della Location',
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="w-5 h-5" />,
      fieldLabel: 'Descrizione',
      placeholder: 'Descrizione della Location',
    },
  },
  encodingType: {
    'ui:widget': EncodingTypeWidget,
    'ui:options': {
      icon: <DescriptionIcon className="w-5 h-5" />,
      fieldLabel: 'Tipo di codifica',
      placeholder:
        "Tipo di codifica della posizione (es. 'application/vnd.geo+json')",
    },
  },
  location: {
    'ui:widget': LocationWidget,
    'ui:options': {
      icon: <MarkerIcon className="w-5 h-5" />,
      fieldLabel: 'Posizione',
      placeholder: 'Posizione della Location',
    },
  },
}
