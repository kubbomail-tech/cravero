'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Client = {
  id: string
  fullName: string
  businessName?: string
  phone?: string
  email?: string
  city?: string
  province?: string
  isActive: boolean
  _count: { quotes: number }
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Client | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clients?search=${encodeURIComponent(search)}&isActive=true`)
    const data = await res.json()
    setClients(data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchClients, 300)
    return () => clearTimeout(t)
  }, [fetchClients])

  function openCreate() {
    setForm({ isActive: true })
    setError('')
    setModal('create')
  }

  function openEdit(c: Client) {
    setSelected(c)
    setForm({ ...c })
    setError('')
    setModal('edit')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const url = modal === 'edit' ? `/api/clients/${selected!.id}` : '/api/clients'
      const method = modal === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error?.formErrors?.[0] ?? 'Error al guardar')
        return
      }
      setModal(null)
      fetchClients()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm('¿Desactivar este cliente?')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    fetchClients()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Gestión de clientes del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <PlusIcon /> Nuevo cliente
        </button>
      </div>

      <div className="search-bar" style={{ maxWidth: 380, marginBottom: '1.25rem' }}>
        <SearchIcon />
        <input
          placeholder="Buscar por nombre, email, teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Ubicación</th>
              <th>Presupuestos</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="empty-state">
                  <p>No se encontraron clientes</p>
                  <button className="btn btn-secondary btn-sm" onClick={openCreate}>Agregar cliente</button>
                </div>
              </td></tr>
            ) : clients.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.fullName}</div>
                  {c.businessName && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.businessName}</div>}
                </td>
                <td>
                  <div>{c.phone ?? '—'}</div>
                  {c.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.email}</div>}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {[c.city, c.province].filter(Boolean).join(', ') || '—'}
                </td>
                <td>
                  <span className="badge badge-teal">{c._count.quotes} presupuestos</span>
                </td>
                <td>
                  <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                    <Link href={`/clientes/${c.id}`} className="btn btn-ghost btn-sm">Ver ficha</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Editar</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', opacity: 0.6 }} onClick={() => handleDeactivate(c.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input className="form-input" placeholder="Nombre completo" value={form.fullName ?? ''} onChange={e => setForm({...form, fullName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Razón social</label>
                  <input className="form-input" placeholder="Opcional" value={form.businessName ?? ''} onChange={e => setForm({...form, businessName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" placeholder="+54..." value={form.phone ?? ''} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" placeholder="email@ejemplo.com" value={form.email ?? ''} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Localidad</label>
                  <input className="form-input" placeholder="Ciudad" value={form.city ?? ''} onChange={e => setForm({...form, city: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Provincia</label>
                  <input className="form-input" placeholder="Provincia" value={form.province ?? ''} onChange={e => setForm({...form, province: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function TrashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> }
