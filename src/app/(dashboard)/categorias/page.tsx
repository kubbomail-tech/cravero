'use client'

import { useState, useEffect, useCallback } from 'react'

type Categoria = {
  id: string
  name: string
  description?: string
  seccion: 'CORTES' | 'CANTO' | 'HERRAJES' | null
}

const SECCIONES = [
  { value: 'CORTES', label: 'Cortes', color: 'badge-blue' },
  { value: 'CANTO', label: 'Canto', color: 'badge-teal' },
  { value: 'HERRAJES', label: 'Herrajes', color: 'badge-yellow' },
]

function SeccionBadge({ seccion }: { seccion: Categoria['seccion'] }) {
  if (!seccion) return <span className="badge badge-gray">Sin sección</span>
  const s = SECCIONES.find(s => s.value === seccion)
  return <span className={`badge ${s?.color ?? 'badge-gray'}`}>{s?.label ?? seccion}</span>
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [search, setSearch] = useState('')
  const [filterSeccion, setFilterSeccion] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | 'confirm' | null>(null)
  const [selected, setSelected] = useState<Categoria | null>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchCategorias = useCallback(async () => {
    setLoading(true)
    let url = `/api/categorias?search=${encodeURIComponent(search)}`
    if (filterSeccion) url += `&seccion=${filterSeccion}`
    const res = await fetch(url)
    const data = await res.json()
    setCategorias(data)
    setLoading(false)
  }, [search, filterSeccion])

  useEffect(() => {
    const t = setTimeout(fetchCategorias, 300)
    return () => clearTimeout(t)
  }, [fetchCategorias])

  function openCreate() {
    setForm({})
    setError('')
    setModal('create')
  }

  function openEdit(c: Categoria) {
    setSelected(c)
    setForm({ ...c })
    setError('')
    setModal('edit')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const isEdit = modal === 'edit'
      const url = isEdit ? `/api/categorias/${selected!.id}` : '/api/categorias'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        const fieldErrors = d.error?.fieldErrors ?? {}
        const messages: Record<string, string> = {
          name: 'El nombre es requerido',
          seccion: 'Seleccioná una sección (Cortes, Canto o Herrajes)',
        }
        const found = Object.keys(fieldErrors).map(k => messages[k] ?? fieldErrors[k]?.[0]).filter(Boolean)
        setError(found.length ? found.join(' · ') : (d.error ?? 'Error al guardar'))
        return
      }
      setModal(null)
      fetchCategorias()
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/categorias/${selected.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'No se puede eliminar')
      setSaving(false)
      return
    }
    setModal(null)
    setSaving(false)
    fetchCategorias()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Categorías de materiales por sección de presupuesto</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <PlusIcon /> Nueva categoría
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <SearchIcon />
          <input placeholder="Buscar categoría..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 180 }} value={filterSeccion} onChange={e => setFilterSeccion(e.target.value)}>
          <option value="">Todas las secciones</option>
          {SECCIONES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Sección</th>
              <th>Descripción</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : categorias.length === 0 ? (
              <tr><td colSpan={4}>
                <div className="empty-state">
                  <p>No se encontraron categorías</p>
                  <button className="btn btn-secondary btn-sm" onClick={openCreate}>Agregar categoría</button>
                </div>
              </td></tr>
            ) : categorias.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td><SeccionBadge seccion={c.seccion} /></td>
                <td style={{ color: 'var(--text-muted)' }}>{c.description ?? '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      <EditIcon /> Editar
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setSelected(c); setError(''); setModal('confirm') }}>
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
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" placeholder="Ej: Melaminas, Cantos PVC..." value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Sección del presupuesto *</label>
                <select className="form-select" value={form.seccion ?? ''} onChange={e => setForm({ ...form, seccion: e.target.value })}>
                  <option value="">Seleccionar sección...</option>
                  {SECCIONES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Define en qué sección del presupuesto aparecerán los materiales de esta categoría.
                </p>
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
              <h3>Eliminar categoría</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem', textAlign: 'left' }}>{error}</div>}
              {!error && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
                  ¿Eliminar la categoría <strong style={{ color: 'var(--text)' }}>{selected?.name}</strong>? Solo es posible si no tiene materiales asociados.
                </p>
              )}
              <div className="flex gap-3">
                <button className="btn btn-secondary w-full" onClick={() => setModal(null)}>Cancelar</button>
                {!error && (
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
function SearchIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function EditIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> }
