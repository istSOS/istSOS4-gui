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
  NameWidget,
} from '@/components/form/thing/thingWidget'
import { DescriptionIcon } from '@/components/icons'

export const thingUiSchema: UiSchema = {
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
            children: [{ 'ui:col': { size: 12, children: ['name'] } }],
          },
        },
        {
          'ui:row': {
            size: 12,
            children: [{ 'ui:col': { size: 12, children: ['description'] } }],
          },
        },
      ],
    },
  },
  name: {
    'ui:widget': NameWidget,
    'ui:options': {
      fieldLabel: 'Nome',
      placeholder: 'Nome del sensore',
    },
  },
  description: {
    'ui:widget': DescriptionWidget,
    'ui:options': {
      icon: <DescriptionIcon className="h-5 w-5" />,
      fieldLabel: 'Descrizione',
      placeholder: 'Descrizione del sensore',
    },
  },
}
