'use client'

import { useState, useEffect, useCallback } from 'react'

type Proveedor = {
  id: string
  name: string
  description?: string
  isActive: boolean
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | 'confirm' | null>(null)
  const [selected, setSelected] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<any>({ isActive: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchProveedores = useCallback(async () => {
    setLoading(true)
    let url = `/api/proveedores?search=${encodeURIComponent(search)}`
    if (!showInactive) url += '&isActive=true'
    const res = await fetch(url)
    const data = await res.json()
    setProveedores(data)
    setLoading(false)
  }, [search, showInactive])

  useEffect(() => {
    const t = setTimeout(fetchProveedores, 300)
    return () => clearTimeout(t)
  }, [fetchProveedores])

  function openCreate() {
    setForm({ isActive: true })
    setError('')
    setModal('create')
  }

  function openEdit(p: Proveedor) {
    setSelected(p)
    setForm({ ...p })
    setError('')
    setModal('edit')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const isEdit = modal === 'edit'
      const url = isEdit ? `/api/proveedores/${selected!.id}` : '/api/proveedores'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        const fieldErrors = d.error?.fieldErrors ?? {}
        const found = Object.values(fieldErrors).flat().filter(Boolean) as string[]
        setError(found.length ? found.join(' · ') : (d.error ?? 'Error al guardar'))
        return
      }
      setModal(null)
      fetchProveedores()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeactivate() {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/proveedores/${selected.id}`, { method: 'DELETE' })
    setModal(null)
    setSaving(false)
    fetchProveedores()
  }

  async function handleActivate(id: string) {
    await fetch(`/api/proveedores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    fetchProveedores()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores / Marcas</h1>
          <p className="page-subtitle">Proveedores y marcas de materiales</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <PlusIcon /> Nuevo proveedor
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <SearchIcon />
          <input placeholder="Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : proveedores.length === 0 ? (
              <tr><td colSpan={4}>
                <div className="empty-state">
                  <p>No se encontraron proveedores</p>
                  <button className="btn btn-secondary btn-sm" onClick={openCreate}>Agregar proveedor</button>
                </div>
              </td></tr>
            ) : proveedores.map(p => (
              <tr key={p.id} style={!p.isActive ? { opacity: 0.45 } : undefined}>
                <td style={{ fontWeight: 500 }}>
                  {p.name}
                  {!p.isActive && <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>Inactivo</span>}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{p.description ?? '—'}</td>
                <td>
                  <span className={`badge ${p.isActive ? 'badge-teal' : 'badge-gray'}`}>
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    {p.isActive ? (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                          <EditIcon /> Editar
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setSelected(p); setModal('confirm') }}>
                          <TrashIcon />
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleActivate(p.id)}>
                        Activar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" placeholder="Ej: Faplac, Arauco..." value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-textarea" rows={2} placeholder="Descripción opcional..." value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
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

      {modal === 'confirm' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Desactivar proveedor</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
                El proveedor <strong style={{ color: 'var(--text)' }}>{selected?.name}</strong> quedará inactivo.
              </p>
              <div className="flex gap-3">
                <button className="btn btn-secondary w-full" onClick={() => setModal(null)}>Cancelar</button>
                <button className="btn btn-danger w-full" onClick={confirmDeactivate} disabled={saving}>
                  {saving ? 'Procesando...' : 'Desactivar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function SearchIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> }
