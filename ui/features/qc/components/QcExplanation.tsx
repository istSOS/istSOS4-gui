'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

/** Text triggers support hover/focus; info icons open only on activation. */
export default function QcExplanation({
  title,
  children,
  content,
  className = '',
  icon = false,
  onOpenChange,
}: {
  title: string
  children: ReactNode
  content: ReactNode
  className?: string
  icon?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const notifyRef = useRef(onOpenChange)
  useEffect(() => {
    notifyRef.current = onOpenChange
  }, [onOpenChange])
  const changeOpen = useCallback((value: boolean) => {
    openRef.current = value
    setOpen(value)
    notifyRef.current?.(value)
  }, [])
  useEffect(
    () => () => {
      if (openRef.current) notifyRef.current?.(false)
    },
    []
  )
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  )
  const [position, setPosition] = useState<{
    top: number
    left: number
    maxWidth: number
    maxHeight: number
  } | null>(null)
  function show() {
    cancelClose()
    // Keep modal explanations in its focus scope and above its table.
    setPortalContainer(
      trigger.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body
    )
    setPosition(null)
    changeOpen(true)
  }
  function cancelClose() {
    if (timer.current) clearTimeout(timer.current)
  }
  function closeLater() {
    cancelClose()
    timer.current = setTimeout(() => {
      if (
        !trigger.current?.contains(document.activeElement) &&
        !card.current?.contains(document.activeElement)
      )
        changeOpen(false)
    }, 160)
  }
  useLayoutEffect(() => {
    if (!open || !portalContainer) return
    function place() {
      if (!trigger.current || !card.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const { width, height } = card.current.getBoundingClientRect()
      const inModal = portalContainer !== document.body
      const container = portalContainer.getBoundingClientRect()
      const leftEdge = inModal ? Math.max(0, container.left) : 0
      const topEdge = inModal ? Math.max(0, container.top) : 0
      const rightEdge = inModal
        ? Math.min(window.innerWidth, container.right)
        : window.innerWidth
      const bottomEdge = inModal
        ? Math.min(window.innerHeight, container.bottom)
        : window.innerHeight
      const maxWidth = Math.max(0, rightEdge - leftEdge - 24)
      const maxHeight = Math.max(0, bottomEdge - topEdge - 24)
      const below = bottomEdge - anchor.bottom - 12
      const top =
        below >= Math.min(height, maxHeight) || anchor.top - topEdge < below
          ? anchor.bottom + 8
          : anchor.top - Math.min(height, maxHeight) - 8
      const viewportTop = Math.max(
        topEdge + 12,
        Math.min(top, bottomEdge - Math.min(height, maxHeight) - 12)
      )
      const viewportLeft = Math.max(
        leftEdge + 12,
        Math.min(anchor.left, rightEdge - Math.min(width, maxWidth) - 12)
      )
      setPosition({
        top:
          viewportTop -
          (inModal
            ? container.top +
              portalContainer.clientTop -
              portalContainer.scrollTop
            : 0),
        left:
          viewportLeft -
          (inModal
            ? container.left +
              portalContainer.clientLeft -
              portalContainer.scrollLeft
            : 0),
        maxWidth,
        maxHeight,
      })
    }
    function outside(event: PointerEvent) {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !card.current?.contains(event.target as Node)
      )
        changeOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (card.current?.contains(document.activeElement))
          trigger.current?.focus({ preventScroll: true })
        changeOpen(false)
        cancelClose()
      }
    }
    place()
    const resize = new ResizeObserver(place)
    if (card.current) resize.observe(card.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      resize.disconnect()
      cancelClose()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, portalContainer, changeOpen])
  const blur = (next: EventTarget | null) => {
    if (
      !trigger.current?.contains(next as Node) &&
      !card.current?.contains(next as Node)
    )
      changeOpen(false)
  }
  return (
    <>
      {icon && children}
      <button
        ref={trigger}
        type="button"
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onMouseEnter={
          icon
            ? undefined
            : () => {
                show()
              }
        }
        onMouseLeave={icon ? undefined : closeLater}
        onFocus={
          icon
            ? undefined
            : () => {
                show()
              }
        }
        onBlur={(event) => blur(event.relatedTarget)}
        onClick={(event) => {
          event.stopPropagation()
          cancelClose()
          if (icon && open) changeOpen(false)
          else show()
        }}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            changeOpen(false)
            return
          }
          if (open && ['ArrowDown', 'Enter', ' '].includes(event.key)) {
            event.preventDefault()
            card.current?.focus({ preventScroll: true })
          }
        }}
        className={`${icon ? 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-default-500 hover:bg-default-100 hover:text-primary' : 'rounded text-left decoration-dotted underline underline-offset-4'} outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${className}`}
      >
        {icon ? (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6" />
            <circle cx="12" cy="7.5" r=".8" fill="currentColor" stroke="none" />
          </svg>
        ) : (
          children
        )}
      </button>
      {open &&
        portalContainer &&
        createPortal(
          <div
            ref={card}
            id={id}
            role="dialog"
            tabIndex={-1}
            aria-label={title}
            onMouseEnter={icon ? undefined : cancelClose}
            onMouseLeave={icon ? undefined : closeLater}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              cancelClose()
              trigger.current?.focus({ preventScroll: true })
              changeOpen(false)
            }}
            onFocusCapture={cancelClose}
            onBlur={(event) => blur(event.relatedTarget)}
            className="z-[100] w-96 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] space-y-3 overflow-auto rounded-lg border border-default-300 bg-content1 p-4 text-sm font-normal text-foreground shadow-xl"
            style={{
              position:
                portalContainer === document.body ? 'fixed' : 'absolute',
              ...position,
              visibility: position ? 'visible' : 'hidden',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{title}</p>
              {icon && (
                <button
                  type="button"
                  aria-label={t('general.close')}
                  onClick={() => {
                    cancelClose()
                    trigger.current?.focus({ preventScroll: true })
                    changeOpen(false)
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-default-500 hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  >
                    <path d="m6 6 12 12M6 18 18 6" />
                  </svg>
                </button>
              )}
            </div>
            {content}
          </div>,
          portalContainer
        )}
    </>
  )
}
