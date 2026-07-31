'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

type Material = { id: string; name: string; unitCost: number; category?: { seccion?: string | null } }
type Unit = { id: string; code: string; name: string }

const fmt = (n: any) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(String(n)))
const SIDES = [['TOP','Sup'],['BOTTOM','Inf'],['LEFT','Izq'],['RIGHT','Der']] as const

// ── PDF visibility ─────────────────────────────────────────────────────────
type PdfVisibility = 'HIDDEN' | 'DESCRIPTION' | 'DESCRIPTION_AND_PRICE'
const PDF_VIS_OPTIONS: { value: PdfVisibility; label: string }[] = [
  { value: 'HIDDEN', label: 'Oculto' },
  { value: 'DESCRIPTION', label: 'Descripción' },
  { value: 'DESCRIPTION_AND_PRICE', label: 'Desc. + precio' },
]
const pdfVisLabel = (v: string) => PDF_VIS_OPTIONS.find(o => o.value === v)?.label ?? 'Oculto'

function PdfVisibilitySelect({ value, onChange }: { value: PdfVisibility; onChange: (v: PdfVisibility) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {PDF_VIS_OPTIONS.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          style={{ flex: 1, height: '2.25rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '0.75rem', border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
            background: value === opt.value ? 'var(--primary)' : 'white',
            borderColor: value === opt.value ? 'var(--primary)' : 'var(--border)',
            color: value === opt.value ? 'white' : 'var(--text-muted)' }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Combobox ────────────────────────────────────────────────────────────────

function MatCombo({ options, value, onChange, placeholder, section, onCreated }: {
  options: Material[]; value: string; onChange: (id: string) => void; placeholder?: string
  section?: string; onCreated?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find(m => m.id === value)
  const filtered = q ? options.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : options

  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createCost, setCreateCost] = useState('')
  const [createUnitId, setCreateUnitId] = useState('')
  const [units, setUnits] = useState<Unit[]>([])
  const [createSaving, setCreateSaving] = useState(false)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || dropRef.current?.contains(t)) return
      setOpen(false); setQ('')
    }
    if (open) { document.addEventListener('mousedown', handle); setTimeout(() => inputRef.current?.focus(), 10) }
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleOpen() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  async function openCreate() {
    setCreateName(q); setCreateCost(''); setOpen(false); setQ('')
    const data = await fetch('/api/unidades').then(r => r.json())
    setUnits(data)
    if (data.length > 0) setCreateUnitId(data[0].id)
    setCreating(true)
  }

  async function handleCreate() {
    if (!createName || !section || !createUnitId) return
    setCreateSaving(true)
    const cats = await fetch(`/api/categorias?seccion=${section}`).then(r => r.json())
    const cat = cats[0]
    if (!cat) { setCreateSaving(false); return }
    const res = await fetch('/api/materials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createName, unitCost: parseFloat(createCost) || 0, categoryId: cat.id, unitId: createUnitId, isActive: true }),
    })
    const mat = await res.json()
    setCreateSaving(false)
    if (res.ok) { setCreating(false); onChange(mat.id); onCreated?.() }
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button type="button" className="form-select" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }} onClick={handleOpen}>
          <span style={{ color: selected ? undefined : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.name : (placeholder ?? 'Seleccionar…')}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginLeft: 4, opacity: 0.4 }}><path d="M6 9l6 6 6-6"/></svg>
        </button>
        {open && dropPos && (
          <div ref={dropRef} style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
              <input ref={inputRef} style={{ width: '100%', height: '2rem', padding: '0 0.625rem', fontSize: '0.8125rem', color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '0.5rem', outline: 'none', boxSizing: 'border-box' }} placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {value && <button type="button" style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }} onClick={() => { onChange(''); setOpen(false); setQ('') }}>— Ninguno</button>}
              {filtered.length === 0
                ? <p style={{ padding: '0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>Sin resultados</p>
                : filtered.map(m => (
                  <button key={m.id} type="button" style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: m.id === value ? 600 : 400, color: m.id === value ? 'var(--primary)' : 'var(--text)', background: m.id === value ? 'var(--primary-50)' : 'none', border: 'none', cursor: 'pointer', display: 'block' }}
                    onClick={() => { onChange(m.id); setOpen(false); setQ('') }}>{m.name}</button>
                ))}
              {section && (
                <button type="button" onClick={openCreate}
                  style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', borderTop: '1px solid var(--border-light)', cursor: 'pointer', display: 'block' }}>
                  + Crear{q ? ` "${q}"` : ' nuevo'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo material</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" autoFocus value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Nombre del material…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Costo unitario</label>
                  <input type="number" className="form-input" placeholder="0.00" value={createCost} onChange={e => setCreateCost(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad</label>
                  <select className="form-select" value={createUnitId} onChange={e => setCreateUnitId(e.target.value)}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createSaving || !createName || !createUnitId}>
                {createSaving ? 'Guardando…' : 'Crear material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function QuoteItemDetailPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const [ids, setIds] = useState<{ id: string; itemId: string } | null>(null)
  const [item, setItem] = useState<any>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState<'cut' | 'accessory' | 'additional' | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingCutId, setEditingCutId] = useState<string | null>(null)

  const [cutForm, setCutForm] = useState({ description: '', materialId: '', width: 0, height: 0, quantity: 1, edgeBandMaterialId: '', sides: [] as string[], pdfVisibility: 'HIDDEN' as PdfVisibility })
  const [accForm, setAccForm] = useState({ description: '', materialId: '', quantity: 1, pdfVisibility: 'HIDDEN' as PdfVisibility })
  const [addForm, setAddForm] = useState({ description: '', materialId: '', quantity: 1, pdfVisibility: 'DESCRIPTION_AND_PRICE' as PdfVisibility, priceMode: 'calc' as 'calc' | 'fixed', manualPrice: 0 })

  useEffect(() => { params.then(setIds) }, [params])

  const fetchItem = useCallback(async () => {
    if (!ids) return
    setLoading(true)
    const [iRes, mRes] = await Promise.all([
      fetch(`/api/quotes/${ids.id}/items/${ids.itemId}`),
      fetch('/api/materials?isActive=true'),
    ])
    setItem(await iRes.json())
    setMaterials(await mRes.json())
    setLoading(false)
  }, [ids])

  useEffect(() => { fetchItem() }, [fetchItem])

  const placaMats = materials.filter(m => m.category?.seccion === 'CORTES')
  const cantoMats = materials.filter(m => m.category?.seccion === 'CANTO')
  const herrajeMats = materials.filter(m => m.category?.seccion === 'HERRAJES')
  const addMats = materials.filter(m => m.category?.seccion === 'ADICIONALES')

  function openEditCut(cut: any) {
    const sides = (cut.edgeBands ?? []).map((eb: any) => eb.side)
    const edgeBandMaterialId = cut.edgeBands?.[0]?.materialId ?? ''
    setCutForm({ description: cut.description ?? '', materialId: cut.materialId ?? '', width: cut.width, height: cut.height, quantity: cut.quantity, edgeBandMaterialId, sides, pdfVisibility: cut.pdfVisibility ?? 'HIDDEN' })
    setEditingCutId(cut.id)
    setModal('cut')
  }

  async function saveCut() {
    if (!ids) return
    setSaving(true)
    const edgeBands = cutForm.sides.map(side => ({ side, materialId: cutForm.edgeBandMaterialId, quantity: 1 }))
    const url = editingCutId
      ? `/api/quotes/${ids.id}/items/${ids.itemId}/cuts/${editingCutId}`
      : `/api/quotes/${ids.id}/items/${ids.itemId}/cuts`
    const res = await fetch(url, {
      method: editingCutId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cutForm, edgeBands }),
    })
    setSaving(false)
    if (res.ok) { setModal(null); setEditingCutId(null); setCutForm({ description: '', materialId: '', width: 0, height: 0, quantity: 1, edgeBandMaterialId: '', sides: [], pdfVisibility: 'HIDDEN' }); fetchItem() }
  }

  async function saveAcc() {
    if (!ids) return
    setSaving(true)
    const res = await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/accessories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accForm),
    })
    setSaving(false)
    if (res.ok) { setModal(null); setAccForm({ description: '', materialId: '', quantity: 1, pdfVisibility: 'HIDDEN' }); fetchItem() }
  }

  async function saveAdd() {
    if (!ids) return
    setSaving(true)
    const payload = { ...addForm, manualPrice: addForm.priceMode === 'fixed' ? addForm.manualPrice : undefined }
    const res = await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/additionals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { setModal(null); setAddForm({ description: '', materialId: '', quantity: 1, pdfVisibility: 'DESCRIPTION_AND_PRICE', priceMode: 'calc', manualPrice: 0 }); fetchItem() }
  }

  async function deleteCut(cutId: string) {
    if (!ids) return
    await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/cuts/${cutId}`, { method: 'DELETE' })
    fetchItem()
  }

  async function deleteAcc(accId: string) {
    if (!ids) return
    await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/accessories/${accId}`, { method: 'DELETE' })
    fetchItem()
  }

  async function deleteAdd(addId: string) {
    if (!ids) return
    await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/additionals/${addId}`, { method: 'DELETE' })
    fetchItem()
  }

  const toggleSide = (side: string) =>
    setCutForm(f => ({ ...f, sides: f.sides.includes(side) ? f.sides.filter(s => s !== side) : [...f.sides, side] }))

  if (loading && !item) return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>Cargando...</div>
  if (!item) return <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>No encontrado</div>

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={`/presupuestos/${ids?.id}`} className="btn btn-ghost btn-sm">← Volver</Link>
          <div>
            <h1 className="page-title">{item.furnitureType?.name ?? 'Mueble'}</h1>
            {item.description && <p className="page-subtitle">{item.description}</p>}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)' }}>{fmt(item.subtotalTotal)}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Cortes ── */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Cortes y piezas</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('cut')}>+ Agregar corte</button>
          </div>
          <div className="table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table>
              <thead><tr><th>Descripción</th><th>Material</th><th>Ancho</th><th>Alto</th><th>Cant.</th><th>Cantos</th><th>PDF</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {item.cuts.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin cortes</td></tr>
                  : item.cuts.map((cut: any) => {
                    const edgeBandCost = (cut.edgeBands ?? []).reduce((s: number, eb: any) => s + parseFloat(String(eb.subtotalCost)), 0)
                    const cutTotal = parseFloat(String(cut.subtotalCost)) + edgeBandCost
                    return (
                      <tr key={cut.id}>
                        <td style={{ fontWeight: 500 }}>{cut.description ?? '—'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{cut.materialNameSnapshot ?? '—'}</td>
                        <td>{cut.width} mm</td>
                        <td>{cut.height} mm</td>
                        <td>{cut.quantity}</td>
                        <td>{cut.edgeBands?.length ?? 0}</td>
                        <td><span className="badge badge-gray">{pdfVisLabel(cut.pdfVisibility)}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(cutTotal)}</td>
                        <td style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditCut(cut)}>✎</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteCut(cut.id)}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Herrajes ── */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Herrajes y accesorios</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal('accessory')}>+ Agregar herraje</button>
          </div>
          <div className="table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table>
              <thead><tr><th>Descripción</th><th>Material</th><th>Cant.</th><th>PDF</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {item.accessories.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin herrajes</td></tr>
                  : item.accessories.map((acc: any) => (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 500 }}>{acc.description ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{acc.materialNameSnapshot ?? '—'}</td>
                      <td>{acc.quantity}</td>
                      <td><span className="badge badge-gray">{pdfVisLabel(acc.pdfVisibility)}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(acc.subtotalCost)}</td>
                      <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteAcc(acc.id)}>✕</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Adicionales ── */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Adicionales</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal('additional')}>+ Agregar adicional</button>
          </div>
          <div className="table-wrapper" style={{ margin: 0, border: 'none' }}>
            <table>
              <thead><tr><th>Descripción</th><th>Material</th><th>Cant.</th><th>PDF</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {(item.additionals ?? []).length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin adicionales</td></tr>
                  : (item.additionals ?? []).map((add: any) => (
                    <tr key={add.id}>
                      <td style={{ fontWeight: 500 }}>{add.description ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{add.materialNameSnapshot ?? '—'}</td>
                      <td>{add.quantity}</td>
                      <td><span className="badge badge-gray">{pdfVisLabel(add.pdfVisibility)}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(add.subtotalCost)}</td>
                      <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteAdd(add.id)}>✕</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modal Corte ── */}
      {modal === 'cut' && (
        <div className="modal-overlay" onClick={() => { setModal(null); setEditingCutId(null) }}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingCutId ? 'Editar corte' : 'Agregar corte'}</h3><button className="btn btn-ghost btn-sm" onClick={() => { setModal(null); setEditingCutId(null) }}>×</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" placeholder="Ej: Lateral izquierdo…" value={cutForm.description} onChange={e => setCutForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Material / Placa</label>
                <MatCombo options={placaMats} value={cutForm.materialId} onChange={v => setCutForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar placa…" section="CORTES" onCreated={fetchItem} />
              </div>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Ancho (mm)</label>
                  <input type="number" className="form-input" value={cutForm.width || ''} onChange={e => setCutForm(f => ({ ...f, width: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Alto (mm)</label>
                  <input type="number" className="form-input" value={cutForm.height || ''} onChange={e => setCutForm(f => ({ ...f, height: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cantidad</label>
                  <input type="number" min={1} className="form-input" value={cutForm.quantity} onChange={e => setCutForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Cantos (lados)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {SIDES.map(([side, label]) => (
                    <button key={side} type="button" onClick={() => toggleSide(side)}
                      style={{ flex: 1, height: '2.5rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.75rem', border: '2px solid', cursor: 'pointer', transition: 'all 0.15s',
                        background: cutForm.sides.includes(side) ? 'var(--primary)' : 'white',
                        borderColor: cutForm.sides.includes(side) ? 'var(--primary)' : 'var(--border)',
                        color: cutForm.sides.includes(side) ? 'white' : 'var(--text-muted)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {cutForm.sides.length > 0 && (
                <div className="form-group">
                  <label className="form-label" style={!cutForm.edgeBandMaterialId ? { color: 'var(--danger)' } : {}}>
                    Material de canto {!cutForm.edgeBandMaterialId ? '⚠ requerido' : ''}
                  </label>
                  <MatCombo options={cantoMats} value={cutForm.edgeBandMaterialId} onChange={v => setCutForm(f => ({ ...f, edgeBandMaterialId: v }))} placeholder="Seleccionar canto…" section="CANTO" onCreated={fetchItem} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Mostrar en PDF</label>
                <PdfVisibilitySelect value={cutForm.pdfVisibility} onChange={v => setCutForm(f => ({ ...f, pdfVisibility: v }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveCut} disabled={saving || (cutForm.sides.length > 0 && !cutForm.edgeBandMaterialId)}>
                {saving ? 'Guardando…' : editingCutId ? 'Guardar cambios' : 'Agregar corte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Herraje ── */}
      {modal === 'accessory' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Agregar herraje</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" placeholder="Ej: Bisagra cazoleta…" value={accForm.description} onChange={e => setAccForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Material / Herraje</label>
                <MatCombo options={herrajeMats} value={accForm.materialId} onChange={v => setAccForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar herraje…" section="HERRAJES" onCreated={fetchItem} />
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input type="number" min={1} className="form-input" value={accForm.quantity} onChange={e => setAccForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Mostrar en PDF</label>
                <PdfVisibilitySelect value={accForm.pdfVisibility} onChange={v => setAccForm(f => ({ ...f, pdfVisibility: v }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveAcc} disabled={saving}>{saving ? 'Guardando…' : 'Agregar herraje'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Adicional ── */}
      {modal === 'additional' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Agregar adicional</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['calc', 'fixed'] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setAddForm(f => ({ ...f, priceMode: mode }))}
                    style={{ flex: 1, height: '2.25rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '0.75rem', border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                      background: addForm.priceMode === mode ? 'var(--primary)' : 'white',
                      borderColor: addForm.priceMode === mode ? 'var(--primary)' : 'var(--border)',
                      color: addForm.priceMode === mode ? 'white' : 'var(--text-muted)' }}>
                    {mode === 'calc' ? 'Calculado (material × cant.)' : 'Precio fijo'}
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" placeholder="Ej: Tacho de basura…" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {addForm.priceMode === 'calc' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Material / Ítem</label>
                    <MatCombo options={addMats} value={addForm.materialId} onChange={v => setAddForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar…" section="ADICIONALES" onCreated={fetchItem} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cantidad</label>
                    <input type="number" min={1} className="form-input" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Material / Ítem (opcional)</label>
                    <MatCombo options={addMats} value={addForm.materialId} onChange={v => setAddForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar (opcional)…" section="ADICIONALES" onCreated={fetchItem} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio total</label>
                    <input type="number" min={0} className="form-input" placeholder="0.00" value={addForm.manualPrice || ''} onChange={e => setAddForm(f => ({ ...f, manualPrice: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </>
              )}
              <div className="form-group">
                <label className="form-label">Mostrar en PDF</label>
                <PdfVisibilitySelect value={addForm.pdfVisibility} onChange={v => setAddForm(f => ({ ...f, pdfVisibility: v }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveAdd} disabled={saving}>{saving ? 'Guardando…' : 'Agregar adicional'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
