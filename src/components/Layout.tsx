import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Home, ShoppingCart, MessageCircle, UserRound, Users, Settings, Settings2 } from 'lucide-react'
import { getUnreadMentions, getUnreadNotifications } from '../lib/api'
import { ME } from '../lib/me'
import NavBar from '../shared/ui/navigation/NavBar.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import type { NavItem } from '../shared/ui/navigation/NavBar.tsx'
import styles from './Layout.module.css'

interface LayoutItem extends NavItem {
  to: string
}

const navItems: LayoutItem[] = [
  { key: 'inicio', to: '/', label: 'Inicio', icon: <Home size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'mandado', to: '/trips', label: 'Mandado', icon: <ShoppingCart size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'chat', to: '/chat', label: 'Chat', icon: <MessageCircle size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'mio', to: '/mine', label: 'Lo mío', icon: <UserRound size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'familia', to: '/family', label: 'Familia', icon: <Users size={22} strokeWidth={2} aria-hidden="true" /> },
  { key: 'ajustes', to: '/settings', label: 'Ajustes', icon: <Settings size={22} strokeWidth={2} aria-hidden="true" /> },
]

export default function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const unread = useQuery({
    queryKey: ['notif-unread'],
    queryFn: () => getUnreadNotifications(ME),
    refetchInterval: 20_000,
    retry: false,
  })

  const mentions = useQuery({
    queryKey: ['notif-mentions'],
    queryFn: () => getUnreadMentions(ME),
    refetchInterval: 10_000,
    retry: false,
  })

  return (
    <div className={styles.app}>
      <header className={styles.appbar}>
        <Link to="/" className={styles.brand} aria-label="Ir al inicio">
          <span className={styles.brandMark} aria-hidden="true">
            <ShoppingCart size={18} strokeWidth={2.5} />
          </span>
          <span className={styles.brandName}>Grocery Planner</span>
        </Link>
        <IconButton label="Reglas de la familia" onClick={() => navigate('/rules')}>
          <Settings2 size={20} strokeWidth={2} aria-hidden="true" />
        </IconButton>
      </header>
      <main
        key={pathname}
        className={`${styles.content} ${pathname === '/chat' ? styles.contentChat : ''}`}
      >
        <Outlet />
      </main>
      <NavBar
        items={navItems.map((item) => ({
          ...item,
          active:
            item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/'),
          badge:
            item.key === 'chat'
              ? (mentions.data ?? 0)
              : item.key === 'familia'
                ? (unread.data ?? 0)
                : undefined,
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
