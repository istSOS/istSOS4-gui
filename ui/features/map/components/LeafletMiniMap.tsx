'use client'

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
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { forwardRef, useImperativeHandle } from 'react'

import { lv95ToWgs84, parseLv95String } from '@/features/forms/components/wizard/coordinates'

export type MapRef = {
  setCenter: (coords: { lat: number; lng: number }) => void
}

const MapComponent = forwardRef<
  MapRef,
  {
    onCenterChange?: (coords: { lat: number; lng: number }) => void
    coordinates?: string
  }
>(({ onCenterChange, coordinates }, ref) => {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const onCenterChangeRef = useRef(onCenterChange)

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange
  }, [onCenterChange])

  let initialLat = 45.881237
  let initialLng = 8.971079
  if (coordinates) {
    const parsed = parseLv95String(coordinates)
    if (parsed) {
      const { latitude, longitude } = lv95ToWgs84(parsed.east, parsed.north)
      initialLat = latitude
      initialLng = longitude
    }
  }

  useEffect(() => {
    const L = require('leaflet')
    const mapElement = mapRef.current
    if (!mapElement) return

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapElement).setView(
        [initialLat, initialLng],
        13
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current)

      mapInstanceRef.current.on('moveend', () => {
        const center = mapInstanceRef.current.getCenter()
        onCenterChangeRef.current?.({ lat: center.lat, lng: center.lng })
      })

      setTimeout(() => {
        mapInstanceRef.current.invalidateSize()
      }, 200)
    }
  }, [initialLat, initialLng])

  useEffect(() => {
    if (!mapInstanceRef.current) return

    const center = mapInstanceRef.current.getCenter()
    const latChanged = Math.abs(center.lat - initialLat) > 0.00001
    const lngChanged = Math.abs(center.lng - initialLng) > 0.00001

    if (latChanged || lngChanged) {
      mapInstanceRef.current.setView(
        [initialLat, initialLng],
        mapInstanceRef.current.getZoom()
      )
    }
  }, [initialLat, initialLng])

  useImperativeHandle(ref, () => ({
    setCenter: ({ lat, lng }) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView(
          [lat, lng],
          mapInstanceRef.current.getZoom()
        )
      }
    },
  }))

  return (
    <div style={{ position: 'relative', width: '100%', height: 200 }}>
      <div id="map" style={{ width: '100%', height: '100%' }} ref={mapRef} />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="red"
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="36"
        >
          <path d="M22.08,11.04H20.08V4H13.05V2H11.04V4H4V11.04H2V13.05H4V20.08H11.04V22.08H13.05V20.08H20.08V13.05H22.08V11.04M18.07,18.07H13.05V16.06H11.04V18.07H6V13.05H8.03V11.04H6V6H11.04V8.03H13.05V6H18.07V11.04H16.06V13.05H18.07V18.07M13.05,12.05A1,1 0 0,1 12.05,13.05C11.5,13.05 11.04,12.6 11.04,12.05C11.04,11.5 11.5,11.04 12.05,11.04C12.6,11.04 13.05,11.5 13.05,12.05Z" />
        </svg>
      </div>
    </div>
  )
})

export default MapComponent
