'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Client = { id: string; fullName: string; businessName?: string }
type Material = { id: string; name: string; unitCost: number; category: { name: string; seccion?: string | null } }
type FurnitureType = { id: string; name: string }
type WizardStep = 'type' | 'cuts' | 'hardware' | 'additionals' | 'confirm'

interface CutItem {
  materialId: string; description: string; width: number; height: number
  quantity: number; edgeBandMaterialId: string; showInPdf: boolean
  edgeBands: { side: string; materialId: string; quantity: number }[]
}
interface AccessoryItem { materialId: string; description: string; quantity: number }
interface AdditionalItem { materialId: string; description: string; quantity: number; showPrice: boolean; priceMode: 'calc' | 'fixed'; manualPrice: number }
interface FurnitureItem {
  furnitureTypeId: string; name: string; description: string; quantity: number
  cuts: CutItem[]; accessories: AccessoryItem[]; additionals: AdditionalItem[]
}

// ─── Design tokens (applied consistently everywhere) ────────────────────────
// Label:   text-[11px] font-semibold text-slate-400 uppercase tracking-widest
// Input:   h-11 px-4 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all
// Select:  same as input
// Number:  h-12 text-lg font-bold text-slate-900 text-center
// Heading: text-xl font-black text-slate-900
// Sub:     text-sm text-slate-400
// Primary btn:   bg-[#198e85] text-white
// Secondary btn: bg-slate-900 text-white
// Accent:  indigo-600

const DRAFT_KEY = 'cravero:nuevo-presu-draft'

export default function NuevoPresupuestoPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    clientId: '', clientName: '',
    title: '',
    issueDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    laborPercentage: 30, vatPercentage: 21, discountAmount: 0,
    paymentTerms: '', notes: '',
  })
  const [saveError, setSaveError] = useState('')

  const [materials, setMaterials] = useState<Material[]>([])
  const [furnitureTypes, setFurnitureTypes] = useState<FurnitureType[]>([])
  const [items, setItems] = useState<FurnitureItem[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep | null>(null)
  const [draft, setDraft] = useState<FurnitureItem | null>(null)
  const [started, setStarted] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [autoSaveTs, setAutoSaveTs] = useState<Date | null>(null)
  const loadedRef = useRef(false)

  const refreshMaterials = () => fetch('/api/materials?isActive=true').then(r => r.json()).then(setMaterials)

  useEffect(() => {
    Promise.all([
      fetch('/api/materials?isActive=true').then(r => r.json()),
      fetch('/api/furniture-types').then(r => r.json()),
      fetch('/api/settings?key=default_notes').then(r => r.json()),
    ]).then(([m, f, s]) => {
      setMaterials(m)
      setFurnitureTypes(f)
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        try {
          const d = JSON.parse(saved)
          setForm(d.form)
          setItems(d.items ?? [])
          setStarted(d.started ?? false)
          setDraft(d.draft ?? null)
          setWizardStep(d.wizardStep ?? null)
          setDraftRestored(true)
        } catch { localStorage.removeItem(DRAFT_KEY) }
      } else {
        if (s.value) setForm(prev => ({ ...prev, notes: s.value }))
      }
      setTimeout(() => { loadedRef.current = true }, 200)
    })
  }, [])

  // Auto-save to localStorage whenever state changes (after initial load)
  useEffect(() => {
    if (!loadedRef.current) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, items, started, draft, wizardStep }))
    setAutoSaveTs(new Date())
  }, [form, items, started, draft, wizardStep])

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setDraftRestored(false)
    setForm({ clientId: '', clientName: '', title: '', issueDate: new Date().toISOString().split('T')[0], expirationDate: '', laborPercentage: 30, vatPercentage: 21, discountAmount: 0, paymentTerms: '', notes: '' })
    setItems([])
    setStarted(false)
    setDraft(null)
    setWizardStep(null)
    setAutoSaveTs(null)
  }

  useEffect(() => {
    if (clientSearch.length > 1)
      fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&isActive=true`)
        .then(r => r.json()).then(setClients)
    else setClients([])
  }, [clientSearch])

  const calcItem = (item: FurnitureItem) => {
    let total = 0
    item.cuts.forEach(c => {
      const mat = materials.find(m => m.id === c.materialId)
      total += (c.width / 1000) * (c.height / 1000) * c.quantity * (mat?.unitCost ?? 0)
      c.edgeBands.forEach(eb => {
        const eMat = materials.find(m => m.id === eb.materialId)
        const len = (eb.side === 'TOP' || eb.side === 'BOTTOM') ? c.width : c.height
        total += (len / 1000) * eb.quantity * c.quantity * (eMat?.unitCost ?? 0)
      })
    })
    item.accessories.forEach(a => {
      const mat = materials.find(m => m.id === a.materialId)
      total += a.quantity * (mat?.unitCost ?? 0)
    })
    item.additionals.forEach(a => {
      if (a.priceMode === 'fixed') { total += a.manualPrice; return }
      const mat = materials.find(m => m.id === a.materialId)
      total += a.quantity * (mat?.unitCost ?? 0)
    })
    return total
  }

  const draftSubtotal = draft ? calcItem(draft) : 0
  const globalSubtotal = items.reduce((a, b) => a + calcItem(b), 0) + draftSubtotal
  const labor = globalSubtotal * (form.laborPercentage / 100)
  const subtotalBeforeDiscount = globalSubtotal + labor
  const discountDollar = subtotalBeforeDiscount * (form.discountAmount / 100)
  const globalTotal = (subtotalBeforeDiscount - discountDollar) * (1 + form.vatPercentage / 100)
  const fmt = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)
  const calcCut = (cut: CutItem) => {
    const mat = materials.find(m => m.id === cut.materialId)
    let t = (cut.width / 1000) * (cut.height / 1000) * cut.quantity * (mat?.unitCost ?? 0)
    cut.edgeBands.forEach(eb => {
      const eMat = materials.find(m => m.id === eb.materialId)
      const len = (eb.side === 'TOP' || eb.side === 'BOTTOM') ? cut.width : cut.height
      t += (len / 1000) * eb.quantity * cut.quantity * (eMat?.unitCost ?? 0)
    })
    return t
  }

  // Wizard
  const selectType = (ft: FurnitureType) => {
    setDraft({ furnitureTypeId: ft.id, name: ft.name, description: '', quantity: 1, cuts: [], accessories: [], additionals: [] })
    setWizardStep('cuts')
  }
  const addCut = () => setDraft(d => d ? ({ ...d, cuts: [...d.cuts, { materialId: '', description: 'Pieza nueva', width: 0, height: 0, quantity: 1, edgeBandMaterialId: '', showInPdf: false, edgeBands: [] }] }) : d)
  const updateCut = (i: number, p: Partial<CutItem>) => setDraft(d => { if (!d) return d; const c = [...d.cuts]; c[i] = { ...c[i], ...p }; return { ...d, cuts: c } })
  const removeCut = (i: number) => setDraft(d => d ? ({ ...d, cuts: d.cuts.filter((_, j) => j !== i) }) : d)
  const toggleEdge = (cIdx: number, side: string) => {
    if (!draft) return
    const cut = draft.cuts[cIdx]
    const exists = cut.edgeBands.some(eb => eb.side === side)
    const edgeBands = exists
      ? cut.edgeBands.filter(eb => eb.side !== side)
      : [...cut.edgeBands, { side, materialId: cut.edgeBandMaterialId, quantity: 1 }]
    updateCut(cIdx, { edgeBands })
  }
  const setEdgeMat = (cIdx: number, matId: string) => {
    if (!draft) return
    updateCut(cIdx, { edgeBandMaterialId: matId, edgeBands: draft.cuts[cIdx].edgeBands.map(eb => ({ ...eb, materialId: matId })) })
  }
  const addAcc = () => setDraft(d => d ? ({ ...d, accessories: [...d.accessories, { materialId: '', description: 'Accesorio', quantity: 1 }] }) : d)
  const updateAcc = (i: number, p: Partial<AccessoryItem>) => setDraft(d => { if (!d) return d; const a = [...d.accessories]; a[i] = { ...a[i], ...p }; return { ...d, accessories: a } })
  const removeAcc = (i: number) => setDraft(d => d ? ({ ...d, accessories: d.accessories.filter((_, j) => j !== i) }) : d)
  const addAdditional = () => setDraft(d => d ? ({ ...d, additionals: [...d.additionals, { materialId: '', description: '', quantity: 1, showPrice: true, priceMode: 'calc' as const, manualPrice: 0 }] }) : d)
  const updateAdditional = (i: number, p: Partial<AdditionalItem>) => setDraft(d => { if (!d) return d; const a = [...d.additionals]; a[i] = { ...a[i], ...p }; return { ...d, additionals: a } })
  const removeAdditional = (i: number) => setDraft(d => d ? ({ ...d, additionals: d.additionals.filter((_, j) => j !== i) }) : d)
  const confirmItem = () => { if (draft) { setItems(p => [...p, draft]); setDraft(null); setWizardStep(null) } }
  const addAnother = () => { if (draft) { setItems(p => [...p, draft]); setDraft(null); setWizardStep('type') } }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        ...form,
        items: items.map(({ name: _name, ...item }) => ({
          ...item,
          cuts: item.cuts.map(({ edgeBandMaterialId: _ebm, showInPdf, ...cut }) => ({
            ...cut,
            showInPdf,
          })),
          additionals: item.additionals.map(({ priceMode, manualPrice, ...add }) => ({
            ...add,
            ...(priceMode === 'fixed' ? { manualPrice } : {}),
          })),
        })),
      }
      const res = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        localStorage.removeItem(DRAFT_KEY)
        const q = await res.json()
        router.push(`/presupuestos/${q.id}`)
      } else {
        const err = await res.json().catch(() => ({}))
        setSaveError(err?.error ? JSON.stringify(err.error).substring(0, 200) : `Error ${res.status} al guardar`)
      }
    } catch {
      setSaveError('Error de conexión. Verificá tu red e intentá de nuevo.')
    } finally { setSaving(false) }
  }

  const placaMats = materials.filter(m => m.category?.seccion === 'CORTES')
  const cantoMats = materials.filter(m => m.category?.seccion === 'CANTO')
  const herrajeMats = materials.filter(m => m.category?.seccion === 'HERRAJES')
  const additionalMats = materials.filter(m => m.category?.seccion === 'ADICIONALES')

  // ─── Shared classes (Precision Padding Edition) ─────────────────────────────
  const lbl = 'block text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-2 ml-1'
  const inp = 'w-full h-10 px-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-[#198e85]/10 focus:border-[#198e85] transition-all placeholder:text-slate-300 shadow-sm'
  const sel = 'w-full h-10 px-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl outline-none focus:border-[#198e85] transition-all cursor-pointer'
  const numInp = 'w-full h-10 px-1 text-base font-black text-slate-900 text-center bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-[#198e85]/10 focus:border-[#198e85] transition-all shadow-sm'
  const sideBtn = (active: boolean) => `flex-1 h-11 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 transition-all ${active ? 'bg-[#198e85] border-[#198e85] text-white shadow-lg shadow-[#ccf2ef]' : 'bg-white border-slate-100 text-slate-400 hover:border-[#80d4d0] hover:text-[#198e85]'}`
  const btnPrimary = 'h-12 px-10 bg-[#198e85] text-white text-sm font-bold rounded-full hover:bg-[#136e67] active:scale-95 transition-all shadow-lg shadow-[#ccf2ef] disabled:opacity-40 disabled:grayscale'
  const btnDark = 'h-12 px-10 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-200'
  const btnGhost = 'text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-[#198e85] transition-colors px-4'
  const btnDanger = 'w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-xl leading-none shadow-sm'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [wizardStep])

  const STEPS: WizardStep[] = ['type', 'cuts', 'hardware', 'additionals', 'confirm']
  const STEP_LABELS = ['Tipo', 'Cortes', 'Herrajes', 'Adicionales', 'Confirmar']

  // ── PRE-STEP: datos generales ──────────────────────────────────────────
  if (!started) return (
    <>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">Nuevo presupuesto</h1>
          <p className="page-subtitle">Completá los datos generales para comenzar</p>
        </div>
        {autoSaveTs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Borrador guardado
          </div>
        )}
      </div>

      {draftRestored && (
        <div style={{ marginBottom: '1rem', padding: '10px 16px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
          <span style={{ color: '#92400e', fontWeight: 600 }}>📋 Borrador restaurado — continuás desde donde lo dejaste.</span>
          <button onClick={discardDraft} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', fontWeight: 700, fontSize: '0.75rem', textDecoration: 'underline' }}>Descartar y empezar de cero</button>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">

          {/* Cliente */}
          <div className="px-6 py-3 border-b border-slate-50">
            <p className={lbl}>Cliente</p>
            <div className="relative">
              <input className={inp} placeholder="Buscar cliente…"
                value={form.clientName || clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); setForm(f => ({ ...f, clientId: '', clientName: '' })) }} />
              {showClientDrop && clientSearch.length > 1 && (
                <div className="absolute top-full mt-1 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  {clients.map(c => (
                    <button key={c.id} className="w-full text-left px-4 py-2.5 hover:bg-[#f0faf9] border-b border-slate-50 last:border-0 transition-colors"
                      onClick={() => { setForm(f => ({ ...f, clientId: c.id, clientName: c.fullName })); setClientSearch(c.fullName); setShowClientDrop(false) }}>
                      <p className="text-sm font-semibold text-slate-900">{c.fullName}</p>
                      {c.businessName && <p className="text-[11px] text-slate-400 uppercase">{c.businessName}</p>}
                    </button>
                  ))}
                  <button className="w-full text-left px-4 py-2.5 bg-[#f0faf9] flex items-center gap-3 hover:bg-[#ccf2ef] transition-colors"
                    onClick={async () => {
                      const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: clientSearch }) })
                      if (res.ok) { const c = await res.json(); setForm(f => ({ ...f, clientId: c.id, clientName: c.fullName })); setClientSearch(c.fullName); setShowClientDrop(false) }
                    }}>
                    <span className="w-5 h-5 rounded-full bg-[#198e85] text-white text-xs flex items-center justify-center font-bold shrink-0">+</span>
                    <span className="text-sm font-semibold text-[#136e67]">Crear "{clientSearch}"</span>
                  </button>
                </div>
              )}
            </div>
            {form.clientName && (
              <div className="mt-1.5 bg-[#f0faf9] border border-[#ccf2ef] rounded-xl px-3 py-1.5 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#198e85] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{form.clientName[0].toUpperCase()}</div>
                <p className="text-sm font-semibold text-[#0d5e59] truncate">{form.clientName}</p>
              </div>
            )}
          </div>

          {/* Título */}
          <div className="px-6 py-3 border-b border-slate-50">
            <p className={lbl}>Nombre del trabajo <span className="normal-case font-normal text-slate-300">(opcional)</span></p>
            <input className={inp} placeholder="Ej: Amoblamiento vestidor y 2 baños…"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>

          {/* Fechas + Variables en una fila */}
          <div className="px-6 py-3 border-b border-slate-50 grid grid-cols-5 gap-3 items-end">
            <div className="col-span-2">
              <p className={lbl}>Emisión</p>
              <input type="date" className={inp} value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <p className={lbl}>Vencimiento</p>
              <input type="date" className={inp} value={form.expirationDate} onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))} />
            </div>
            <div className="col-span-1" />
          </div>

          {/* Variables */}
          <div className="px-6 py-3 border-b border-slate-50">
            <p className={lbl}>Variables y Ajustes</p>
            <div className="flex gap-2">
              {[
                { label: 'Mano de obra', key: 'laborPercentage', suffix: '%' },
                { label: 'IVA', key: 'vatPercentage', suffix: '%' },
                { label: 'Descuento', key: 'discountAmount', suffix: '%' },
              ].map(({ label, key, suffix }) => (
                <div key={key} className="flex-1 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <div className="flex items-center gap-1">
                    <input type="number" className="w-full bg-transparent font-bold text-slate-800 outline-none text-sm"
                      placeholder="0" value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
                    <span className="text-xs font-bold text-slate-300">{suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observaciones */}
          <div className="px-6 py-3 border-b border-slate-50">
            <p className={lbl}>Observaciones <span className="normal-case font-normal text-slate-300">(opcional)</span></p>
            <textarea className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#198e85] focus:ring-4 focus:ring-[#198e85]/10 h-14 resize-none transition-all placeholder:text-slate-300"
              placeholder="Términos de pago, plazos, notas internas…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-slate-50/50 flex items-center justify-between">
            <button onClick={() => router.back()} className={btnGhost}>Cancelar</button>
            <button
              onClick={() => setStarted(true)}
              disabled={!form.clientId}
              className={btnPrimary}>
              Continuar → Agregar muebles
            </button>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Nuevo presupuesto</h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Definición de cotización y variables generales
            {autoSaveTs && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Borrador guardado
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.125rem' }}>Total estimado</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(globalTotal)}</p>
          </div>
          <button onClick={handleSave} disabled={!form.clientId || saving || items.length === 0} className={btnPrimary}>
            {saving ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ marginBottom: '1rem', padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: '0.8125rem', color: '#b91c1c', fontWeight: 500 }}>
          ⚠ {saveError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '268px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-5 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
          {/* Cliente */}
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <p className={lbl}>Cliente</p>
            <div className="relative">
              <input className={inp} placeholder="Buscar cliente…"
                value={form.clientName || clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); setForm(f => ({ ...f, clientId: '', clientName: '' })) }} />
              {showClientDrop && clientSearch.length > 1 && (
                <div className="absolute top-full mt-1 left-0 w-full bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                  {clients.map(c => (
                    <button key={c.id} className="w-full text-left px-4 py-3 hover:bg-[#f0faf9] border-b border-slate-50 last:border-0 transition-colors"
                      onClick={() => { setForm(f => ({ ...f, clientId: c.id, clientName: c.fullName })); setClientSearch(c.fullName); setShowClientDrop(false) }}>
                      <p className="text-sm font-semibold text-slate-900">{c.fullName}</p>
                      {c.businessName && <p className="text-[11px] text-slate-400 uppercase">{c.businessName}</p>}
                    </button>
                  ))}
                  <button className="w-full text-left px-4 py-3 bg-[#f0faf9] flex items-center gap-3 hover:bg-[#ccf2ef] transition-colors"
                    onClick={async () => {
                      const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: clientSearch }) })
                      if (res.ok) { const c = await res.json(); setForm(f => ({ ...f, clientId: c.id, clientName: c.fullName })); setClientSearch(c.fullName); setShowClientDrop(false) }
                    }}>
                    <span className="w-6 h-6 rounded-full bg-[#198e85] text-white text-xs flex items-center justify-center font-bold flexshrink-0">+</span>
                    <span className="text-sm font-semibold text-[#136e67]">Crear "{clientSearch}"</span>
                  </button>
                </div>
              )}
            </div>
            {form.clientName && (
              <div className="mt-2 bg-[#f0faf9] border border-[#ccf2ef] rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#198e85] text-white flex items-center justify-center text-xs font-bold shrink-0">{form.clientName[0].toUpperCase()}</div>
                <p className="text-sm font-semibold text-[#0d5e59] truncate">{form.clientName}</p>
              </div>
            )}
          </section>

          {/* Nombre del trabajo */}
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <p className={lbl}>Nombre del trabajo <span className="normal-case font-normal text-slate-300">(opcional)</span></p>
            <input className={inp} placeholder="Ej: Amoblamiento vestidor…"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </section>

          {/* Fechas */}
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <p className={lbl}>Emisión</p>
            <input type="date" className={inp} value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
            <div className="mt-5">
              <p className={lbl}>Vencimiento</p>
              <input type="date" className={inp} value={form.expirationDate} onChange={e => setForm(f => ({ ...f, expirationDate: e.target.value }))} />
            </div>
          </section>

          {/* Variables */}
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <p className={lbl}>Variables y Ajustes</p>
            <div className="space-y-2">
              {[
                { label: 'Mano de obra', key: 'laborPercentage', suffix: '%' },
                { label: 'IVA', key: 'vatPercentage', suffix: '%' },
                { label: 'Descuento', key: 'discountAmount', suffix: '%' },
              ].map(({ label, key, suffix }) => (
                <div key={key} className="flex items-center justify-between h-10 bg-slate-50/80 rounded-xl px-4 border border-transparent hover:border-slate-100 transition-colors">
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                  <div className="flex items-center gap-1">
                    <input type="number" className="w-14 bg-transparent text-right font-bold text-slate-800 outline-none text-xs"
                      placeholder="0"
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))} />
                    <span className="text-[10px] font-bold text-slate-300">{suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Observaciones */}
          <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <p className={lbl}>Observaciones</p>
            <textarea className="w-full bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#198e85] focus:ring-4 focus:ring-[#198e85]/10 h-28 resize-none transition-all shadow-sm placeholder:text-slate-300"
              placeholder="Términos de pago, plazos…"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </section>

          {/* Resumen */}
          {items.length > 0 && (
            <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6">
              <p className="text-[10px] font-black text-[#22b8ae] uppercase tracking-widest mb-4">Resumen del proyecto</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-400"><span>Materiales e insumos</span><span className="text-slate-200 tabular-nums">{fmt(globalSubtotal)}</span></div>
                <div className="flex justify-between text-xs font-medium text-slate-400"><span>Mano de obra ({form.laborPercentage}%)</span><span className="text-slate-200 tabular-nums">{fmt(labor)}</span></div>
              </div>
              <div className="mt-5 pt-5 border-t border-slate-800 flex justify-between items-end">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total final</span>
                <span className="text-2xl font-black text-white tabular-nums leading-none">{fmt(globalTotal)}</span>
              </div>
            </section>
          )}
        </aside>

        {/* ── MAIN CANVAS ──────────────────────────────────────────────────── */}
        <main style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ─ WIZARD ─────────────────────────────────────────────────── */}
            {wizardStep !== null && (
              <>
                {/* Step indicator */}
                <div className="flex items-center mb-4 overflow-x-auto pb-1 custom-scrollbar">
                  {STEPS.map((s, i) => {
                    const activeIdx = STEPS.indexOf(wizardStep)
                    const active = s === wizardStep
                    const done = activeIdx > i
                    return (
                      <div key={s} className="flex items-center flex-1 last:flex-none">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black border-2 transition-all duration-300
                            ${active ? 'bg-[#198e85] border-[#198e85] text-white shadow-lg shadow-[#ccf2ef]'
                              : done ? 'bg-[#f0faf9] border-[#ccf2ef] text-[#198e85]'
                              : 'bg-white border-slate-100 text-slate-300'}`}>
                            {done ? '✓' : i + 1}
                          </div>
                          <span className={`text-xs font-black uppercase tracking-wider whitespace-nowrap ${active ? 'text-slate-900' : 'text-slate-400'}`}>{STEP_LABELS[i]}</span>
                        </div>
                        {i < 3 && <div className={`flex-1 min-w-[30px] h-0.5 mx-6 rounded-full transition-colors duration-500 ${done ? 'bg-[#198e85]' : 'bg-slate-100'}`} />}
                      </div>
                    )
                  })}
                </div>

                {/* ── STEP 1: Tipo ────────────────────────────────────────── */}
                {wizardStep === 'type' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-slate-800">¿Qué mueble vas a presupuestar?</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Elegí el tipo o seleccionalo de la lista</p>
                      </div>
                      <button onClick={() => setWizardStep(null)} className={btnGhost}>Cancelar</button>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Select elegante */}
                      <select
                        className={sel + ' w-full'}
                        defaultValue=""
                        onChange={e => {
                          const ft = furnitureTypes.find(f => f.id === e.target.value)
                          if (ft) selectType(ft)
                        }}
                      >
                        <option value="" disabled>Seleccioná un tipo de mueble…</option>
                        {furnitureTypes.map(ft => (
                          <option key={ft.id} value={ft.id}>{ft.name}</option>
                        ))}
                      </select>
                      {/* O pills compactas */}
                      <div className="flex flex-wrap gap-2">
                        {furnitureTypes.map(ft => (
                          <button key={ft.id} onClick={() => selectType(ft)}
                            className="px-4 py-2 rounded-xl border border-slate-100 bg-slate-50 hover:border-[#198e85] hover:bg-[#f0faf9] hover:text-[#0d5e59] text-xs font-semibold text-slate-600 transition-all">
                            {ft.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Cortes ──────────────────────────────────────── */}
                {wizardStep === 'cuts' && draft && (
                  <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                    <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-black text-slate-900">{draft.name}</h2>
                        <p className="text-sm font-medium text-slate-400 mt-1">Definición de cortes y piezas individuales</p>
                      </div>
                      <button onClick={addCut} className={btnPrimary}>+ Agregar pieza</button>
                    </div>

                    <div className="divide-y divide-slate-50">
                      {draft.cuts.length === 0 && (
                        <div className="py-16 flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" /></svg>
                          </div>
                          <p className="text-sm font-medium text-slate-400">Sin cortes. Hacé clic en "+ Agregar corte"</p>
                        </div>
                      )}

                      {draft.cuts.map((cut, cIdx) => (
                        <div key={cIdx} className="px-6 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition-colors">
                          {/* Row 1: main fields */}
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-4">
                              <label className={lbl}><span className="text-slate-400 font-black">#{cIdx + 1}</span> Descripción</label>
                              <input className={inp} placeholder="Lateral, Estante…" value={cut.description}
                                onChange={e => updateCut(cIdx, { description: e.target.value })} />
                            </div>
                            <div className="col-span-4">
                              <label className={lbl}>Material / Placa</label>
                              <MaterialCombobox options={placaMats} value={cut.materialId} onChange={(v: string) => updateCut(cIdx, { materialId: v })} placeholder="Seleccionar…" className={sel} section="CORTES" onCreated={refreshMaterials} />
                            </div>
                            <div className="col-span-1">
                              <label className={lbl}>Cant.</label>
                              <input type="number" min={1} className={numInp} value={cut.quantity}
                                onChange={e => updateCut(cIdx, { quantity: parseInt(e.target.value) || 1 })} />
                            </div>
                            <div className="col-span-1">
                              <label className={lbl}>Ancho</label>
                              <input type="number" className={numInp} placeholder="mm" value={cut.width === 0 ? '' : cut.width}
                                onChange={e => updateCut(cIdx, { width: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="col-span-1">
                              <label className={lbl}>Alto</label>
                              <input type="number" className={numInp} placeholder="mm" value={cut.height === 0 ? '' : cut.height}
                                onChange={e => updateCut(cIdx, { height: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="col-span-1 flex flex-col justify-end">
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">{((cut.width * cut.height) / 1e6 * cut.quantity).toFixed(3)} m²</span>
                              <span className="text-xs font-black text-[#198e85] tabular-nums">{fmt(calcCut(cut))}</span>
                            </div>
                          </div>
                          {/* Row 2: cantos */}
                          <div className="grid grid-cols-12 gap-2 items-center mt-2">
                            <div className="col-span-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cantos</span>
                            </div>
                            <div className="col-span-3 flex gap-2">
                              {[['TOP','Sup'],['BOTTOM','Inf'],['LEFT','Izq'],['RIGHT','Der']].map(([side, label]) => (
                                <button key={side} onClick={() => toggleEdge(cIdx, side)}
                                  className={sideBtn(cut.edgeBands.some(eb => eb.side === side))}
                                  style={{ flex: 1 }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                            <div className="col-span-4">
                              <MaterialCombobox options={cantoMats} value={cut.edgeBandMaterialId} onChange={(v: string) => setEdgeMat(cIdx, v)}
                                placeholder="Material de canto…"
                                className={sel} hasError={cut.edgeBands.length > 0 && !cut.edgeBandMaterialId} section="CANTO" onCreated={refreshMaterials} />
                            </div>
                            <div className="col-span-4 flex justify-end">
                              <button onClick={() => removeCut(cIdx)} className="text-xs font-bold text-red-300 hover:text-red-500 transition-colors flex items-center gap-1">
                                Eliminar pieza ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-10 py-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <button onClick={() => setWizardStep('type')} className={btnGhost}>← Volver</button>
                      <div className="flex items-center gap-8">
                        {draft.cuts.length > 0 && (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subtotal piezas</p>
                            <p className="text-xl font-black text-[#198e85] tabular-nums">{fmt(draftSubtotal)}</p>
                          </div>
                        )}
                        <button onClick={() => {
                          const missing = draft.cuts.some(c => c.edgeBands.length > 0 && !c.edgeBandMaterialId)
                          if (missing) { alert('Hay piezas con cantos seleccionados pero sin material de canto asignado.'); return }
                          setWizardStep('hardware')
                        }} className={btnDark}>Continuar a Herrajes →</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Herrajes ────────────────────────────────────── */}
                {wizardStep === 'hardware' && draft && (
                  <div className="card">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900">{draft.name} — Herrajes</h2>
                        <p className="text-sm text-slate-400 mt-0.5">Bisagras, correderas y accesorios</p>
                      </div>
                      <button onClick={addAcc} className={btnDark}>+ Agregar herraje</button>
                    </div>

                    <div className="px-8 py-6 space-y-3 min-h-[160px]">
                      {draft.accessories.length === 0 && (
                        <div className="py-14 flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                          <p className="text-sm font-medium text-slate-400">Sin herrajes — podés dejarlo vacío</p>
                        </div>
                      )}
                      {draft.accessories.map((acc, aIdx) => (
                        <div key={aIdx} className="grid grid-cols-12 gap-4 items-end bg-slate-50 rounded-xl px-5 py-4 border border-slate-100">
                          <div className="col-span-3">
                            <label className={lbl}>Descripción</label>
                            <input className={inp} value={acc.description} onChange={e => updateAcc(aIdx, { description: e.target.value })} />
                          </div>
                          <div className="col-span-6">
                            <label className={lbl}>Material / Herraje</label>
                            <MaterialCombobox options={herrajeMats} value={acc.materialId} onChange={(v: string) => updateAcc(aIdx, { materialId: v })} className={sel} section="HERRAJES" onCreated={refreshMaterials} />
                          </div>
                          <div className="col-span-2">
                            <label className={lbl}>Cantidad</label>
                            <input type="number" min={1} className={numInp} value={acc.quantity} onChange={e => updateAcc(aIdx, { quantity: parseInt(e.target.value) || 1 })} />
                          </div>
                          <div className="col-span-1 flex justify-end items-end">
                            <button onClick={() => removeAcc(aIdx)} className={btnDanger}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/60">
                      <button onClick={() => setWizardStep('cuts')} className={btnGhost}>← Volver a Cortes</button>
                      <button onClick={() => setWizardStep('additionals')} className={btnDark}>Continuar a Adicionales →</button>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: Adicionales ─────────────────────────────────── */}
                {wizardStep === 'additionals' && draft && (
                  <div className="card">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900">{draft.name} — Adicionales</h2>
                        <p className="text-sm text-slate-400 mt-0.5">Tacho de basura, mesada, instalación, etc.</p>
                      </div>
                      <button onClick={addAdditional} className={btnDark}>+ Agregar adicional</button>
                    </div>

                    <div className="px-8 py-6 space-y-3 min-h-[160px]">
                      {draft.additionals.length === 0 && (
                        <div className="py-14 flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                          </div>
                          <p className="text-sm font-medium text-slate-400">Sin adicionales — podés dejarlo vacío</p>
                        </div>
                      )}
                      {draft.additionals.map((add, aIdx) => (
                        <div key={aIdx} className="bg-slate-50 rounded-xl px-5 py-4 border border-slate-100 space-y-3">
                          {/* Mode toggle */}
                          <div className="flex gap-2">
                            {(['calc', 'fixed'] as const).map(mode => (
                              <button key={mode} type="button" onClick={() => updateAdditional(aIdx, { priceMode: mode })}
                                style={{ flex: 1, height: '1.875rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '0.625rem', border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
                                  background: add.priceMode === mode ? '#198e85' : 'white',
                                  borderColor: add.priceMode === mode ? '#198e85' : '#e2e8f0',
                                  color: add.priceMode === mode ? 'white' : '#94a3b8' }}>
                                {mode === 'calc' ? 'Material × cant.' : 'Precio fijo'}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-12 gap-4 items-end">
                            <div className="col-span-3">
                              <label className={lbl}>Descripción</label>
                              <input className={inp} placeholder="Ej: Tacho de basura" value={add.description} onChange={e => updateAdditional(aIdx, { description: e.target.value })} />
                            </div>
                            {add.priceMode === 'calc' ? (
                              <>
                                <div className="col-span-5">
                                  <label className={lbl}>Material / Ítem</label>
                                  <MaterialCombobox options={additionalMats} value={add.materialId} onChange={(v: string) => updateAdditional(aIdx, { materialId: v })} className={sel} section="ADICIONALES" onCreated={refreshMaterials} />
                                </div>
                                <div className="col-span-2">
                                  <label className={lbl}>Cantidad</label>
                                  <input type="number" min={1} className={numInp} value={add.quantity} onChange={e => updateAdditional(aIdx, { quantity: parseInt(e.target.value) || 1 })} />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="col-span-4">
                                  <label className={lbl}>Material (opcional)</label>
                                  <MaterialCombobox options={additionalMats} value={add.materialId} onChange={(v: string) => updateAdditional(aIdx, { materialId: v })} className={sel} section="ADICIONALES" onCreated={refreshMaterials} />
                                </div>
                                <div className="col-span-3">
                                  <label className={lbl}>Precio total $</label>
                                  <input type="number" min={0} className={numInp} placeholder="0.00" value={add.manualPrice || ''} onChange={e => updateAdditional(aIdx, { manualPrice: parseFloat(e.target.value) || 0 })} />
                                </div>
                              </>
                            )}
                            <div className="col-span-1 flex flex-col items-center gap-1">
                              <label className={lbl + ' text-center'}>PDF</label>
                              <button
                                onClick={() => updateAdditional(aIdx, { showPrice: !add.showPrice })}
                                title={add.showPrice ? 'Precio visible en PDF' : 'Precio oculto en PDF'}
                                style={{ width: 30, height: 30, borderRadius: '0.5rem', background: 'none', border: '1.5px solid', borderColor: add.showPrice ? '#198e85' : '#e2e8f0', color: add.showPrice ? '#198e85' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                {add.showPrice ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
                              </button>
                            </div>
                            <div className="col-span-1 flex justify-end items-end">
                              <button onClick={() => removeAdditional(aIdx)} className={btnDanger}>×</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/60">
                      <button onClick={() => setWizardStep('hardware')} className={btnGhost}>← Volver a Herrajes</button>
                      <button onClick={() => setWizardStep('confirm')} className={btnDark}>Revisar y Confirmar →</button>
                    </div>
                  </div>
                )}

                {/* ── STEP 5: Confirmar ───────────────────────────────────── */}
                {wizardStep === 'confirm' && draft && (
                  <div className="card">
                    <div className="px-8 py-6 border-b border-slate-100">
                      <h2 className="text-xl font-black text-slate-900">Confirmar mueble</h2>
                      <p className="text-sm text-slate-400 mt-0.5">Revisá el resumen antes de agregar</p>
                    </div>

                    <div className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Tipo de mueble</p>
                          <p className="text-2xl font-black text-slate-900">{draft.name}</p>
                        </div>
                        <div className="bg-[#f0faf9] border border-[#ccf2ef] rounded-xl p-5">
                          <p className="text-[11px] font-semibold text-[#198e85] uppercase tracking-widest mb-2">Subtotal estimado</p>
                          <p className="text-2xl font-black text-[#136e67] tabular-nums">{fmt(calcItem(draft))}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Cortes ({draft.cuts.length})</p>
                          <div className="space-y-2">
                            {draft.cuts.map((c, i) => (
                              <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{c.description}</p>
                                  <p className="text-xs text-slate-400 tabular-nums">{c.width} × {c.height} mm · ×{c.quantity}</p>
                                </div>
                                <span className="text-xs font-medium text-slate-400">{c.edgeBands.length} canto{c.edgeBands.length !== 1 ? 's' : ''}</span>
                              </div>
                            ))}
                            {draft.cuts.length === 0 && <p className="text-sm text-slate-300 italic">Sin cortes</p>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Herrajes ({draft.accessories.length})</p>
                          <div className="space-y-2">
                            {draft.accessories.map((a, i) => (
                              <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                <p className="text-sm font-semibold text-slate-900">{a.description}</p>
                                <span className="text-xs font-medium text-slate-400">×{a.quantity}</span>
                              </div>
                            ))}
                            {draft.accessories.length === 0 && <p className="text-sm text-slate-300 italic">Sin herrajes</p>}
                          </div>
                        </div>
                      </div>
                      {draft.additionals.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Adicionales ({draft.additionals.length})</p>
                          <div className="grid grid-cols-2 gap-2">
                            {draft.additionals.map((a, i) => {
                              const mat = materials.find(m => m.id === a.materialId)
                              return (
                                <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                  <p className="text-sm font-semibold text-slate-900">{mat?.name ?? a.description ?? '—'}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-400">×{a.quantity}</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: a.showPrice ? '#f0faf9' : 'transparent', color: a.showPrice ? '#198e85' : '#94a3b8' }}>
                                      {a.showPrice ? 'precio visible' : 'precio oculto'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                      <button onClick={() => setWizardStep('additionals')} className={btnGhost}>← Volver</button>
                      <div className="flex items-center gap-3">
                        <button onClick={confirmItem} className={btnDark}>Guardar y terminar</button>
                        <button onClick={addAnother} className={btnPrimary}>+ Agregar otro mueble</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─ NO WIZARD: lista de muebles ────────────────────────────── */}
            {wizardStep === null && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Cuerpos del presupuesto</h2>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      {items.length === 0 ? 'No hay módulos agregados todavía' : `Total de ${items.length} módulo${items.length > 1 ? 's' : ''} configurados`}
                    </p>
                  </div>
                  <button onClick={() => setWizardStep('type')} className={btnPrimary}>+ Agregar mueble</button>
                </div>

                {items.length === 0 && (
                  <button onClick={() => setWizardStep('type')}
                    className="w-full py-24 rounded-[2rem] border-2 border-dashed border-slate-100 hover:border-[#198e85] hover:bg-slate-50/50 transition-all flex flex-col items-center gap-4 group bg-white shadow-sm">
                    <div className="w-16 h-16 rounded-3xl bg-[#f0faf9] flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                      <svg className="w-8 h-8 text-[#198e85]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <div className="text-center">
                       <p className="text-base font-bold text-slate-700">Comenzar presupuesto</p>
                       <p className="text-xs font-medium text-slate-400 mt-1">Definí el primer mueble del proyecto haciendo clic aquí</p>
                    </div>
                  </button>
                )}

                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group">
                      <div className="px-8 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                           <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                              <FurnitureIcon />
                           </div>
                           <div>
                              <h3 className="text-base font-bold text-slate-800 group-hover:text-[#198e85] transition-colors">{item.name}</h3>
                              <div className="flex gap-4 mt-0.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.cuts.length} piezas</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.accessories.length} herrajes</span>
                                {item.additionals.length > 0 && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.additionals.length} adicionales</span>}
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest tabular-nums">{item.cuts.reduce((a, c) => a + (c.width * c.height / 1e6 * c.quantity), 0).toFixed(2)} m²</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <p className="text-xl font-bold text-[#198e85] tabular-nums">{fmt(calcItem(item))}</p>
                          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-200 hover:text-red-400 transition-colors p-2">
                             ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  )
}

function MaterialCombobox({ options, value, onChange, placeholder, className, hasError, section, onCreated }: {
  options: { id: string; name: string }[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  hasError?: boolean
  section?: string
  onCreated?: () => void
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
  const [units, setUnits] = useState<{ id: string; code: string; name: string }[]>([])
  const [createSaving, setCreateSaving] = useState(false)

  useEffect(() => {
    function handle(e: MouseEvent) {
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
    if (res.ok) { setCreating(false); onCreated?.(); onChange(mat.id) }
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          className={className}
          style={{
            textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            ...(hasError ? { borderColor: '#ef4444' } : {}),
          }}
          onClick={handleOpen}
        >
          <span style={{ color: selected ? undefined : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.name : (placeholder ?? 'Seleccionar…')}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginLeft: 4, opacity: 0.4 }}><path d="M6 9l6 6 6-6"/></svg>
        </button>

        {open && dropPos && (
          <div ref={dropRef} style={{
            position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999,
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.875rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
          }}>
            <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <input
                ref={inputRef}
                style={{ width: '100%', height: '2rem', padding: '0 0.625rem', fontSize: '0.8125rem', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', outline: 'none', boxSizing: 'border-box' }}
                placeholder="Buscar…"
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {value && (
                <button type="button" style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'block' }}
                  onClick={() => { onChange(''); setOpen(false); setQ('') }}>
                  — Ninguno
                </button>
              )}
              {filtered.length === 0
                ? <p style={{ padding: '0.875rem', fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'center' }}>Sin resultados</p>
                : filtered.map(m => (
                  <button key={m.id} type="button"
                    style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: m.id === value ? 600 : 400, color: m.id === value ? '#198e85' : '#1e293b', background: m.id === value ? '#f0faf9' : 'none', border: 'none', cursor: 'pointer', display: 'block' }}
                    onClick={() => { onChange(m.id); setOpen(false); setQ('') }}>
                    {m.name}
                  </button>
                ))
              }
              {section && (
                <button type="button" onClick={openCreate}
                  style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: '#198e85', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer', display: 'block' }}>
                  + Crear{q ? ` "${q}"` : ' nuevo'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {creating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCreating(false)}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Nuevo material</h3>
              <button type="button" onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Nombre</label>
                <input autoFocus style={{ width: '100%', height: '2.75rem', padding: '0 1rem', fontSize: '0.875rem', color: '#1e293b', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', outline: 'none', boxSizing: 'border-box' }}
                  value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Nombre del material…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Costo unitario</label>
                  <input type="number" style={{ width: '100%', height: '2.75rem', padding: '0 1rem', fontSize: '0.875rem', color: '#1e293b', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="0.00" value={createCost} onChange={e => setCreateCost(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Unidad</label>
                  <select style={{ width: '100%', height: '2.75rem', padding: '0 1rem', fontSize: '0.875rem', color: '#1e293b', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', outline: 'none', boxSizing: 'border-box' }}
                    value={createUnitId} onChange={e => setCreateUnitId(e.target.value)}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.code})</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" onClick={() => setCreating(false)} style={{ height: '2.5rem', padding: '0 1.25rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={handleCreate} disabled={createSaving || !createName || !createUnitId}
                style={{ height: '2.5rem', padding: '0 1.25rem', fontSize: '0.875rem', fontWeight: 600, color: 'white', background: createSaving || !createName || !createUnitId ? '#94a3b8' : '#198e85', border: 'none', borderRadius: '0.75rem', cursor: createSaving ? 'wait' : 'pointer' }}>
                {createSaving ? 'Guardando…' : 'Crear material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FurnitureIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  )
}
function EyeIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
