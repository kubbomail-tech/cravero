'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function PerfilPage() {
  const { data: session, update } = useSession()

  // Datos personales
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? '')
      setEmail(session.user.email ?? '')
    }
  }, [session])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSavingName(true)
    setNameMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNameMsg({ type: 'error', text: data.error })
      } else {
        await update({ name: data.name })
        setNameMsg({ type: 'ok', text: 'Nombre actualizado correctamente.' })
      }
    } finally {
      setSavingName(false)
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' })
      return
    }
    setSavingPwd(true)
    setPwdMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwdMsg({ type: 'error', text: data.error })
      } else {
        setPwdMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } finally {
      setSavingPwd(false)
    }
  }

  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="page-subtitle">Gestioná tu nombre y contraseña</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start', maxWidth: 860 }}>

        {/* Datos personales */}
        <div className="card">
          <div className="card-header">
            <h2>Datos personales</h2>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 600, fontSize: '1.125rem', flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{name || '—'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{email}</div>
              </div>
            </div>

            <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nombre y apellido"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-input"
                  value={email}
                  disabled
                  style={{ background: 'var(--border-light)', color: 'var(--text-muted)' }}
                />
              </div>
              {nameMsg && (
                <div className={nameMsg.type === 'ok' ? 'alert alert-success' : 'alert alert-error'}>
                  {nameMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" type="submit" disabled={savingName}>
                  {savingName ? 'Guardando...' : 'Guardar nombre'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Contraseña */}
        <div className="card">
          <div className="card-header">
            <h2>Cambiar contraseña</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Contraseña actual</label>
                <input
                  className="form-input"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <input
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar nueva contraseña</label>
                <input
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {pwdMsg && (
                <div className={pwdMsg.type === 'ok' ? 'alert alert-success' : 'alert alert-error'}>
                  {pwdMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" type="submit" disabled={savingPwd}>
                  {savingPwd ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </>
  )
}
