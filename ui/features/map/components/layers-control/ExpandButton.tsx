'use client'

import { Button } from '@heroui/button'

import { ChevronDownIcon } from '@/components/icons'

export default function ExpandButton({
  expanded,
  label,
  onPress,
}: {
  expanded: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="light"
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      onPress={onPress}
      className="h-6 w-6 min-w-6"
    >
      <ChevronDownIcon
        size={16}
        className={
          expanded ? 'rotate-180 transition-transform' : 'transition-transform'
        }
      />
    </Button>
  )
}
