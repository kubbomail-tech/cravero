'use client'

import { useState, useEffect } from 'react'

export default function ConfiguracionesPage() {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0)
  const [resetting, setResetting] = useState(false)

  async function handleReset() {
    setResetting(true)
    await fetch('/api/admin/reset', { method: 'POST' })
    setResetting(false)
    setResetStep(0)
    alert('Sistema reiniciado. Todos los presupuestos, clientes y materiales fueron eliminados.')
  }

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
      {/* Zona de peligro */}
      <div style={{ marginTop: 32, background: 'white', borderRadius: 16, border: '1.5px solid #fca5a5', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #fca5a5', background: '#fff5f5' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Zona de peligro</h2>
          <p style={{ fontSize: '0.8125rem', color: '#7f1d1d' }}>
            Estas acciones son irreversibles. Se eliminarán todos los presupuestos, clientes y materiales del sistema.
          </p>
        </div>
        <div style={{ padding: 24 }}>
          {resetStep === 0 && (
            <button
              onClick={() => setResetStep(1)}
              style={{ height: 38, padding: '0 20px', background: 'white', color: '#dc2626', fontWeight: 600, fontSize: '0.875rem', border: '1.5px solid #dc2626', borderRadius: 8, cursor: 'pointer' }}
            >
              Reiniciar sistema
            </button>
          )}
          {resetStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>
                ¿Estás seguro? Esto eliminará TODOS los presupuestos, clientes y materiales. No hay vuelta atrás.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setResetStep(0)} style={{ height: 38, padding: '0 20px', background: 'white', color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => setResetStep(2)} style={{ height: 38, padding: '0 20px', background: '#dc2626', color: 'white', fontWeight: 600, fontSize: '0.875rem', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  Sí, entiendo — continuar
                </button>
              </div>
            </div>
          )}
          {resetStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626' }}>
                Última confirmación: ¿borrar absolutamente todo?
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setResetStep(0)} style={{ height: 38, padding: '0 20px', background: 'white', color: 'var(--text)', fontWeight: 600, fontSize: '0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleReset} disabled={resetting} style={{ height: 38, padding: '0 20px', background: '#7f1d1d', color: 'white', fontWeight: 700, fontSize: '0.875rem', border: 'none', borderRadius: 8, cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1 }}>
                  {resetting ? 'Eliminando...' : 'BORRAR TODO'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
