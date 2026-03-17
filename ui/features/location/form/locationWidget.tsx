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
import { WidgetProps } from '@rjsf/utils'

import { InputWidget } from '@/components/form/InputWidget'
import { TextareaWidget } from '@/components/form/TextareaWidget'

export const NameWidget = (props: WidgetProps) => <InputWidget {...props} />

export const DescriptionWidget = (props: WidgetProps) => (
  <TextareaWidget {...props} />
)

export const EncodingTypeWidget = (props: WidgetProps) => (
  <InputWidget {...props} />
)

export const LocationWidget = (props: WidgetProps) => <InputWidget {...props} />
