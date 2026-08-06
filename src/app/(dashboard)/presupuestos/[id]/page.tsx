'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toNumber } from '@/lib/calculations'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(parseFloat(String(n)))

const statusMap: Record<string, string> = {
  DRAFT: 'Borrador', ISSUED: 'Emitido', APPROVED: 'Aprobado', REJECTED: 'Rechazado', EXPIRED: 'Vencido',
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [furnitureTypes, setFurnitureTypes] = useState<any[]>([])
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [newItemForm, setNewItemForm] = useState({ furnitureTypeId: '', description: '' })
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<any[]>([])
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [removingItem, setRemovingItem] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (clientSearch.length > 1)
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&isActive=true`)
        .then(r => r.json()).then(setClientResults)
    else setClientResults([])
  }, [clientSearch])



  useEffect(() => { params.then(p => setId(p.id)) }, [params])

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      const [qRes, ftRes] = await Promise.all([
        fetch(`/api/quotes/${id}`),
        fetch('/api/furniture-types'),
      ])
      const q = await qRes.json()
      setQuote(q)
      setNotes(q.notes ?? '')
      setEditForm({
        clientId: q.client.id,
        clientName: q.client.fullName,
        title: q.title ?? '',
        issueDate: q.issueDate?.split('T')[0] ?? '',
        expirationDate: q.expirationDate?.split('T')[0] ?? '',
        laborPercentage: parseFloat(q.laborPercentage),
        vatPercentage: parseFloat(q.vatPercentage),
        discountAmount: parseFloat(q.discountAmount),
        paymentTerms: q.paymentTerms ?? '',
      })
      setFurnitureTypes(await ftRes.json())
      setLoading(false)
      if (searchParams.get('edit') === '1') setShowEdit(true)
    }
    fetchData()
  }, [id])

  async function handleDownloadPdf() {
    if (!id) return
    setGeneratingPdf(true)
    try {
      const res = await fetch(`/api/quotes/${id}/pdf`, { method: 'POST' })
      if (!res.ok) { alert('Error al generar el PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quote?.quoteNumber ?? 'presupuesto'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleCreateItem() {
    if (!newItemForm.furnitureTypeId) return
    setSavingItem(true)
    try {
      const res = await fetch(`/api/quotes/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItemForm, quantity: 1 }),
      })
      if (res.ok) {
        // Refetch quote to show new item
        const qRes = await fetch(`/api/quotes/${id}`)
        setQuote(await qRes.json())
        setShowAddItem(false)
        setNewItemForm({ furnitureTypeId: '', description: '' })
      }
    } finally {
      setSavingItem(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!id) return
    setRemovingItem(true)
    try {
      const res = await fetch(`/api/quotes/${id}/items/${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        const qRes = await fetch(`/api/quotes/${id}`)
        setQuote(await qRes.json())
        setDeletingItemId(null)
      }
    } finally {
      setRemovingItem(false)
    }
  }

  async function handleSaveEdit() {
    if (!id) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const q = await fetch(`/api/quotes/${id}`).then(r => r.json())
        setQuote(q)
        setNotes(q.notes ?? '')
        setShowEdit(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ? `Error al guardar: ${JSON.stringify(err.error).substring(0, 200)}` : 'Error al guardar los cambios')
      }
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleSaveNotes() {
    if (!id) return
    setSavingNotes(true)
    await fetch(`/api/quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setSavingNotes(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2500)
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return
    try {
      setLoading(true)
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const qRes = await fetch(`/api/quotes/${id}`)
        setQuote(await qRes.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !quote) return <div className="flex justify-center p-20 text-gray-400">Cargando presupuesto...</div>
  if (!quote) return <div className="p-20 text-center text-gray-500">No se encontró el presupuesto.</div>

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/presupuestos" className="btn btn-ghost btn-sm">← Volver</Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title" style={{ fontFamily: 'monospace' }}>{quote.quoteNumber}</h1>
              <span className={`badge ${
                quote.status === 'DRAFT' ? 'badge-gray' :
                quote.status === 'APPROVED' ? 'badge-green' :
                quote.status === 'ISSUED' ? 'badge-blue' :
                quote.status === 'REJECTED' ? 'badge-red' : 'badge-yellow'
              }`}>{statusMap[quote.status]}</span>
            </div>
            <p className="page-subtitle">
              {quote.client.fullName}{quote.client.businessName ? ` · ${quote.client.businessName}` : ''}
              {quote.title && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {quote.title}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={handleDownloadPdf} disabled={generatingPdf}>
            {generatingPdf ? <span className="spinner spinner-dark" /> : null} PDF
          </button>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>
            Editar datos
          </button>
          {quote.status === 'DRAFT' && (
            <button className="btn btn-primary" onClick={() => handleStatusChange('ISSUED')} disabled={loading}>
              Emitir
            </button>
          )}
          {quote.status === 'ISSUED' && (
            <>
              <button className="btn btn-secondary" style={{ color: 'var(--success)' }} onClick={() => handleStatusChange('APPROVED')} disabled={loading}>
                Aprobar
              </button>
              <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => handleStatusChange('REJECTED')} disabled={loading}>
                Rechazar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Items */}
        <div>
          {quote.items.length === 0 ? (
            <div className="empty-state" style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <p>Sin muebles todavía. Agregá el primero.</p>
              <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>
                <PlusIcon /> Agregar mueble
              </button>
            </div>
          ) : (
            <>
              {quote.items.map((item: any, i: number) => (
                <Link
                  key={item.id}
                  href={`/presupuestos/${id}/items/${item.id}`}
                  className="section-block"
                  style={{ display: 'block', textDecoration: 'none', borderLeft: '3px solid var(--primary)' }}
                >
                  <div className="section-block-header">
                    <div className="section-block-title">
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 400 }}>#{i + 1}</span>
                      {item.furnitureType?.name || 'Mueble'}
                      {item.description && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {item.description}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(item.subtotalTotal)}</span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Mat. + Adic. (sin MO)</div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        title="Eliminar mueble"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setDeletingItemId(item.id) }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  <div className="section-block-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                      {[
                        { label: 'Cortes', value: `${item.cuts?.length ?? 0} piezas` },
                        { label: 'Herrajes', value: `${item.accessories?.length ?? 0} unid.` },
                        { label: 'Adicionales', value: `${item.additionals?.length ?? 0} unid.` },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: 'var(--border-light)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                          <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
              <button
                className="btn btn-secondary w-full"
                style={{ marginTop: '0.5rem' }}
                onClick={() => setShowAddItem(true)}
              >
                <PlusIcon /> Agregar mueble
              </button>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header"><h2>Cliente</h2></div>
            <div className="card-body" style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontWeight: 500 }}>{quote.client.fullName}</div>
              {quote.client.businessName && <div style={{ color: 'var(--text-muted)' }}>{quote.client.businessName}</div>}
              {quote.client.phone && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: 32 }}>Tel.</span>
                  <span>{quote.client.phone}</span>
                </div>
              )}
              {quote.client.email && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: 32 }}>Email</span>
                  <span>{quote.client.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header"><h2>Datos</h2></div>
            <div className="card-body" style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Mano de obra</span>
                <span>{parseFloat(String(quote.laborPercentage))}%</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>IVA</span>
                <span>{parseFloat(String(quote.vatPercentage))}%</span>
              </div>
              {toNumber(quote.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Descuento</span>
                  <span>{parseFloat(String(quote.discountAmount))}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="totals-box">
            <div className="total-row">
              <span className="label">Materiales y herrajes</span>
              <span className="value">{fmt(quote.subtotalMaterials)}</span>
            </div>
            <div className="total-row">
              <span className="label">Mano de obra ({parseFloat(String(quote.laborPercentage))}%)</span>
              <span className="value">{fmt(quote.subtotalLabor)}</span>
            </div>
            {toNumber(quote.discountAmount) > 0 && (
              <div className="total-row">
                <span className="label">Descuento ({parseFloat(String(quote.discountAmount))}%)</span>
                <span className="value" style={{ color: 'var(--danger)' }}>-{fmt((toNumber(quote.subtotalMaterials) + toNumber(quote.subtotalLabor)) * toNumber(quote.discountAmount) / 100)}</span>
              </div>
            )}
            {toNumber(quote.subtotalAdditionals) > 0 && (
              <div className="total-row">
                <span className="label">Adicionales</span>
                <span className="value">{fmt(quote.subtotalAdditionals)}</span>
              </div>
            )}
            <div className="total-row">
              <span className="label">IVA ({parseFloat(String(quote.vatPercentage))}%)</span>
              <span className="value">{fmt(quote.vatAmount)}</span>
            </div>
            <div className="total-row main">
              <span className="label">TOTAL</span>
              <span className="value">{fmt(quote.totalAmount)}</span>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2>Observaciones</h2>
              {notesSaved && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>✓ Guardado</span>}
            </div>
            <div className="card-body">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Formas de pago, plazos de entrega, notas para el cliente…"
                style={{
                  width: '100%', padding: '10px 12px', fontSize: '0.8125rem',
                  color: 'var(--text)', background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  lineHeight: 1.5, boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                style={{
                  marginTop: 8, height: 34, padding: '0 16px', width: '100%',
                  background: 'var(--primary)', color: 'white',
                  fontWeight: 600, fontSize: '0.8125rem',
                  border: 'none', borderRadius: 6, cursor: savingNotes ? 'not-allowed' : 'pointer',
                  opacity: savingNotes ? 0.7 : 1,
                }}
              >
                {savingNotes ? 'Guardando...' : 'Guardar observaciones'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agregar mueble modal */}
      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar mueble</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddItem(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Tipo de mueble *</label>
                  <select
                    className="form-select"
                    value={newItemForm.furnitureTypeId}
                    onChange={e => setNewItemForm({ ...newItemForm, furnitureTypeId: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {furnitureTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Baño principal"
                    value={newItemForm.description}
                    onChange={e => setNewItemForm({ ...newItemForm, description: e.target.value })}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                Podrás cargar cortes y herrajes desde el detalle del mueble.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddItem(false)}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateItem}
                disabled={savingItem || !newItemForm.furnitureTypeId}
              >
                {savingItem ? 'Creando...' : 'Agregar al presupuesto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editar datos modal */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar presupuesto</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    placeholder="Buscar cliente…"
                    value={editForm.clientName || clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value)
                      setShowClientDrop(true)
                      setEditForm((f: any) => ({ ...f, clientId: '', clientName: '' }))
                    }}
                    onFocus={() => setShowClientDrop(true)}
                  />
                  {showClientDrop && clientSearch.length > 1 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: 4,
                      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
                    }}>
                      {clientResults.length === 0 ? (
                        <div style={{ padding: '0.625rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sin resultados</div>
                      ) : clientResults.map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                          onClick={() => {
                            setEditForm((f: any) => ({ ...f, clientId: c.id, clientName: c.fullName }))
                            setClientSearch(c.fullName)
                            setShowClientDrop(false)
                          }}
                        >
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{c.fullName}</div>
                          {c.businessName && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.businessName}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre del trabajo {quote.status !== 'DRAFT' && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(bloqueado, presupuesto ya emitido)</span>}</label>
                <input className="form-input" placeholder="Ej: Amoblamiento vestidor y 2 baños…"
                  disabled={quote.status !== 'DRAFT'}
                  value={editForm.title} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Fecha de emisión</label>
                  <input type="date" className="form-input" disabled={quote.status !== 'DRAFT'} value={editForm.issueDate}
                    onChange={e => setEditForm((f: any) => ({ ...f, issueDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de vencimiento</label>
                  <input type="date" className="form-input" disabled={quote.status !== 'DRAFT'} value={editForm.expirationDate}
                    onChange={e => setEditForm((f: any) => ({ ...f, expirationDate: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Mano de obra (%)</label>
                  <input type="number" className="form-input" value={editForm.laborPercentage}
                    onChange={e => setEditForm((f: any) => ({ ...f, laborPercentage: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">IVA (%)</label>
                  <input type="number" className="form-input" value={editForm.vatPercentage}
                    onChange={e => setEditForm((f: any) => ({ ...f, vatPercentage: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descuento (%)</label>
                <input type="number" className="form-input" style={{ maxWidth: 160 }} value={editForm.discountAmount}
                  onChange={e => setEditForm((f: any) => ({ ...f, discountAmount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Formas de pago</label>
                <textarea className="form-textarea" rows={3} placeholder="Opciones de pago…"
                  disabled={quote.status !== 'DRAFT'}
                  value={editForm.paymentTerms}
                  onChange={e => setEditForm((f: any) => ({ ...f, paymentTerms: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={savingEdit || !editForm.clientId}>
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eliminar mueble modal */}
      {deletingItemId && (
        <div className="modal-overlay" onClick={() => setDeletingItemId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar mueble</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeletingItemId(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Estás por eliminar este mueble del presupuesto, junto con todos sus cortes, herrajes y adicionales. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button className="btn btn-secondary w-full" onClick={() => setDeletingItemId(null)}>Cancelar</button>
                <button
                  className="btn btn-danger w-full"
                  onClick={() => handleDeleteItem(deletingItemId)}
                  disabled={removingItem}
                >
                  {removingItem ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlusIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function TrashIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg> }
