'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({
  children,
  userName,
  userRole,
}: {
  children: React.ReactNode
  userName?: string | null
  userRole?: string | null
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar on navigation
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}
      <div className="main-content">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú"
            >
              <HamburgerIcon />
            </button>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-subtle)', fontWeight: 500 }}>
              Cravero Muebles
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{
              width: 34, height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: '0.8125rem',
              flexShrink: 0,
            }}>
              {userName?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div className="topbar-user-info">
              <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {userName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {userRole === 'ADMIN' ? 'Administrador' : 'Operador'}
              </div>
            </div>
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}
