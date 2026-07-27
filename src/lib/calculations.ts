import type { Decimal } from '@prisma/client/runtime/library'
import type { Prisma, PrismaClient } from '@prisma/client'

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

// Uses the last existing quote number for the current year (instead of a row
// count) so deleted quotes don't leave gaps that collide with reused numbers.
export async function getNextQuoteNumber(tx: PrismaClient | Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const lastQuote = await tx.quote.findFirst({
    where: { quoteNumber: { startsWith: `P-${year}-` } },
    orderBy: { quoteNumber: 'desc' },
    select: { quoteNumber: true },
  })
  const nextSeq = lastQuote ? parseInt(lastQuote.quoteNumber.split('-')[2]) + 1 : 1
  return `P-${year}-${String(nextSeq).padStart(4, '0')}`
}

export function recalcQuoteFinancials(params: {
  subtotalMaterials: number
  subtotalAdditionals: number
  laborPercentage: number
  vatPercentage: number
  discountAmount: number
}) {
  const labor = params.subtotalMaterials * (params.laborPercentage / 100)
  const discountableBase = params.subtotalMaterials + labor
  const discountDollar = discountableBase * (params.discountAmount / 100)
  const afterDiscount = discountableBase - discountDollar
  const beforeTax = afterDiscount + params.subtotalAdditionals
  const vat = beforeTax * (params.vatPercentage / 100)

  return {
    subtotalLabor: labor,
    subtotalBeforeTax: beforeTax,
    vatAmount: vat,
    totalAmount: beforeTax + vat,
  }
}
