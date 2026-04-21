'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Quote = {
  id: string
  quoteNumber: string
  status: string
  totalAmount: string
  issueDate: string
}

type ClientDetail = {
  id: string
  fullName: string
  businessName?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  province?: string
  notes?: string
  isActive: boolean
  quotes: Quote[]
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitido',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Vencido',
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-gray',
  ISSUED: 'badge-blue',
  APPROVED: 'badge-teal',
  REJECTED: 'badge-red',
  EXPIRED: 'badge-yellow',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(val: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(val))
}

export default function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => { if (data) setClient(data) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando ficha...
      </div>
    )
  }

  if (notFound || !client) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p>Cliente no encontrado.</p>
        <Link href="/clientes" className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }}>
          Volver a clientes
        </Link>
      </div>
    )
  }

  const location = [client.city, client.province].filter(Boolean).join(', ')

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/clientes" className="btn btn-ghost btn-sm" style={{ padding: '0.3rem 0.5rem' }}>
            <BackIcon />
          </Link>
          <div>
            <h1 className="page-title">{client.fullName}</h1>
            {client.businessName && (
              <p className="page-subtitle">{client.businessName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Info card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '0.75rem',
        padding: '1.25rem 1.5rem',
      }}>
        <InfoItem label="Teléfono" value={client.phone} />
        <InfoItem label="Email" value={client.email} />
        {client.address && <InfoItem label="Dirección" value={client.address} />}
        {location && <InfoItem label="Ubicación" value={location} />}
        {client.notes && (
          <div style={{ gridColumn: '1 / -1' }}>
            <InfoItem label="Notas" value={client.notes} />
          </div>
        )}
      </div>

      {/* Quotes table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
          Presupuestos
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            ({client.quotes.length})
          </span>
        </h2>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {client.quotes.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <p>Este cliente no tiene presupuestos aún</p>
                  </div>
                </td>
              </tr>
            ) : client.quotes.map(q => (
              <tr key={q.id}>
                <td>
                  <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {q.quoteNumber}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {formatDate(q.issueDate)}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[q.status] ?? 'badge-gray'}`}>
                    {STATUS_LABELS[q.status] ?? q.status}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>
                  {formatCurrency(q.totalAmount)}
                </td>
                <td>
                  <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                    <Link href={`/presupuestos/${q.id}`} className="btn btn-ghost btn-sm">
                      Ver
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '0.9rem', color: value ? 'var(--text)' : 'var(--text-muted)' }}>
        {value ?? '—'}
      </div>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
