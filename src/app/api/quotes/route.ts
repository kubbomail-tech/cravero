import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { quoteSchema } from '@/lib/validations'
import { generateQuoteNumber, toNumber, calculateCutCost } from '@/lib/calculations'
import { QuoteStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''

  const quotes = await prisma.quote.findMany({
    where: {
      ...(status ? { status: status as QuoteStatus } : {}),
      ...(search ? {
        OR: [
          { quoteNumber: { contains: search, mode: 'insensitive' } },
          { client: { fullName: { contains: search, mode: 'insensitive' } } },
          { client: { businessName: { contains: search, mode: 'insensitive' } } },
        ]
      } : {})
    },
    include: { client: { select: { id: true, fullName: true, businessName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = quoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, ...quoteData } = parsed.data

  return await prisma.$transaction(async (tx) => {
    // 1. Prepare Quote Number
    const count = await tx.quote.count()
    const quoteNumber = generateQuoteNumber(count)

    // 2. Fetch all materials needed for snapshots
    const materialIds = new Set<string>()
    items.forEach(item => {
      item.cuts?.forEach(cut => {
        if (cut.materialId) materialIds.add(cut.materialId)
        cut.edgeBands?.forEach(eb => { if (eb.materialId) materialIds.add(eb.materialId) })
      })
      item.accessories?.forEach(acc => { if (acc.materialId) materialIds.add(acc.materialId) })
    })

    const materials = await tx.material.findMany({
      where: { id: { in: Array.from(materialIds) } }
    })
    const matMap = new Map(materials.map(m => [m.id, m]))

    // 3. Process Items and calculate totals
    let quoteSubtotalMaterials = 0

    const itemsToCreate = items.map(item => {
      let itemSubtotalMaterials = 0
      let itemSubtotalHardware = 0

      const cutsToCreate = (item.cuts || []).map(cut => {
        const mat = cut.materialId ? matMap.get(cut.materialId) : null
        const unitCost = mat ? toNumber(mat.unitCost) : 0
        const calc = calculateCutCost({ 
          width: cut.width, 
          height: cut.height, 
          quantity: cut.quantity, 
          unitCost 
        })

        itemSubtotalMaterials += calc.subtotalCost

        const edgeBandsToCreate = (cut.edgeBands || []).map(eb => {
          const eMat = eb.materialId ? matMap.get(eb.materialId) : null
          const eUnitCost = eMat ? toNumber(eMat.unitCost) : 0
          const isHorizontal = eb.side === 'TOP' || eb.side === 'BOTTOM'
          const length = isHorizontal ? cut.width : cut.height
          const totalLength = (length / 1000) * eb.quantity
          const subtotalCost = totalLength * eUnitCost

          itemSubtotalMaterials += subtotalCost

          return {
            side: eb.side,
            materialId: eb.materialId,
            materialNameSnapshot: eMat?.name,
            materialUnitCostSnapshot: eUnitCost,
            length,
            quantity: eb.quantity,
            totalLength,
            subtotalCost,
          }
        })

        return {
          materialId: cut.materialId,
          materialNameSnapshot: mat?.name,
          materialUnitCostSnapshot: unitCost,
          description: cut.description,
          width: cut.width,
          height: cut.height,
          quantity: cut.quantity,
          areaPerUnit: calc.areaPerUnit,
          totalArea: calc.totalArea,
          subtotalCost: calc.subtotalCost,
          edgeBands: { create: edgeBandsToCreate }
        }
      })

      const accToCreate = (item.accessories || []).map(acc => {
        const mat = acc.materialId ? matMap.get(acc.materialId) : null
        const unitCost = mat ? toNumber(mat.unitCost) : 0
        const subtotalCost = unitCost * acc.quantity

        itemSubtotalHardware += subtotalCost

        return {
          materialId: acc.materialId,
          materialNameSnapshot: mat?.name,
          materialUnitCostSnapshot: unitCost,
          description: acc.description,
          quantity: acc.quantity,
          subtotalCost,
        }
      })

      quoteSubtotalMaterials += (itemSubtotalMaterials + itemSubtotalHardware)

      return {
        furnitureTypeId: item.furnitureTypeId,
        description: item.description,
        quantity: item.quantity || 1,
        subtotalMaterials: itemSubtotalMaterials,
        subtotalHardware: itemSubtotalHardware,
        subtotalTotal: itemSubtotalMaterials + itemSubtotalHardware,
        cuts: { create: cutsToCreate },
        accessories: { create: accToCreate }
      }
    })

    // 4. Final Quote Totals
    const labor = quoteSubtotalMaterials * (toNumber(quoteData.laborPercentage) / 100)
    const beforeTax = quoteSubtotalMaterials + labor - toNumber(quoteData.discountAmount)
    const vat = beforeTax * (toNumber(quoteData.vatPercentage) / 100)
    const total = beforeTax + vat

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        clientId: quoteData.clientId,
        issueDate: new Date(quoteData.issueDate),
        expirationDate: quoteData.expirationDate ? new Date(quoteData.expirationDate) : null,
        laborPercentage: quoteData.laborPercentage,
        vatPercentage: quoteData.vatPercentage,
        discountAmount: quoteData.discountAmount,
        paymentTerms: quoteData.paymentTerms,
        notes: quoteData.notes,
        subtotalMaterials: quoteSubtotalMaterials,
        subtotalLabor: labor,
        subtotalBeforeTax: beforeTax,
        vatAmount: vat,
        totalAmount: total,
        createdBy: (session.user as any).id,
        items: { create: itemsToCreate }
      },
      include: { client: true }
    })

    return NextResponse.json(quote, { status: 201 })
  })
}
