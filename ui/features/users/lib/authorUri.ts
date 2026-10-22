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

/**
 * @file features/users/lib/authorUri.ts
 *
 * A commit's `author` is not a user object but the committing user's `uri`
 * column, copied as text when the commit is written. It comes in two shapes:
 *
 *   /Users(1)                                   the seeded administrator
 *   http://host/istsos4/v1.1/Users(5)           a user created through POST /Users
 *
 * and `anonymous` when the API runs without authorization. Only the trailing
 * `Users(<id>)` is stable, so that is what is matched.
 */

export type ParsedAuthor =
  | { kind: 'user'; id: string }
  | { kind: 'anonymous' }
  /** Anything else — a hand-set `uri`, or an empty field. Shown as-is. */
  | { kind: 'unknown'; raw: string }

const USER_URI = /\/?Users\((\d+)\)\/?$/

export function parseAuthorUri(author: string | null | undefined): ParsedAuthor {
  const raw = (author ?? '').trim()
  if (raw.toLowerCase() === 'anonymous') return { kind: 'anonymous' }

  const match = USER_URI.exec(raw)
  return match ? { kind: 'user', id: match[1] } : { kind: 'unknown', raw }
}
