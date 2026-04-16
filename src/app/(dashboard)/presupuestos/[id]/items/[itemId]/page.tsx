'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Material = { id: string; name: string; unitCost: number; category: string }
type Cut = { id: string; materialId: string; width: number; height: number; quantity: number; description: string; subtotalCost: number }
type Accessory = { id: string; materialId: string; quantity: number; description: string; subtotalCost: number }

export default function QuoteItemDetailPage({ params }: { params: Promise<{ id: string, itemId: string }> }) {
  const router = useRouter()
  const [ids, setIds] = useState<{ id: string, itemId: string } | null>(null)
  const [item, setItem] = useState<any>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { params.then(setIds) }, [params])

  const fetchData = useCallback(async () => {
    if (!ids) return
    setLoading(true)
    const [iRes, mRes] = await Promise.all([
      fetch(`/api/quotes/${ids.id}/items/${ids.itemId}`),
      fetch('/api/materials?isActive=true')
    ])
    setItem(await iRes.json())
    setMaterials(await mRes.json())
    setLoading(false)
  }, [ids])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading || !item) return <div className="p-20 text-center text-gray-400">Cargando detalle del mueble...</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-6">
          <Link href={`/presupuestos/${ids?.id}`} className="p-3 rounded-full bg-white border border-gray-100 text-gray-400 hover:text-primary hover:border-primary transition-all shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{item.furnitureType?.name || 'Mueble'}</h1>
            <p className="text-gray-500">{item.description || 'Sin descripción'}</p>
          </div>
        </div>
        <div className="bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20">
          Subtotal: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(item.subtotalTotal)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        
        {/* SECCION CORTES */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-light/50 text-primary flex items-center justify-center text-sm">📏</span>
              Lista de Cortes (Canteado incluido)
            </h3>
            <button className="btn btn-primary btn-sm">+ Agregar corte</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Pieza / Descripción</th>
                  <th className="px-6 py-4">Material</th>
                  <th className="px-6 py-4">Medidas (mm)</th>
                  <th className="px-6 py-4 text-center">Cant.</th>
                  <th className="px-6 py-4 text-right">Subtotal</th>
                  <th className="px-8 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {item.cuts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">No hay cortes cargados aún.</td>
                  </tr>
                ) : item.cuts.map((cut: any) => (
                  <tr key={cut.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-5 font-medium text-gray-900">{cut.description}</td>
                    <td className="px-6 py-5 text-sm text-gray-500">{cut.materialNameSnapshot}</td>
                    <td className="px-6 py-5 font-mono text-sm">{cut.width} x {cut.height}</td>
                    <td className="px-6 py-5 text-center font-bold">{cut.quantity}</td>
                    <td className="px-6 py-5 text-right font-bold text-primary">
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cut.subtotalCost)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-gray-300 hover:text-red-500 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECCION HERRAJES */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-primary-light/50 text-primary flex items-center justify-center text-sm">🔩</span>
              Herrajes y Accesorios
            </h3>
            <button className="btn btn-secondary-outline btn-sm">+ Agregar accesorio</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-8 py-4">Descripción</th>
                  <th className="px-6 py-4">Material / Marca</th>
                  <th className="px-6 py-4 text-center">Cant.</th>
                  <th className="px-6 py-4 text-right">Subtotal</th>
                  <th className="px-8 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {item.accessories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-gray-400 italic">No hay accesorios cargados.</td>
                  </tr>
                ) : item.accessories.map((acc: any) => (
                  <tr key={acc.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-5 font-medium text-gray-900">{acc.description}</td>
                    <td className="px-6 py-5 text-sm text-gray-500">{acc.materialNameSnapshot}</td>
                    <td className="px-6 py-5 text-center font-bold">{acc.quantity}</td>
                    <td className="px-6 py-5 text-right font-bold text-primary">
                      {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(acc.subtotalCost)}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-gray-300 hover:text-red-500 transition-colors">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
