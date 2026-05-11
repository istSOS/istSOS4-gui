export type ThingLayerItem = {
  key: string
  label: string
  enabled: boolean
}

export type NetworkLayerItem = {
  key: string
  label: string
  enabled: boolean
  things: ThingLayerItem[]
}

export type ObservedPropertyLayerItem = {
  key: string
  label: string
  enabled: boolean
}

export type DataSourceLayerItem = {
  key: string
  label: string
  color?: string
  enabled: boolean
  networks: NetworkLayerItem[]
  observedProperties: ObservedPropertyLayerItem[]
  observedEnabled: boolean
}

export type SourceItemHandlers = {
  onToggleSource: (sourceKey: string, nextEnabled: boolean) => void
  onSourceColorChange: (sourceKey: string, color: string) => void
  onToggleNetwork: (
    sourceKey: string,
    networkKey: string,
    nextEnabled: boolean
  ) => void
  onToggleThing: (
    sourceKey: string,
    networkKey: string,
    thingKey: string,
    nextEnabled: boolean
  ) => void
  onToggleObservedGroup: (sourceKey: string, nextEnabled: boolean) => void
  onToggleObservedProperty: (
    sourceKey: string,
    propertyKey: string,
    nextEnabled: boolean
  ) => void
}
