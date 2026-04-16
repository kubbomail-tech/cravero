import { auth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-subtle)', fontWeight: 500 }}>
            Cravero Muebles
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
              {session?.user?.name?.charAt(0).toUpperCase() ?? 'A'}
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
                {session?.user?.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {(session?.user as any)?.role === 'ADMIN' ? 'Administrador' : 'Operador'}
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
