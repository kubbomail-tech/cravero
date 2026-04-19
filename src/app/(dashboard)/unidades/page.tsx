'use client'

import { useState, useEffect, useCallback } from 'react'

type Unit = { id: string; code: string; name: string }

const UNIDADES_DEFAULT = [
  { code: 'M2', name: 'Metro cuadrado' },
  { code: 'ML', name: 'Metro lineal' },
  { code: 'UNIT', name: 'Unidad' },
  { code: 'SET', name: 'Juego' },
  { code: 'PACK', name: 'Paquete' },
]

export default function UnidadesPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | 'confirm' | null>(null)
  const [selected, setSelected] = useState<Unit | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/unidades')
    const data = await res.json()
    setUnits(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUnits() }, [fetchUnits])

  async function seedDefaults() {
    setSaving(true)
    await Promise.all(
      UNIDADES_DEFAULT.map(u =>
        fetch('/api/unidades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u),
        })
      )
    )
    setSaving(false)
    fetchUnits()
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const isEdit = modal === 'edit'
      const url = isEdit ? `/api/unidades/${selected!.id}` : '/api/unidades'
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
      fetchUnits()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!selected) return
    setSaving(true)
    setDeleteError('')
    const res = await fetch(`/api/unidades/${selected.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setDeleteError(d.error ?? 'No se puede eliminar')
      setSaving(false)
      return
    }
    setModal(null)
    setSaving(false)
    fetchUnits()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Unidades de medida</h1>
          <p className="page-subtitle">Unidades usadas en materiales (M2, ML, UNIT...)</p>
        </div>
        <div className="flex gap-2">
          {units.length === 0 && !loading && (
            <button className="btn btn-secondary" onClick={seedDefaults} disabled={saving}>
              Cargar unidades por defecto
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('create') }}>
            <PlusIcon /> Nueva unidad
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : units.length === 0 ? (
              <tr><td colSpan={3}>
                <div className="empty-state">
                  <p>No hay unidades cargadas</p>
                  <button className="btn btn-secondary btn-sm" onClick={seedDefaults} disabled={saving}>
                    {saving ? 'Cargando...' : 'Cargar M2, ML, UNIT, SET, PACK'}
                  </button>
                </div>
              </td></tr>
            ) : units.map(u => (
              <tr key={u.id}>
                <td><span className="badge badge-teal">{u.code}</span></td>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(u); setForm({ ...u }); setError(''); setModal('edit') }}>
                      <EditIcon /> Editar
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setSelected(u); setDeleteError(''); setModal('confirm') }}>
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nueva unidad' : 'Editar unidad'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Código *</label>
                <input className="form-input" placeholder="Ej: M2, ML, UNIT" value={form.code ?? ''} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Máximo 10 caracteres, en mayúsculas.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" placeholder="Ej: Metro cuadrado" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
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
              <h3>Eliminar unidad</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              {deleteError && <div className="alert alert-error" style={{ marginBottom: '1rem', textAlign: 'left' }}>{deleteError}</div>}
              {!deleteError && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
                  ¿Eliminar la unidad <strong style={{ color: 'var(--text)' }}>{selected?.code} — {selected?.name}</strong>? Solo es posible si no tiene materiales asociados.
                </p>
              )}
              <div className="flex gap-3">
                <button className="btn btn-secondary w-full" onClick={() => setModal(null)}>Cancelar</button>
                {!deleteError && (
                  <button className="btn btn-danger w-full" onClick={confirmDelete} disabled={saving}>
                    {saving ? 'Eliminando...' : 'Eliminar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function EditIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> }
