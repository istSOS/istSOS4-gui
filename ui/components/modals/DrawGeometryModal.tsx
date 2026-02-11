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
//For future mantainers: make mapwrapper a generic component and use it here instead of reimporting leaflet if possible
import { Button } from '@heroui/button'
import { Modal, ModalContent } from '@heroui/modal'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet/dist/leaflet.css'
import React, { useEffect, useRef, useState } from 'react'

import { MAP_TILE_LAYER } from '@/config/site'

//Define the Props interface for the DrawGeometryModal component
interface Props {
  isOpen: boolean //Controls visibility of the modal
  onOpenChange: (isOpen: boolean) => void //Callback to change modal visibility
  title?: string //Optional title for the modal
  onGeometryDrawn?: (geometry: any) => void //Callback when a geometry is drawn
}

const DrawGeometryModal: React.FC<Props> = ({
  isOpen,
  onOpenChange,
  title,
  onGeometryDrawn,
}) => {
  //Ref to keep track of the map container DOM element
  const mapContainerRef = useRef<HTMLDivElement>(null)
  //Ref to store the map instance
  const mapRef = useRef<any>(null)
  //Ref to keep track of drawn items on the map
  const drawnItemsRef = useRef<any>(null)
  //State to store the currently selected geometry
  const [selectedGeometry, setSelectedGeometry] = useState<any>(null)
  //State to track if the map has been initialized
  const [isMapInitialized, setIsMapInitialized] = useState(false)

  useEffect(() => {
    //Only proceed if the modal is open
    if (!isOpen) return

    //Function to initialize the map and drawing tools (marker, polygon...)
    const initializeMap = async () => {
      //Dynamically import Leaflet and Leaflet.draw for map functionality
      const L = await import('leaflet')
      await import('leaflet-draw')

      //Use the imported Leaflet or the one available on window
      const Leaflet = (window as any).L || L

      //Exit if map container is not available or map is already initialized
      if (!mapContainerRef.current || mapRef.current) return

      //Initialize the map with specified center and zoom level
      mapRef.current = Leaflet.map(mapContainerRef.current, {
        center: [40, 15], //Center the map on those coordinates
        zoom: 2, //Zoom
      })

      //Add a tile layer to the map (OpenStreetMap tiles)
      Leaflet.tileLayer(MAP_TILE_LAYER.url, {
        attribution: MAP_TILE_LAYER.attribution,
      }).addTo(mapRef.current)

      //Create a feature group to store drawn items
      drawnItemsRef.current = new Leaflet.FeatureGroup()
      mapRef.current.addLayer(drawnItemsRef.current)

      //Configure draw control with specific options for points and polygons
      const drawControl = new Leaflet.Control.Draw({
        draw: {
          polyline: false, //Disable drawing polylines
          rectangle: false, //Disable drawing rectangles
          circle: false, //Disable drawing circles
          marker: {
            icon: new Leaflet.DivIcon({
              className: 'custom-red-dot',
              html: `<div style="width: 18px; height: 18px; background-color: #e53935; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);"></div>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            }),
          },
          polygon: {
            shapeOptions: {
              color: '#1976d2',
              weight: 3,
              opacity: 0.8,
              fillColor: '#90caf9',
              fillOpacity: 0.4,
              dashArray: '5.5',
            },
            icon: new Leaflet.DivIcon({
              className: 'custom-vertex-dot',
              html: `<span style=" display: block; width: 10px; height: 10px; background: #1976d2; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 2px #3333; "></span>`,
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            }),
          },
        },
        edit: {
          featureGroup: drawnItemsRef.current, //Allow editing of drawn items
        },
      })

      //Add the draw control to the map
      mapRef.current.addControl(drawControl)

      //Event listener for when a new layer is created
      mapRef.current.on(Leaflet.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer
        drawnItemsRef.current.addLayer(layer)
        setSelectedGeometry(layer.toGeoJSON())
      })

      //Event listener for when layers are deleted
      mapRef.current.on('draw:deleted', () => {
        setSelectedGeometry(null)
      })

      //Mark the map as initialized
      setIsMapInitialized(true)
    }

    //Call the initializeMap function
    initializeMap()

    //Cleanup function to remove map instance when component unmounts or modal closes
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        drawnItemsRef.current = null
        setIsMapInitialized(false)
      }
    }
  }, [isOpen]) //Only re-run the effect if isOpen changes

  //Effect to clean up the map when the modal is closed
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      drawnItemsRef.current = null
      setSelectedGeometry(null)
      setIsMapInitialized(false)
    }
  }, [isOpen]) //Only re-run the effect if isOpen changes

  //Function to handle confirmation of selected geometry
  const handleConfirm = () => {
    //If a geometry is selected and a callback function is provided, execute the callback
    if (selectedGeometry && onGeometryDrawn) {
      onGeometryDrawn(selectedGeometry)
      onOpenChange(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl">
      <ModalContent>
        <div className="p-8 flex flex-col items-center justify-center">
          {/* Title of the modal */}
          <h2 className="text-xl font-bold mb-4">{title || 'Draw geometry'}</h2>

          {/* Map container */}
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '400px',
              borderRadius: 8,
              overflow: 'hidden',
              zIndex: 1000,
            }}
          />

          {/* Instructions or status message */}
          <div className="mt-4 text-gray-500 text-sm">
            {isMapInitialized
              ? 'Use the tools on the map to draw points and polygons.'
              : 'Initializing map...'}
          </div>

          {/* Buttons for confirming selection or canceling */}
          <div className="flex mt-6">
            <Button
              radius="sm"
              color="primary"
              onPress={handleConfirm}
              className="mr-4"
              disabled={!selectedGeometry}
            >
              Confirm Selection
            </Button>
            <Button radius="sm" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

export default DrawGeometryModal
