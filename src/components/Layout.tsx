import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, CalendarClock, CalendarDays, Settings } from 'lucide-react'
import NavBar from '../shared/ui/navigation/NavBar.tsx'
import type { NavItem } from '../shared/ui/navigation/NavBar.tsx'
import styles from './Layout.module.css'

interface LayoutItem extends NavItem {
  to: string
}

const navItems: LayoutItem[] = [
  { key: 'inicio', to: '/', label: 'Inicio', icon: <Home size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'mandado', to: '/trips', label: 'Mandado', icon: <ShoppingCart size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'plan', to: '/plans', label: 'Plan', icon: <CalendarClock size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'eventos', to: '/events', label: 'Eventos', icon: <CalendarDays size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'ajustes', to: '/settings', label: 'Ajustes', icon: <Settings size={22} strokeWidth={2} aria-hidden="true" /> },
]

export default function Layout() {
  const { pathname } = useLocation()

  return (
    <div className={styles.app}>
      <main key={pathname} className={styles.content}>
        <Outlet />
      </main>
      <NavBar
        items={navItems.map((item) => ({
          ...item,
          active: pathname === item.to,
        }))}
        renderLink={(item, className, content, innerRef) => {
          const target = navItems.find((n) => n.key === item.key)!
          return (
            <NavLink key={item.key} to={target.to} className={className} ref={innerRef}>
              {content}
            </NavLink>
          )
        }}
      />
    </div>
  )
}
