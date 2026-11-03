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
import { existsSync, readFileSync } from 'node:fs'

import { CONFIG_PATH_CANDIDATES } from '@/server/data-sources/config'

// The bundled data-sources.json is fixed when the server module is compiled,
// so siteConfig would keep a source that was edited or deleted since. Give it
// a reader of the file as it is now (see getPrimaryDataSource).
// ponytail: a few small sync reads per request; cache on mtime if it shows.
globalThis.readDataSourcesFile = () => {
  const file = CONFIG_PATH_CANDIDATES.find((candidate) => existsSync(candidate))
  try {
    return file ? JSON.parse(readFileSync(file, 'utf-8')) : null
  } catch {
    return null
  }
}
