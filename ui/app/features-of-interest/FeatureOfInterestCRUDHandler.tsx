'use client'

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
import { deleteData, fetchData, updateData } from '@/server/api'

interface FeatureOfInterestCRUDHandlerProps {
  item: any
  token: string
  setExpanded: (v: string | null) => void
  setEditFeatureOfInterest: (v: any) => void
  setEditLoading: (v: boolean) => void
  setEditError: (v: string | null) => void
  setFeaturesOfInterest: (v: any[]) => void
  refetchAll: () => Promise<void>
}

export const useFeatureOfInterestCRUDHandler = ({
  item,
  token,
  setExpanded,
  setEditFeatureOfInterest,
  setEditLoading,
  setEditError,
  setFeaturesOfInterest,
  refetchAll,
}: FeatureOfInterestCRUDHandlerProps) => {
  const handleCancelEdit = () => setEditFeatureOfInterest(null)

  const handleEdit = (entity: any) => {
    setEditFeatureOfInterest(entity)
    setExpanded(String(entity['@iot.id']))
  }

  const handleSaveEdit = async (
    updatedFeatureOfInterest: any,
    originalFeatureOfInterest: any
  ) => {
    setEditLoading(true)
    setEditError(null)
    try {
      const payload = {
        name: updatedFeatureOfInterest.name,
        description: updatedFeatureOfInterest.description,
        encodingType:
          updatedFeatureOfInterest.encodingType ||
          originalFeatureOfInterest.encodingType,
      }

      await updateData(
        `${item.root}(${originalFeatureOfInterest['@iot.id']})`,
        token,
        payload
      )

      const data = await fetchData(item.root, token)
      setFeaturesOfInterest(data?.value || [])
      setExpanded(String(originalFeatureOfInterest['@iot.id']))
      setEditFeatureOfInterest(null)
    } catch (err: any) {
      setEditError(err.message || 'Error updating FeatureOfInterest')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (id: string | number) => {
    try {
      await deleteData(`${item.root}(${id})`, token)
      const data = await fetchData(item.root, token)
      setFeaturesOfInterest(data?.value || [])
    } catch (err) {
      console.error('Error deleting FeatureOfInterest:', err)
    }
    refetchAll()
  }

  return {
    handleCancelEdit,
    handleEdit,
    handleSaveEdit,
    handleDelete,
  }
}
