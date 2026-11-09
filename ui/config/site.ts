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
import guiPackage from '@/package.json'
import type { BasemapKey } from '@/types'

import { getPrimaryDataSource } from '@/config/dataSources'
import { isVersioningEnabled } from '@/config/versioning'

export const BASEMAPS: Record<
  BasemapKey,
  {
    label: string
    url: string
    attribution: string
    minZoom: number
    maxZoom: number
  }
> = {
  pixelGray: {
    label: 'Gray map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    minZoom: 2,
    maxZoom: 16,
  },
  pixelColor: {
    label: 'Color map',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 2,
    maxZoom: 19,
  },
  satellite: {
    label: 'Aerial imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    minZoom: 2,
    maxZoom: 19,
  },
}

// With no configured source there is nothing to sign in to or to read.
const GUI_REPOSITORY = 'https://github.com/istSOS/istSOS4-gui'

export const siteConfig = {
  name: 'istSOS4 admin ui',
  version: guiPackage.version,
  versioning: isVersioningEnabled,
  // Getters, so that the server always follows the data sources file.
  get api_root() {
    return getPrimaryDataSource()?.apiRoot ?? ''
  },
  get authorizationEnabled() {
    return getPrimaryDataSource()?.authorizationEnabled ?? false
  },
  get networkEnabled() {
    return getPrimaryDataSource()?.networkEnabled ?? false
  },
  get items() {
    const API_ROOT = this.api_root
    return [
      {
        label: 'Locations',
        href: '/location',
        root: `${API_ROOT}/Locations`,
        nested: ['Things'],
        weight: 2,
      },
      {
        label: 'Things',
        href: '/thing',
        root: `${API_ROOT}/Things`,
        nested: ['Locations', 'Datastream'],
        weight: 2,
      },
      {
        label: 'Sensors',
        href: '/sensor',
        root: `${API_ROOT}/Sensors`,
        nested: ['Datastream'],
        weight: 2,
      },
      {
        label: 'ObservedProperties',
        href: '/observed-property',
        root: `${API_ROOT}/ObservedProperties`,
        weight: 2,
      },
      {
        label: 'Datastreams',
        href: '/datastream',
        root: `${API_ROOT}/Datastreams`,
        nested: ['Thing', 'Sensor', 'ObservedProperty', 'Network'],
        weight: 1,
      },
      {
        label: 'Observations',
        href: '/observation',
        root: `${API_ROOT}/Observations`,
        nested: ['Datastream', 'FeatureOfInterest'],
        weight: 2,
      },
      {
        label: 'HistoricalLocations',
        href: '/historical-location',
        root: `${API_ROOT}/HistoricalLocations`,
        weight: 3,
      },
      {
        label: 'FeaturesOfInterest',
        href: '/features-of-interest',
        root: `${API_ROOT}/FeaturesOfInterest`,
        weight: 3,
      },
      {
        label: 'Networks',
        href: '/networks',
        root: `${API_ROOT}/Networks`,
        weight: 3,
      },
    ]
  },

  links: {
    github: GUI_REPOSITORY,
    documentation: `${GUI_REPOSITORY}#readme`,
    istSOS: 'https://istsos.org',
    OSGeo: 'https://www.osgeo.org/',
  },
}
