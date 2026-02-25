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
import { Tooltip } from '@heroui/tooltip'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { EditIcon } from '../icons'

type EditButtonProps = {
  onEdit: () => void
  isLoading?: boolean
  disabled?: boolean
}

const EditButton: React.FC<EditButtonProps> = ({
  onEdit,
  isLoading = false,
  disabled = false,
}) => {
  const { t } = useTranslation()

  return (
    <Tooltip content={t('general.edit')}>
      <Button
        radius="sm"
        isIconOnly
        color="warning"
        variant="light"
        onPress={onEdit}
        disabled={isLoading || disabled}
      >
        {isLoading ? <span className="loader"></span> : <EditIcon />}
      </Button>
    </Tooltip>
  )
}

export default EditButton
