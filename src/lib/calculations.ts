import type { Decimal } from '@/generated/prisma/runtime/library'

export function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return parseFloat(value.toString())
}

export function formatCurrency(value: number | Decimal | null | undefined): string {
  const num = toNumber(value)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(num)
}

export function calculateQuoteTotals(params: {
  cuts: Array<{ subtotalCost: number }>
  edgeBands?: Array<{ subtotalCost: number }>
  accessories: Array<{ subtotalCost: number }>
  laborPercentage: number
  vatPercentage: number
  discountAmount: number
}) {
  const cutsCost = params.cuts.reduce((a, c) => a + c.subtotalCost, 0)
  const edgeCost = (params.edgeBands ?? []).reduce((a, c) => a + c.subtotalCost, 0)
  const accessoriesCost = params.accessories.reduce((a, c) => a + c.subtotalCost, 0)

  const subtotalMaterials = cutsCost + edgeCost + accessoriesCost
  const laborAmount = subtotalMaterials * (params.laborPercentage / 100)
  const subtotalBeforeTax = subtotalMaterials + laborAmount - params.discountAmount
  const vatAmount = subtotalBeforeTax * (params.vatPercentage / 100)
  const totalAmount = subtotalBeforeTax + vatAmount

  return {
    subtotalMaterials,
    laborAmount,
    subtotalBeforeTax,
    vatAmount,
    totalAmount,
  }
}

export function calculateCutCost(params: {
  width: number  // mm
  height: number // mm
  quantity: number
  unitCost: number // per m2
}): {
  areaPerUnit: number
  totalArea: number
  subtotalCost: number
} {
  const areaPerUnit = (params.width / 1000) * (params.height / 1000)
  const totalArea = areaPerUnit * params.quantity
  const subtotalCost = totalArea * params.unitCost

  return { areaPerUnit, totalArea, subtotalCost }
}

export function calculateEdgeBandCost(params: {
  length: number   // mm (width or height of the cut)
  quantity: number
  unitCost: number // per ML
}): {
  totalLength: number
  subtotalCost: number
} {
  const totalLength = (params.length / 1000) * params.quantity // convert to meters
  const subtotalCost = totalLength * params.unitCost
  return { totalLength, subtotalCost }
}

export function generateQuoteNumber(count: number): string {
  const year = new Date().getFullYear()
  const padded = String(count + 1).padStart(4, '0')
  return `P-${year}-${padded}`
}
