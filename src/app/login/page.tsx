'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Credenciales incorrectas')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError('Ocurrió un error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-split-container">
      {/* Left Side: Brand Panel */}
      <div className="login-brand-panel">
        <div className="brand-content">
          <Image
            src="/logo.png"
            alt="Cravero Muebles Logo"
            width={280}
            height={60}
            priority
            unoptimized
            style={{ objectFit: 'contain', width: 280, height: 'auto' }}
          />
          <div className="brand-divider"></div>
          <p className="brand-slogan">Sistema de Presupuestación</p>
        </div>
        
        {/* Background Patterns */}
        <div className="pattern-circle circle-1"></div>
        <div className="pattern-circle circle-2"></div>
        
        <div className="brand-footer">
          © {new Date().getFullYear()} Cravero Muebles
        </div>
      </div>

      {/* Right Side: Form Panel */}
      <div className="login-form-panel">
        <div className="form-container">
          <div className="form-header">
            <span className="welcome-tag">BIENVENIDO</span>
            <h2>Ingresá a tu cuenta</h2>
            <p className="register-hint">Gestión centralizada de presupuestos</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-content">
            {error && (
              <div className="login-error-alert">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">EMAIL O USUARIO</label>
              <div className="input-with-icon">
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@craveromuebles.com.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">CONTRASEÑA</label>
              <div className="input-with-icon">
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-actions-extended">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Recordarme</span>
              </label>
              <a href="#" className="forgot-password">Olvidé mi contraseña</a>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-block btn-lg" 
              disabled={loading}
              style={{ padding: '1rem', marginTop: '1rem' }}
            >
              {loading ? <span className="spinner" /> : 'Acceder'}
            </button>
          </form>

          <div className="form-footer">
            Desarrollado por <a href="https://kubbo.com.ar" target="_blank" rel="noopener noreferrer" className="brand-accent" style={{ textDecoration: 'none' }}>kubbo</a>
          </div>
        </div>
        
        {/* Decorative background for the right side */}
        <div className="form-pattern-bg"></div>
      </div>

      <style jsx>{`
        .login-split-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          background: #fff;
        }

        /* Lado Izquierdo */
        .login-brand-panel {
          flex: 1;
          background: linear-gradient(135deg, #0e524d 0%, #198e85 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          color: white;
          padding: 2rem;
          overflow: hidden;
        }

        .brand-content {
          z-index: 10;
          text-align: center;
          animation: fadeInDown 0.8s ease-out;
        }

        .logo-circle {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px);
          width: 200px;
          height: 200px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          margin-left: auto;
          margin-right: auto;
        }

        .login-brand-panel h1 {
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: 0.15em;
          margin-bottom: 0.5rem;
          text-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .brand-description {
          font-size: 0.9rem;
          font-weight: 500;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          opacity: 0.9;
        }

        .brand-divider {
          width: 40px;
          height: 2px;
          background: white;
          margin: 1.5rem auto;
          opacity: 0.5;
        }

        .brand-slogan {
          font-size: 1rem;
          opacity: 0.7;
          font-weight: 300;
        }

        /* Patrones de fondo circular */
        .pattern-circle {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.05);
          pointer-events: none;
        }

        .circle-1 {
          width: 400px;
          height: 400px;
          top: -100px;
          left: -100px;
        }

        .circle-2 {
          width: 600px;
          height: 600px;
          bottom: -200px;
          right: -200px;
          opacity: 0.08;
        }

        .brand-footer {
          position: absolute;
          bottom: 2rem;
          font-size: 0.75rem;
          opacity: 0.5;
        }

        /* Lado Derecho */
        .login-form-panel {
          flex: 1.2;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          position: relative;
        }

        .form-container {
          width: 100%;
          max-width: 440px;
          animation: fadeInUp 0.8s ease-out;
          z-index: 10;
        }

        .form-header {
          margin-bottom: 2.5rem;
        }

        .welcome-tag {
          color: #198e85;
          font-weight: 700;
          letter-spacing: 0.1em;
          font-size: 0.75rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .form-header h2 {
          font-size: 2.25rem;
          color: #1a202c;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .register-hint {
          color: #718096;
          font-size: 0.95rem;
        }

        .login-form-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #4a5568;
          margin-bottom: 0.5rem;
          display: block;
          letter-spacing: 0.05em;
        }

        .form-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1.5px solid #edf2f7;
          border-radius: 0.75rem;
          font-size: 1rem;
          transition: all 0.2s;
          background: #f8fafc;
        }

        .form-input:focus {
          border-color: #198e85;
          outline: none;
          background: white;
          box-shadow: 0 0 0 4px rgba(25, 142, 133, 0.1);
        }

        .form-actions-extended {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #718096;
          cursor: pointer;
        }

        .forgot-password {
          color: #2c5282;
          font-weight: 600;
          text-decoration: none;
        }

        .login-error-alert {
          background: #fff5f5;
          color: #c53030;
          padding: 1rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #feb2b2;
        }

        .form-footer {
          margin-top: 3rem;
          text-align: center;
          font-size: 0.8rem;
          color: #a0aec0;
        }

        .brand-accent {
          color: #198e85;
          font-weight: 700;
        }

        .form-pattern-bg {
          position: absolute;
          right: -10%;
          top: -10%;
          width: 40%;
          height: 40%;
          background: radial-gradient(circle, #edf2f7 0%, transparent 70%);
          opacity: 0.5;
          z-index: 1;
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .login-brand-panel {
            display: none;
          }
          .login-form-panel {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  )
}
