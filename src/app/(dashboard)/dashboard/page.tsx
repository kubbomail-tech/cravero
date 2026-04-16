import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { formatCurrency } from '@/lib/calculations'

export default async function DashboardPage() {
  const session = await auth()

  const [totalClientes, totalMateriales, totalPresupuestos, ultimosPresupuestos] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.material.count({ where: { isActive: true } }),
    prisma.quote.count(),
    prisma.quote.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { client: true },
    }),
  ])

  const presupuestosPorEstado = await prisma.quote.groupBy({
    by: ['status'],
    _count: true,
  })

  const statusMap: Record<string, string> = {
    DRAFT: 'Borrador',
    ISSUED: 'Emitido',
    APPROVED: 'Aprobado',
    REJECTED: 'Rechazado',
    EXPIRED: 'Vencido',
  }

  const statusBadge: Record<string, string> = {
    DRAFT: 'badge-gray',
    ISSUED: 'badge-blue',
    APPROVED: 'badge-green',
    REJECTED: 'badge-red',
    EXPIRED: 'badge-yellow',
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hola, {session?.user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Resumen del sistema de presupuestación</p>
        </div>
        <Link href="/presupuestos/nuevo" className="btn btn-primary">
          <PlusIcon /> Nuevo presupuesto
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-100)' }}>
            <DocumentIcon />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalPresupuestos}</div>
            <div className="stat-label">Presupuestos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ebf8ff' }}>
            <UsersIcon />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalClientes}</div>
            <div className="stat-label">Clientes activos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fff4' }}>
            <CubeIcon />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalMateriales}</div>
            <div className="stat-label">Materiales</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fffbeb' }}>
            <CheckIcon />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {presupuestosPorEstado.find(p => p.status === 'APPROVED')?._count ?? 0}
            </div>
            <div className="stat-label">Aprobados</div>
          </div>
        </div>
      </div>

      <div className="grid-cols-2" style={{ alignItems: 'start' }}>
        {/* Últimos presupuestos */}
        <div className="card">
          <div className="card-header">
            <h2>Últimos presupuestos</h2>
            <Link href="/presupuestos" className="btn btn-ghost btn-sm">Ver todos</Link>
          </div>
          {ultimosPresupuestos.length === 0 ? (
            <div className="empty-state">
              <DocumentIcon />
              <p>No hay presupuestos aún</p>
            </div>
          ) : (
            <div style={{ padding: '0.5rem 0' }}>
              {ultimosPresupuestos.map(q => (
                <Link
                  key={q.id}
                  href={`/presupuestos/${q.id}`}
                  className="dashboard-quote-row"
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)' }}>{q.quoteNumber}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.client.fullName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{formatCurrency(q.totalAmount)}</div>
                    <span className={`badge ${statusBadge[q.status]}`}>{statusMap[q.status]}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Estado de presupuestos */}
        <div className="card">
          <div className="card-header">
            <h2>Estado de presupuestos</h2>
          </div>
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(statusMap).map(([key, label]) => {
              const count = presupuestosPorEstado.find(p => p.status === key)?._count ?? 0
              const total = totalPresupuestos || 1
              const pct = Math.round((count / total) * 100)
              const barColors: Record<string, string> = {
                DRAFT: '#94a3b8', ISSUED: '#3b82f6', APPROVED: '#22c55e',
                REJECTED: '#ef4444', EXPIRED: '#f59e0b',
              }
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span className={`badge ${statusBadge[key]}`}>{label}</span>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text)' }}>{count}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border-light)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColors[key] ?? 'var(--primary)', borderRadius: 999 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function DocumentIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#198e85" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function UsersIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3182ce" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function CubeIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38a169" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
}
function CheckIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
