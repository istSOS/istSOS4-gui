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

export function getTimeAgoDays(timeAgo: string) {
  if (!timeAgo) return null
  if (timeAgo.includes('minute')) return 0
  if (timeAgo.includes('hour')) return 0
  const match = timeAgo.match(/(\d+)\s*days?/)
  if (match) return parseInt(match[1], 10)
  return null
}

export function getColorScale(items: any[], entity: any) {
  const daysArr = items
    .map((e) => getTimeAgoDays(e.timeAgo))
    .filter((d) => d !== null)
  if (daysArr.length === 0) return 'default'
  const min = Math.min(...daysArr)
  const max = Math.max(...daysArr)
  const val = getTimeAgoDays(entity.timeAgo)
  if (val === null) return 'default'
  const norm = (val - min) / (max - min || 1)
  if (norm <= 0.33) return 'success'
  if (norm <= 0.66) return 'warning'
  return 'danger'
}
