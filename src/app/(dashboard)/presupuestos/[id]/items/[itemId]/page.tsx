'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

type Material = { id: string; name: string; unitCost: number; category?: { seccion?: string | null } }

const fmt = (n: any) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(String(n)))
const SIDES = [['TOP','Sup'],['BOTTOM','Inf'],['LEFT','Izq'],['RIGHT','Der']] as const

// ── Combobox ────────────────────────────────────────────────────────────────
function MatCombo({ options, value, onChange, placeholder }: {
  options: Material[]; value: string; onChange: (id: string) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find(m => m.id === value)
  const filtered = q ? options.filter(m => m.name.toLowerCase().includes(q.toLowerCase())) : options

  useEffect(() => {
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ('') } }
    if (open) { document.addEventListener('mousedown', handle); setTimeout(() => inputRef.current?.focus(), 10) }
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="form-select" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }} onClick={() => setOpen(o => !o)}>
        <span style={{ color: selected ? undefined : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.name : (placeholder ?? 'Seleccionar…')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginLeft: 4, opacity: 0.4 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
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
          </div>
        </div>
      )}
    </div>
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

  const [cutForm, setCutForm] = useState({ description: '', materialId: '', width: 0, height: 0, quantity: 1, edgeBandMaterialId: '', sides: [] as string[] })
  const [accForm, setAccForm] = useState({ description: '', materialId: '', quantity: 1 })
  const [addForm, setAddForm] = useState({ description: '', materialId: '', quantity: 1, showPrice: true })

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

  async function saveCut() {
    if (!ids) return
    setSaving(true)
    const edgeBands = cutForm.sides.map(side => ({ side, materialId: cutForm.edgeBandMaterialId, quantity: 1 }))
    const res = await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/cuts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cutForm, edgeBands }),
    })
    setSaving(false)
    if (res.ok) { setModal(null); setCutForm({ description: '', materialId: '', width: 0, height: 0, quantity: 1, edgeBandMaterialId: '', sides: [] }); fetchItem() }
  }

  async function saveAcc() {
    if (!ids) return
    setSaving(true)
    const res = await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/accessories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(accForm),
    })
    setSaving(false)
    if (res.ok) { setModal(null); setAccForm({ description: '', materialId: '', quantity: 1 }); fetchItem() }
  }

  async function saveAdd() {
    if (!ids) return
    setSaving(true)
    const res = await fetch(`/api/quotes/${ids.id}/items/${ids.itemId}/additionals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm),
    })
    setSaving(false)
    if (res.ok) { setModal(null); setAddForm({ description: '', materialId: '', quantity: 1, showPrice: true }); fetchItem() }
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
              <thead><tr><th>Descripción</th><th>Material</th><th>Ancho</th><th>Alto</th><th>Cant.</th><th>Cantos</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {item.cuts.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin cortes</td></tr>
                  : item.cuts.map((cut: any) => (
                    <tr key={cut.id}>
                      <td style={{ fontWeight: 500 }}>{cut.description ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{cut.materialNameSnapshot ?? '—'}</td>
                      <td>{cut.width} mm</td>
                      <td>{cut.height} mm</td>
                      <td>{cut.quantity}</td>
                      <td>{cut.edgeBands?.length ?? 0}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(cut.subtotalCost)}</td>
                      <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteCut(cut.id)}>✕</button></td>
                    </tr>
                  ))}
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
              <thead><tr><th>Descripción</th><th>Material</th><th>Cant.</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {item.accessories.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin herrajes</td></tr>
                  : item.accessories.map((acc: any) => (
                    <tr key={acc.id}>
                      <td style={{ fontWeight: 500 }}>{acc.description ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{acc.materialNameSnapshot ?? '—'}</td>
                      <td>{acc.quantity}</td>
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
              <thead><tr><th>Descripción</th><th>Material</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {(item.additionals ?? []).length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin adicionales</td></tr>
                  : (item.additionals ?? []).map((add: any) => (
                    <tr key={add.id}>
                      <td style={{ fontWeight: 500 }}>{add.description ?? '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{add.materialNameSnapshot ?? '—'}</td>
                      <td>{add.quantity}</td>
                      <td><span className="badge badge-gray">{add.showPrice ? 'Visible' : 'Oculto'}</span></td>
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
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>Agregar corte</h3><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>×</button></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" placeholder="Ej: Lateral izquierdo…" value={cutForm.description} onChange={e => setCutForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Material / Placa</label>
                <MatCombo options={placaMats} value={cutForm.materialId} onChange={v => setCutForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar placa…" />
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
                  <MatCombo options={cantoMats} value={cutForm.edgeBandMaterialId} onChange={v => setCutForm(f => ({ ...f, edgeBandMaterialId: v }))} placeholder="Seleccionar canto…" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveCut} disabled={saving || (cutForm.sides.length > 0 && !cutForm.edgeBandMaterialId)}>
                {saving ? 'Guardando…' : 'Agregar corte'}
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
                <MatCombo options={herrajeMats} value={accForm.materialId} onChange={v => setAccForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar herraje…" />
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input type="number" min={1} className="form-input" value={accForm.quantity} onChange={e => setAccForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
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
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" placeholder="Ej: Tacho de basura…" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Material / Ítem</label>
                <MatCombo options={addMats} value={addForm.materialId} onChange={v => setAddForm(f => ({ ...f, materialId: v }))} placeholder="Seleccionar…" />
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input type="number" min={1} className="form-input" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Mostrar precio en PDF</label>
                <button type="button" onClick={() => setAddForm(f => ({ ...f, showPrice: !f.showPrice }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ width: 40, height: 22, borderRadius: 11, background: addForm.showPrice ? 'var(--primary)' : 'var(--border)', display: 'flex', alignItems: 'center', padding: '0 3px', transition: 'background 0.2s' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', transform: addForm.showPrice ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s' }} />
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{addForm.showPrice ? 'Precio visible' : 'Precio oculto'}</span>
                </button>
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
