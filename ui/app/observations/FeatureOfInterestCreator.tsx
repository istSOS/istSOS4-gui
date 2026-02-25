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
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import React, { useState } from 'react'

import DrawGeometryModal from '@/components/modals/DrawGeometryModal'

import { siteConfig } from '@/config/site'

import { useAuth } from '@/context/AuthContext'

import { createData } from '@/server/api'

//Find the item with label "FeaturesOfInterest" in siteConfig
const item = siteConfig.items.find((i) => i.label === 'FeaturesOfInterest')

//Define the Props type for the FeatureOfInterestCreator component
type Props = {
  onCreate: (foi: any) => void //Function to call when a new FeatureOfInterest is created
  onCancel: () => void //Function to call when the form is canceled
  isLoading?: boolean //Optional prop to indicate loading state
  error?: string | null //Optional prop to display error message
}

//Functional component for creating a new FeatureOfInterest
const FeatureOfInterestCreator: React.FC<Props> = ({
  onCreate,
  onCancel,
  isLoading,
  error,
}) => {
  // State for form inputs
  const [name, setName] = useState('') //State for the name input
  const [description, setDescription] = useState('') //State for the description input
  const [geometry, setGeometry] = useState<any>(null) //State for the geometry data
  const [modalOpen, setModalOpen] = useState(false) //State for controlling the modal visibility
  const [submitLoading, setSubmitLoading] = useState(false) //State for submit button loading state
  const [submitError, setSubmitError] = useState<string | null>(null) //State for error message during submission
  const [latitude, setLatitude] = useState<string>('') //State for the latitude input
  const [longitude, setLongitude] = useState<string>('') //State for the longitude input
  const auth = useAuth() //Access authentication context

  //Effect to update geometry based on latitude and longitude inputs
  React.useEffect(() => {
    if (latitude && longitude) {
      // Parse latitude and longitude values to floats
      const lat = parseFloat(latitude)
      const lon = parseFloat(longitude)

      //If both lat and lon are valid numbers, set the geometry to a Point with these coordinates
      if (!isNaN(lat) && !isNaN(lon)) {
        setGeometry({
          type: 'Point',
          coordinates: [lon, lat], //GeoJSON uses [longitude, latitude] so the order is this
        })
      } else {
        //If parsing fails, reset geometry to null
        setGeometry(null)
      }
    } else if (!latitude && !longitude) {
      //Reset geometry if both lat and lon are empty
      setGeometry(null)
    }
  }, [latitude, longitude])

  //Function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() //Prevent default form submission behavior

    //Check if geometry is selected
    if (!geometry) return

    setSubmitLoading(true) //Set loading state
    setSubmitError(null) //Reset error state

    try {
      //Create payload for the new FeatureOfInterest
      const foiPayload = {
        name,
        description,
        encodingType: 'application/vnd.geo+json',
        feature: geometry, //Add the geometry to the payload
      }

      //Call the API to create the new FeatureOfInterest
      const foiRes = await createData(item.root, auth.token, foiPayload)

      //Call onCreate callback with the response from the API
      onCreate(foiRes)
    } catch (err: any) {
      //If an error occurs during submission, set the error state
      setSubmitError(err.message || 'Error creating FeatureOfInterest')
    } finally {
      //Reset loading state regardless of success or failure
      setSubmitLoading(false)
    }
  }

  //Check if latitude or longitude inputs are filled
  const isLatLonFilled = latitude !== '' || longitude !== ''

  //Check if geometry is valid (not null)
  const isGeometryValid = geometry !== null

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Input field for name */}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* Input field for description */}
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Geometry selection controls */}
        <div className="flex gap-2 items-end">
          {/* Button to open modal for geometry selection on map */}
          <Button
            radius="sm"
            color={geometry && !isLatLonFilled ? 'success' : 'primary'}
            onPress={() => setModalOpen(true)}
            type="button"
            disabled={isLatLonFilled}
          >
            {geometry && !isLatLonFilled
              ? 'Geometry selected'
              : 'Select a geometry on the map'}
          </Button>

          {/* Input fields for latitude and longitude */}
          <Input
            label="Latitude"
            type="number"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            step="any"
            min={-90}
            max={90}
            className="w-32"
            placeholder="Lat"
          />

          <Input
            label="Longitude"
            type="number"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            step="any"
            min={-180}
            max={180}
            className="w-36"
            placeholder="Lon"
          />
        </div>

        {/* Modal for drawing geometry */}
        {modalOpen && (
          <DrawGeometryModal
            isOpen={modalOpen}
            onOpenChange={setModalOpen}
            onGeometryDrawn={(geojson) => {
              setGeometry(geojson.geometry)
              setLatitude('')
              setLongitude('')
              setModalOpen(false)
            }}
          />
        )}

        {/* Display submit error if any */}
        {submitError && <span className="text-red-500">{submitError}</span>}

        {/* Form submission and cancel buttons */}
        <div className="flex gap-2 mt-2">
          <Button
            radius="sm"
            color="primary"
            type="submit"
            isLoading={submitLoading}
            disabled={!isGeometryValid} // Disable if geometry is not valid
          >
            Create FeatureOfInterest
          </Button>

          <Button radius="sm" color="default" type="button" onPress={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  )
}

export default FeatureOfInterestCreator
