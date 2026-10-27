'use client'

import { Button, type ButtonProps } from '@heroui/button'

// Firefox can restore a button's previous disabled state before hydration.
// Keep React in control of QC actions when drafts are restored after a reload.
// Firefox supports autocomplete on buttons; React's button type omits it.
const sessionProps = { autoComplete: 'off' }

export default function QcButton(props: ButtonProps) {
  return <Button {...props} {...sessionProps} />
}
