import type { Thing } from '@/types/domain'

export type LocalTimeTravelVersion = {
  systemTimeValidity: [string, string | null]
  commitId: string
  name?: string
  status?: string
  sensor?: string
  observedProperty?: string
  network?: string
  coordinates?: [number, number]
  description?: string
}

export type LocalTimeTravelScenario = {
  asOfSamples: string[]
  fromToSamples: Array<{
    from: string
    to: string
  }>
  commits: Array<{
    id: string
    authoredAt: string
    message: string
  }>
  versions: LocalTimeTravelVersion[]
}

const API_ROOT = 'http://localhost:8018/istsos4/v1.1'

export const localDummyThings: Array<
  Thing & {
    properties: Thing['properties'] & {
      temporary: true
      timeTravel: LocalTimeTravelScenario
    }
  }
> = [
  {
    '@iot.id': 'dummy_thing_1',
    name: 'dummy_thing_1_lugano',
    description: 'Temporary Lugano Thing with historical versions.',
    __sourceEndpoint: API_ROOT,
    __sourceId: 'dummy',
    __sourceName: 'Dummy data',
    properties: {
      temporary: true,
      timeTravel: {
        asOfSamples: [
          '2026-01-15T12:00:00Z',
          '2026-03-15T12:00:00Z',
          '2026-06-25T12:00:00Z',
        ],
        fromToSamples: [
          { from: '2026-01-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
        ],
        commits: [
          {
            id: 'dummy_commit_1001',
            authoredAt: '2026-01-01T09:00:00Z',
            message: 'Create Lugano dummy station',
          },
          {
            id: 'dummy_commit_1002',
            authoredAt: '2026-03-01T09:00:00Z',
            message: 'Move Lugano station to rooftop mast',
          },
          {
            id: 'dummy_commit_1003',
            authoredAt: '2026-06-01T09:00:00Z',
            message: 'Rename Lugano station and update metadata',
          },
        ],
        versions: [
          {
            systemTimeValidity: [
              '2026-01-01T09:00:00Z',
              '2026-03-01T09:00:00Z',
            ],
            commitId: 'dummy_commit_1001',
            name: 'dummy_thing_1_lugano_old',
            coordinates: [2717320, 1095610],
            network: 'Dummy network alpha',
            description: 'Initial street-level test station.',
          },
          {
            systemTimeValidity: [
              '2026-03-01T09:00:00Z',
              '2026-06-01T09:00:00Z',
            ],
            commitId: 'dummy_commit_1002',
            name: 'dummy_thing_1_lugano_rooftop',
            coordinates: [2717510, 1095850],
            network: 'Dummy network alpha',
            description: 'Relocated to rooftop mast.',
          },
          {
            systemTimeValidity: ['2026-06-01T09:00:00Z', null],
            commitId: 'dummy_commit_1003',
            name: 'dummy_thing_1_lugano',
            coordinates: [2717510, 1095850],
            network: 'Dummy network alpha',
            description: 'Current Lugano test station.',
          },
        ],
      },
    },
    Locations: [
      {
        '@iot.id': 'dummy_location_1',
        name: 'Dummy Lugano current location',
        __sourceEndpoint: API_ROOT,
        encodingType: 'application/vnd.geo+json',
        location: {
          type: 'Point',
          coordinates: [2717510, 1095850],
          crs: { type: 'name', properties: { name: 'EPSG:2056' } },
        },
      },
    ],
    Datastreams: [
      {
        '@iot.id': 'dummy_datastream_1',
        name: 'Dummy temperature',
        __sourceEndpoint: API_ROOT,
        __sourceId: 'dummy',
        __sourceName: 'Dummy data',
        phenomenonTime: '2026-01-15T12:00:00Z/2026-06-25T12:00:00Z',
        properties: { acquisitionFrequency: 'PT10M' },
        unitOfMeasurement: { name: 'degree Celsius', symbol: 'degC' },
        ObservedProperty: {
          '@iot.id': 'dummy_observed_property_1',
          name: 'Air temperature',
          definition: 'https://qudt.org/vocab/quantitykind/Temperature',
        },
        Sensor: {
          '@iot.id': 'dummy_sensor_1',
          name: 'Dummy sensor',
          encodingType: 'application/pdf',
          metadata: 'https://istsos.org',
        },
        Network: { '@iot.id': 'dummy_network_1', name: 'Dummy network alpha' },
        Observations: [
          {
            phenomenonTime: '2026-01-15T12:00:00Z',
            resultTime: '2026-01-15T12:00:00Z',
            result: 6.8,
          },
          {
            phenomenonTime: '2026-03-15T12:00:00Z',
            resultTime: '2026-03-15T12:00:00Z',
            result: 13.2,
          },
          {
            phenomenonTime: '2026-06-25T12:00:00Z',
            resultTime: '2026-06-25T12:00:00Z',
            result: 21.4,
          },
        ],
      },
    ],
  },
  {
    '@iot.id': 'dummy_thing_2',
    name: 'dummy_thing_2_bellinzona',
    description: 'Temporary Bellinzona Thing with sensor replacement history.',
    __sourceEndpoint: API_ROOT,
    __sourceId: 'dummy',
    __sourceName: 'Dummy data',
    properties: {
      temporary: true,
      timeTravel: {
        asOfSamples: [
          '2026-02-10T08:00:00Z',
          '2026-04-20T08:00:00Z',
          '2026-06-25T08:00:00Z',
        ],
        fromToSamples: [
          { from: '2026-02-01T00:00:00Z', to: '2026-05-01T00:00:00Z' },
          { from: '2026-04-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
        ],
        commits: [
          {
            id: 'dummy_commit_2001',
            authoredAt: '2026-02-01T10:30:00Z',
            message: 'Create Bellinzona humidity station',
          },
          {
            id: 'dummy_commit_2002',
            authoredAt: '2026-04-10T10:30:00Z',
            message: 'Replace humidity sensor probe',
          },
        ],
        versions: [
          {
            systemTimeValidity: [
              '2026-02-01T10:30:00Z',
              '2026-04-10T10:30:00Z',
            ],
            commitId: 'dummy_commit_2001',
            sensor: 'Dummy RH probe A',
            observedProperty: 'Relative humidity',
            coordinates: [2722100, 1117100],
            network: 'Dummy network beta',
          },
          {
            systemTimeValidity: ['2026-04-10T10:30:00Z', null],
            commitId: 'dummy_commit_2002',
            sensor: 'Dummy RH probe B',
            observedProperty: 'Relative humidity',
            coordinates: [2722100, 1117100],
            network: 'Dummy network beta',
          },
        ],
      },
    },
    Locations: [
      {
        '@iot.id': 'dummy_location_2',
        name: 'Dummy Bellinzona location',
        __sourceEndpoint: API_ROOT,
        encodingType: 'application/vnd.geo+json',
        location: {
          type: 'Point',
          coordinates: [2722100, 1117100],
          crs: { type: 'name', properties: { name: 'EPSG:2056' } },
        },
      },
    ],
    Datastreams: [
      {
        '@iot.id': 'dummy_datastream_2',
        name: 'Dummy relative humidity',
        __sourceEndpoint: API_ROOT,
        __sourceId: 'dummy',
        __sourceName: 'Dummy data',
        phenomenonTime: '2026-02-10T08:00:00Z/2026-06-25T08:00:00Z',
        properties: { acquisitionFrequency: 'PT30M' },
        unitOfMeasurement: { name: 'percent', symbol: '%' },
        ObservedProperty: {
          '@iot.id': 'dummy_observed_property_2',
          name: 'Relative humidity',
          definition: 'https://qudt.org/vocab/quantitykind/RelativeHumidity',
        },
        Sensor: {
          '@iot.id': 'dummy_sensor_2',
          name: 'Dummy RH probe B',
          encodingType: 'application/pdf',
          metadata: 'https://istsos.org',
        },
        Network: { '@iot.id': 'dummy_network_2', name: 'Dummy network beta' },
        Observations: [
          {
            phenomenonTime: '2026-02-10T08:00:00Z',
            resultTime: '2026-02-10T08:00:00Z',
            result: 61,
          },
          {
            phenomenonTime: '2026-04-20T08:00:00Z',
            resultTime: '2026-04-20T08:00:00Z',
            result: 54,
          },
          {
            phenomenonTime: '2026-06-25T08:00:00Z',
            resultTime: '2026-06-25T08:00:00Z',
            result: 48,
          },
        ],
      },
    ],
  },
]
