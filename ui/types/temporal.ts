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

export type TemporalMode = 'current' | 'as_of' | 'from_to'

export interface TemporalState {
  mode: TemporalMode
  asOf: string | null
  fromTo: [string, string] | null
}

export interface CommitItem {
  id: number
  author: string
  message: string
  date: string
  actionType: 'CREATE' | 'UPDATE' | 'DELETE'
  affectedEntities: string[]
}

export interface ThingTemporal {
  '@iot.id': number
  name: string
  description: string
  properties?: Record<string, unknown>
  systemTimeValidity?: string
}

export interface DatastreamTemporal {
  '@iot.id': number
  name: string
  description: string
  observationType: string
  phenomenonTime?: string
  observedArea?: unknown
  systemTimeValidity?: string
}
