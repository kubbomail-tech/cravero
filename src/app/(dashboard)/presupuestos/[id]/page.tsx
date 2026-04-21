'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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



  useEffect(() => { params.then(p => setId(p.id)) }, [params])

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      setLoading(true)
      const [qRes, ftRes] = await Promise.all([
        fetch(`/api/quotes/${id}`),
        fetch('/api/furniture-types'),
      ])
      setQuote(await qRes.json())
      setFurnitureTypes(await ftRes.json())
      setLoading(false)
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
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={handleDownloadPdf} disabled={generatingPdf}>
            {generatingPdf ? <span className="spinner spinner-dark" /> : null} PDF
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
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{fmt(item.subtotalTotal)}</span>
                  </div>
                  <div className="section-block-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                      {[
                        { label: 'Cortes', value: `${item.cuts?.length ?? 0} piezas` },
                        { label: 'Herrajes', value: `${item.accessories?.length ?? 0} unid.` },
                        { label: 'Materiales', value: fmt(item.subtotalMaterials) },
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
                  <span style={{ color: 'var(--danger)' }}>-{fmt(quote.discountAmount)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="totals-box">
            <div className="total-row">
              <span className="label">Materiales</span>
              <span className="value">{fmt(quote.subtotalMaterials)}</span>
            </div>
            <div className="total-row">
              <span className="label">Mano de obra ({parseFloat(String(quote.laborPercentage))}%)</span>
              <span className="value">{fmt(quote.subtotalLabor)}</span>
            </div>
            {toNumber(quote.discountAmount) > 0 && (
              <div className="total-row">
                <span className="label">Descuento</span>
                <span className="value">-{fmt(quote.discountAmount)}</span>
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
    </>
  )
}

function PlusIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
