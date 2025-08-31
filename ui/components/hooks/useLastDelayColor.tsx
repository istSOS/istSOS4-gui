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

import { DateTime } from "luxon";
import { getGlobalTimeShift } from "./formatDateWithTimezone";


export function getLastDelayColor(
  entity: any,
  delayThreshold: number | null,
  timezone: string
): "success" | "warning" | "danger" | "default" {
  if (!entity?.lastMeasurement) return "default";
  if (delayThreshold == null) return "default";
  try {
    const shift = getGlobalTimeShift();
    const last = DateTime.fromISO(entity.lastMeasurement).setZone(timezone).plus({ hours: shift });
    if (!last.isValid) return "default";
    const nowShifted = DateTime.now().setZone(timezone).plus({ hours: shift });
    const diffMinutes = nowShifted.diff(last, "minutes").minutes;
    if (diffMinutes <= delayThreshold) return "success";
    if (diffMinutes <= delayThreshold * 2) return "warning";
    return "danger";
  } catch {
    return "default";
  }
}


export function createLastDelayColorStrategy(
  delayThreshold: number | null,
  timezone: string
) {
  return (entity: any) => getLastDelayColor(entity, delayThreshold, timezone);
}