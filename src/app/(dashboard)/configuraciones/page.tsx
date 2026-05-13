'use client'

import { useState, useEffect } from 'react'

export default function ConfiguracionesPage() {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings?key=default_notes')
      .then(r => r.json())
      .then(d => { setNotes(d.value ?? ''); setLoading(false) })
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'default_notes', value: notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Configuraciones
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Ajustes generales del sistema
        </p>
      </div>

      <div style={{
        background: 'white',
        borderRadius: 16,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Observaciones por defecto
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Este texto se pre-carga automáticamente en el campo &ldquo;Observaciones&rdquo; al crear un nuevo presupuesto. Podés editarlo en cada presupuesto individual.
          </p>
        </div>

        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Cargando...
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={6}
              placeholder="Ej: Precio válido por 15 días. No incluye mano de obra de instalación. Seña del 50% para iniciar trabajo..."
              style={{
                width: '100%', padding: '12px 14px',
                fontSize: '0.875rem', color: 'var(--text-primary)',
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 10, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          )}

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                height: 38, padding: '0 20px',
                background: 'var(--primary)', color: 'white',
                fontWeight: 600, fontSize: '0.875rem',
                border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saved && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                ✓ Guardado
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
