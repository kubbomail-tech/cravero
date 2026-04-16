'use client'

import { useState, useEffect, useCallback } from 'react'

type FurnitureType = { id: string; name: string; description?: string; isActive: boolean }

export default function TiposMueblesPage() {
  const [types, setTypes] = useState<FurnitureType[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<FurnitureType | null>(null)
  const [form, setForm] = useState<any>({ isActive: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchTypes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/furniture-types')
    const data = await res.json()
    setTypes(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTypes() }, [fetchTypes])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const url = modal === 'edit' ? `/api/furniture-types/${selected!.id}` : '/api/furniture-types'
      const method = modal === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setError('Error al guardar'); return }
      setModal(null)
      fetchTypes()
    } finally { setSaving(false) }
  }

  const openEdit = (t: FurnitureType) => {
    setSelected(t)
    setForm({ ...t })
    setError('')
    setModal('edit')
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tipos de mueble</h1>
          <p className="page-subtitle">Categorías disponibles para los presupuestos</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ isActive: true }); setError(''); setModal('create') }}>
          <PlusIcon /> Nuevo tipo
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : types.length === 0 ? (
        <div className="empty-state">
          <p>No hay tipos de mueble configurados.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal('create')}>Crear el primero</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {types.map(t => (
            <div
              key={t.id}
              className="card"
              style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem', position: 'relative' }}
            >
              <button
                onClick={() => openEdit(t)}
                style={{
                  position: 'absolute', top: '0.625rem', right: '0.625rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-subtle)', padding: '0.25rem', borderRadius: '0.375rem',
                }}
                title="Editar"
              >
                <EditIcon />
              </button>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--primary-50)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
              }}>
                <FurnitureIcon size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9375rem', color: 'var(--text)' }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.4 }}>{t.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo tipo de mueble' : 'Editar tipo'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Bajo mesada, Alacena..."
                    value={form.name ?? ''}
                    onChange={e => setForm({...form, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <input
                    className="form-input"
                    placeholder="Descripción breve (opcional)"
                    value={form.description ?? ''}
                    onChange={e => setForm({...form, description: e.target.value})}
                  />
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

function PlusIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function EditIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function FurnitureIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M2 13h20" />
      <path d="M8 7V3" />
      <path d="M16 7V3" />
    </svg>
  )
}
