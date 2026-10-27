'use client'

import { useId, useLayoutEffect, useRef, useState } from 'react'
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
}: {
  title: string
  children: ReactNode
  content: ReactNode
  className?: string
  icon?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)
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
        setOpen(false)
    }, 160)
  }
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      if (!trigger.current || !card.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const { width, height } = card.current.getBoundingClientRect()
      const below = window.innerHeight - anchor.bottom - 12
      const top =
        below >= height || anchor.top < below
          ? anchor.bottom + 8
          : anchor.top - height - 8
      setPosition({
        top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
        left: Math.max(
          12,
          Math.min(anchor.left, window.innerWidth - width - 12)
        ),
      })
    }
    function outside(event: PointerEvent) {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !card.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (card.current?.contains(document.activeElement))
          trigger.current?.focus({ preventScroll: true })
        setOpen(false)
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
  }, [open])
  const blur = (next: EventTarget | null) => {
    if (
      !trigger.current?.contains(next as Node) &&
      !card.current?.contains(next as Node)
    )
      setOpen(false)
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
                cancelClose()
                setOpen(true)
              }
        }
        onMouseLeave={icon ? undefined : closeLater}
        onFocus={
          icon
            ? undefined
            : () => {
                cancelClose()
                setOpen(true)
              }
        }
        onBlur={(event) => blur(event.relatedTarget)}
        onClick={(event) => {
          event.stopPropagation()
          cancelClose()
          setOpen((previous) => (icon ? !previous : true))
        }}
        onKeyDown={(event) => {
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
        createPortal(
          <div
            ref={card}
            id={id}
            role="dialog"
            tabIndex={-1}
            aria-label={title}
            onMouseEnter={icon ? undefined : cancelClose}
            onMouseLeave={icon ? undefined : closeLater}
            onFocusCapture={cancelClose}
            onBlur={(event) => blur(event.relatedTarget)}
            className="fixed z-[100] w-96 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] space-y-3 overflow-auto rounded-lg border border-default-300 bg-content1 p-4 text-sm font-normal text-foreground shadow-xl"
            style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
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
                    setOpen(false)
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
          document.body
        )}
    </>
  )
}
