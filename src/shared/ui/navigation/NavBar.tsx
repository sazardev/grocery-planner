import { Fragment, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './NavBar.module.css'

export interface NavItem {
  key: string
  label: string
  icon: ReactNode
  href?: string
  onClick?: () => void
  active?: boolean
  badge?: number
}

export interface NavBarProps {
  items: NavItem[]
  label?: string
  renderLink?: (
    item: NavItem,
    className: string,
    content: ReactNode,
    innerRef?: (el: HTMLElement | null) => void,
  ) => ReactNode
  className?: string
}

export default function NavBar({
  items,
  label = 'Navegación principal',
  renderLink,
  className,
}: NavBarProps) {
  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const [pill, setPill] = useState<{ x: number; width: number; ready: boolean }>({
    x: 0,
    width: 0,
    ready: false,
  })

  useEffect(() => {
    const active = items.find((item) => item.active)
    const nav = navRef.current
    const el = active ? itemRefs.current[active.key] : null

    const update = () => {
      if (!nav || !el) {
        setPill((p) => ({ ...p, ready: false }))
        return
      }
      const navRect = nav.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      setPill({
        x: elRect.left - navRect.left,
        width: elRect.width,
        ready: true,
      })
    }

    update()
    const ro = new ResizeObserver(update)
    if (nav) ro.observe(nav)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [items])

  const classes = [styles.nav, className ?? ''].filter(Boolean).join(' ')

  return (
    <nav ref={navRef} className={classes} aria-label={label}>
      <span
        className={`${styles.pill} ${pill.ready ? styles.pillReady : ''}`}
        style={
          pill.ready
            ? { width: pill.width, transform: `translateX(${pill.x}px)` }
            : undefined
        }
        aria-hidden="true"
      />
      {items.map((item) => {
        const itemClass = [styles.item, item.active ? styles.active : '']
          .filter(Boolean)
          .join(' ')

        const content = (
          <>
            <span className={styles.icon}>
              {item.icon}
              {item.badge ? (
                <span className={styles.badge}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </span>
            <span className={styles.label}>{item.label}</span>
          </>
        )

        const inner = (el: HTMLElement | null) => {
          itemRefs.current[item.key] = el
        }

        if (renderLink) {
          return (
            <Fragment key={item.key}>
              {renderLink(item, itemClass, content, inner)}
            </Fragment>
          )
        }

        if (item.href) {
          return (
            <a
              key={item.key}
              ref={inner}
              href={item.href}
              className={itemClass}
              aria-current={item.active ? 'page' : undefined}
            >
              {content}
            </a>
          )
        }

        return (
          <button
            key={item.key}
            ref={inner}
            type="button"
            className={itemClass}
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
          >
            {content}
          </button>
        )
      })}
    </nav>
  )
}
