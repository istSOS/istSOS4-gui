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
import { BasemapKey } from '@/types'

export const BASEMAPS: Record<
  BasemapKey,
  { label: string; url: string; attribution: string }
> = {
  pixelGray: {
    label: 'Gray map',
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
  },
  pixelColor: {
    label: 'Color map',
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
  },
  satellite: {
    label: 'Aerial imagery',
    url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
    attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
  },
}

const API_ROOT =
  process.env.NODE_ENV === 'development'
    ? `${process.env.NEXT_PUBLIC_API_URL}`
    : '__NEXT_API_URL__'

const AUTHORIZATION_ENABLED =
  process.env.NODE_ENV === 'development'
    ? process.env.AUTHORIZATION !== '0'
    : String('__AUTHORIZATION__') !== '0'

const NETWORK_ENABLED =
  process.env.NODE_ENV === 'development'
    ? process.env.NETWORK !== '0'
    : String('__NETWORK__') !== '0'

export const siteConfig = {
  name: 'istSOS4 admin ui',
  versioning: true,
  api_root: API_ROOT,
  authorizationEnabled: AUTHORIZATION_ENABLED,
  networkEnabled: NETWORK_ENABLED,
  items: [
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
  ],

  links: {
    github: 'https://github.com/istSOS/istSOS4-gui',
    istSOS: 'https://istsos.org',
    OSGeo: 'https://www.osgeo.org/',
  },
}
