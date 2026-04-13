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

export type HistoryEntityType =
  | 'Thing'
  | 'Sensor'
  | 'Datastream'
  | 'Location'
  | 'ObservedProperty'
  | 'FeatureOfInterest'

export type HistoryAction = 'CREATE' | 'UPDATE' | 'DELETE'

export interface FieldDiffItem {
  field: string
  before: string
  after: string
}

export interface HistoryCommit {
  id: number
  entityType: HistoryEntityType
  entityId: number
  entityName: string
  author: string
  message: string
  date: string
  actionType: HistoryAction
  fieldDiff: FieldDiffItem[]
}

export interface HistorySnapshot {
  id: number
  label: string
  description: string
  snapshotAt: string
  systemTimeValidity?: string
  meta: Record<string, string>
}

export interface HistoryResponse {
  entityType: HistoryEntityType
  value: HistorySnapshot[]
  commits: HistoryCommit[]
}

export interface ActivityBucket {
  date: string
  count: number
}
