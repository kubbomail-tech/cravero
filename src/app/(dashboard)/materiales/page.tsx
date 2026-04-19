'use client'

import { useState, useEffect, useCallback } from 'react'
import { toNumber } from '@/lib/calculations'

type Category = { id: string; name: string; seccion?: string | null }
type Unit = { id: string; code: string; name: string }
type Proveedor = { id: string; name: string }
type Material = {
  id: string
  name: string
  internalCode?: string
  category: Category
  unit: Unit
  proveedor?: Proveedor | null
  unitCost: number
  stock?: number
  isActive: boolean
  notes?: string
}

export default function MaterialesPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | 'bulk' | 'confirm' | null>(null)
  const [selected, setSelected] = useState<Material | null>(null)
  const [form, setForm] = useState<any>({ isActive: true })
  const [bulkForm, setBulkForm] = useState({ name: '', percentage: '', scopeType: 'ALL', categoryId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [bulkResult, setBulkResult] = useState('')

  useEffect(() => {
    fetch('/api/meta').then(r => r.json()).then(d => {
      setCategories(d.categories)
      setUnits(d.units)
      setProveedores(d.proveedores ?? [])
    })
  }, [])

  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    let url = `/api/materials?search=${encodeURIComponent(search)}`
    if (!showInactive) url += '&isActive=true'
    if (filterCategory) url += `&categoryId=${filterCategory}`
    const res = await fetch(url)
    const data = await res.json()
    setMaterials(data)
    setLoading(false)
  }, [search, filterCategory, showInactive])

  useEffect(() => {
    const t = setTimeout(fetchMaterials, 300)
    return () => clearTimeout(t)
  }, [fetchMaterials])

  function openCreate() {
    setForm({ isActive: true, unitCost: 0 })
    setError('')
    setModal('create')
  }

  function openEdit(m: Material) {
    setSelected(m)
    setForm({
      ...m,
      categoryId: m.category.id,
      unitId: m.unit.id,
      proveedorId: m.proveedor?.id ?? '',
      unitCost: toNumber(m.unitCost)
    })
    setError('')
    setModal('edit')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const isEdit = modal === 'edit'
      const url = isEdit ? `/api/materials/${selected!.id}` : '/api/materials'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(JSON.stringify(d.error?.fieldErrors ?? d.error ?? 'Error'))
        return
      }
      setModal(null)
      fetchMaterials()
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkUpdate() {
    setSaving(true)
    setError('')
    setBulkResult('')
    try {
      const res = await fetch('/api/materials/bulk-price-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkForm),
      })
      const d = await res.json()
      if (!res.ok) {
        setError('Error al actualizar precios')
        return
      }
      setBulkResult(`Se actualizaron ${d.updatedCount} materiales con +${bulkForm.percentage}%`)
      fetchMaterials()
    } finally {
      setSaving(false)
    }
  }

  const askDeactivate = (m: Material) => {
    setSelected(m)
    setModal('confirm')
  }

  async function confirmDeactivate() {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/materials/${selected.id}`, { method: 'DELETE' })
    setModal(null)
    setSaving(false)
    fetchMaterials()
  }

  async function handleActivate(id: string) {
    await fetch(`/api/materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    fetchMaterials()
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Materiales</h1>
          <p className="page-subtitle">Insumos y costos del sistema</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => { setBulkResult(''); setBulkForm({ name: '', percentage: '', scopeType: 'ALL', categoryId: '' }); setModal('bulk') }}>
            Actualización masiva
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusIcon /> Nuevo material
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
          <SearchIcon />
          <input placeholder="Buscar por nombre o código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 200 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Código</th>
              <th>Categoría</th>
              <th>Proveedor</th>
              <th>Unidad</th>
              <th>Costo unitario</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
            ) : materials.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state">
                  <p>No se encontraron materiales</p>
                  <button className="btn btn-secondary btn-sm" onClick={openCreate}>Agregar material</button>
                </div>
              </td></tr>
            ) : materials.map(m => (
              <tr key={m.id} style={!m.isActive ? { opacity: 0.45 } : undefined}>
                <td style={{ fontWeight: 500 }}>
                  {m.name}
                  {!m.isActive && <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>Inactivo</span>}
                </td>
                <td><span className="badge badge-gray">{m.internalCode ?? '—'}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{m.category.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{m.proveedor?.name ?? <span style={{ opacity: 0.45 }}>—</span>}</td>
                <td><span className="badge badge-teal">{m.unit.code}</span></td>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(toNumber(m.unitCost))}</td>
                <td>
                  <div className="flex gap-1">
                    {m.isActive ? (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>
                          <EditIcon /> Editar
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => askDeactivate(m)}>
                          <TrashIcon />
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleActivate(m.id)}>
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

      {/* Material modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Nuevo material' : 'Editar material'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" placeholder="Ej: Melamina Blanca 18mm" value={form.name ?? ''} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Código interno</label>
                  <input className="form-input" placeholder="BIS-001" value={form.internalCode ?? ''} onChange={e => setForm({...form, internalCode: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select className="form-select" value={form.categoryId ?? ''} onChange={e => setForm({...form, categoryId: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proveedor / Marca</label>
                  <select className="form-select" value={form.proveedorId ?? ''} onChange={e => setForm({...form, proveedorId: e.target.value || undefined})}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad *</label>
                  <select className="form-select" value={form.unitId ?? ''} onChange={e => setForm({...form, unitId: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Costo unitario ($) *</label>
                  <input className="form-input" type="number" step="0.01" value={form.unitCost ?? ''} onChange={e => setForm({...form, unitCost: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Observaciones</label>
                  <textarea className="form-textarea" value={form.notes ?? ''} onChange={e => setForm({...form, notes: e.target.value})} />
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

      {/* Confirm deactivate modal */}
      {modal === 'confirm' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Desactivar material</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
                El material <strong style={{ color: 'var(--text)' }}>{selected?.name}</strong> quedará inactivo y no estará disponible para nuevos presupuestos.
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

      {/* Bulk update modal */}
      {modal === 'bulk' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Actualización masiva de precios</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {error && <div className="alert alert-error">{error}</div>}
              {bulkResult && <div className="alert alert-success">{bulkResult}</div>}
              <div className="form-group">
                <label className="form-label">Nombre del lote *</label>
                <input className="form-input" placeholder="Ej: Aumento Abril 2026" value={bulkForm.name} onChange={e => setBulkForm({...bulkForm, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Porcentaje de aumento (%) *</label>
                <input className="form-input" type="number" step="0.1" placeholder="Ej: 15" value={bulkForm.percentage} onChange={e => setBulkForm({...bulkForm, percentage: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Alcance</label>
                <select className="form-select" value={bulkForm.scopeType} onChange={e => setBulkForm({...bulkForm, scopeType: e.target.value})}>
                  <option value="ALL">Todos los materiales</option>
                  <option value="CATEGORY">Por categoría</option>
                </select>
              </div>
              {bulkForm.scopeType === 'CATEGORY' && (
                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select className="form-select" value={bulkForm.categoryId} onChange={e => setBulkForm({...bulkForm, categoryId: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Esta acción actualizará los precios vigentes. Los presupuestos ya generados no se verán afectados.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleBulkUpdate} disabled={saving || !!bulkResult}>
                {saving ? 'Actualizando...' : 'Aplicar aumento'}
              </button>
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
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> }
