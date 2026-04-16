'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Quote = {
  id: string
  quoteNumber: string
  status: string
  issueDate: string
  expirationDate?: string
  totalAmount: number
  client: { id: string; fullName: string; businessName?: string }
}

const statusMap: Record<string, string> = {
  DRAFT: 'Borrador', ISSUED: 'Emitido', APPROVED: 'Aprobado', REJECTED: 'Rechazado', EXPIRED: 'Vencido',
}
const statusBadge: Record<string, string> = {
  DRAFT: 'badge-gray', ISSUED: 'badge-blue', APPROVED: 'badge-green', REJECTED: 'badge-red', EXPIRED: 'badge-yellow',
}

export default function PresupuestosPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    let url = `/api/quotes?search=${encodeURIComponent(search)}`
    if (filterStatus) url += `&status=${filterStatus}`
    const res = await fetch(url)
    const data = await res.json()
    setQuotes(data)
    setLoading(false)
  }, [search, filterStatus])

  useEffect(() => {
    const t = setTimeout(fetchQuotes, 300)
    return () => clearTimeout(t)
  }, [fetchQuotes])

  async function handleDelete(id: string) {
    setRemovingId(id)
    try {
      await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      setDeletingId(null)
      fetchQuotes()
    } finally { setRemovingId(null) }
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/quotes/${id}/duplicate`, { method: 'POST' })
    const d = await res.json()
    router.push(`/presupuestos/${d.id}`)
  }

  async function handleChangeStatus(id: string, status: string) {
    await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchQuotes()
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-AR')

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Presupuestos</h1>
          <p className="page-subtitle">Historial y gestión de presupuestos</p>
        </div>
        <Link href="/presupuestos/nuevo" className="btn btn-primary">
          <PlusIcon /> Nuevo presupuesto
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <SearchIcon />
          <input placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Emisión</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <p>No se encontraron presupuestos</p>
                  <Link href="/presupuestos/nuevo" className="btn btn-secondary btn-sm">Crear presupuesto</Link>
                </div>
              </td></tr>
            ) : quotes.map(q => (
              <tr key={q.id}>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>{q.quoteNumber}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{q.client.fullName}</div>
                  {q.client.businessName && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{q.client.businessName}</div>}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  <div>{fmtDate(q.issueDate)}</div>
                  {q.expirationDate && <div style={{ fontSize: '0.75rem' }}>Vence: {fmtDate(q.expirationDate)}</div>}
                </td>
                <td style={{ fontWeight: 600 }}>{fmt(parseFloat(String(q.totalAmount)))}</td>
                <td><span className={`badge ${statusBadge[q.status]}`}>{statusMap[q.status]}</span></td>
                <td>
                  <div className="flex gap-1">
                    <Link href={`/presupuestos/${q.id}`} className="btn btn-ghost btn-sm">Ver</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(q.id)} title="Duplicar">
                      <CopyIcon />
                    </button>
                    {q.status === 'DRAFT' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleChangeStatus(q.id, 'ISSUED')}>Emitir</button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)', opacity: 0.6 }}
                      onClick={() => setDeletingId(q.id)}
                      title="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar presupuesto</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeletingId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Estás por eliminar el presupuesto <strong style={{ color: 'var(--text)' }}>{quotes.find(q => q.id === deletingId)?.quoteNumber}</strong>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button className="btn btn-secondary w-full" onClick={() => setDeletingId(null)}>Cancelar</button>
                <button
                  className="btn btn-danger w-full"
                  onClick={() => handleDelete(deletingId)}
                  disabled={removingId === deletingId}
                >
                  {removingId === deletingId ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg> }
function CopyIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> }
