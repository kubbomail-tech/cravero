import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { quoteSchema } from '@/lib/validations'
import { toNumber, calculateCutCost, getNextQuoteNumber, recalcQuoteFinancials } from '@/lib/calculations'
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
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { items, ...quoteData } = parsed.data

  try {
  return await prisma.$transaction(async (tx) => {
    // 1. Prepare Quote Number — use last existing number to avoid gaps from deletions
    const quoteNumber = await getNextQuoteNumber(tx)

    // 2. Fetch all materials needed for snapshots
    const materialIds = new Set<string>()
    items.forEach(item => {
      item.cuts?.forEach(cut => {
        if (cut.materialId) materialIds.add(cut.materialId)
        cut.edgeBands?.forEach(eb => { if (eb.materialId) materialIds.add(eb.materialId) })
      })
      item.accessories?.forEach(acc => { if (acc.materialId) materialIds.add(acc.materialId) })
      item.additionals?.forEach(add => { if (add.materialId) materialIds.add(add.materialId) })
    })

    const materials = await tx.material.findMany({
      where: { id: { in: Array.from(materialIds) } }
    })
    const matMap = new Map(materials.map(m => [m.id, m]))

    // 3. Process Items and calculate totals
    let quoteSubtotalMaterials = 0
    let quoteSubtotalAdditionals = 0

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
            materialId: eb.materialId || null,
            materialNameSnapshot: eMat?.name,
            materialUnitCostSnapshot: eUnitCost,
            length,
            quantity: eb.quantity,
            totalLength,
            subtotalCost,
          }
        })

        return {
          materialId: cut.materialId || null,
          materialNameSnapshot: mat?.name,
          materialUnitCostSnapshot: unitCost,
          description: cut.description,
          width: cut.width,
          height: cut.height,
          quantity: cut.quantity,
          areaPerUnit: calc.areaPerUnit,
          totalArea: calc.totalArea,
          subtotalCost: calc.subtotalCost,
          showInPdf: cut.showInPdf ?? false,
          edgeBands: { create: edgeBandsToCreate }
        }
      })

      const accToCreate = (item.accessories || []).map(acc => {
        const mat = acc.materialId ? matMap.get(acc.materialId) : null
        const unitCost = mat ? toNumber(mat.unitCost) : 0
        const subtotalCost = unitCost * acc.quantity

        itemSubtotalHardware += subtotalCost

        return {
          materialId: acc.materialId || null,
          materialNameSnapshot: mat?.name,
          materialUnitCostSnapshot: unitCost,
          description: acc.description,
          quantity: acc.quantity,
          subtotalCost,
        }
      })

      let itemSubtotalAdditionals = 0
      const addToCreate = (item.additionals || []).map(add => {
        const mat = add.materialId ? matMap.get(add.materialId) : null
        const unitCost = mat ? toNumber(mat.unitCost) : 0
        const subtotalCost = add.manualPrice != null ? add.manualPrice : unitCost * add.quantity

        itemSubtotalAdditionals += subtotalCost

        return {
          materialId: add.materialId || null,
          materialNameSnapshot: mat?.name,
          materialUnitCostSnapshot: unitCost,
          description: add.description,
          quantity: add.quantity,
          subtotalCost,
          showPrice: add.showPrice ?? true,
        }
      })

      quoteSubtotalMaterials += (itemSubtotalMaterials + itemSubtotalHardware)
      quoteSubtotalAdditionals += itemSubtotalAdditionals

      return {
        furnitureTypeId: item.furnitureTypeId,
        description: item.description,
        quantity: item.quantity || 1,
        subtotalMaterials: itemSubtotalMaterials,
        subtotalHardware: itemSubtotalHardware,
        subtotalAdditionals: itemSubtotalAdditionals,
        subtotalTotal: itemSubtotalMaterials + itemSubtotalHardware + itemSubtotalAdditionals,
        cuts: { create: cutsToCreate },
        accessories: { create: accToCreate },
        additionals: { create: addToCreate },
      }
    })

    // 4. Final Quote Totals — additionals excluded from labor base and discount
    const financials = recalcQuoteFinancials({
      subtotalMaterials: quoteSubtotalMaterials,
      subtotalAdditionals: quoteSubtotalAdditionals,
      laborPercentage: toNumber(quoteData.laborPercentage),
      vatPercentage: toNumber(quoteData.vatPercentage),
      discountAmount: toNumber(quoteData.discountAmount),
    })

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        title: quoteData.title,
        clientId: quoteData.clientId,
        issueDate: new Date(quoteData.issueDate),
        expirationDate: quoteData.expirationDate ? new Date(quoteData.expirationDate) : null,
        laborPercentage: quoteData.laborPercentage,
        vatPercentage: quoteData.vatPercentage,
        discountAmount: quoteData.discountAmount,
        paymentTerms: quoteData.paymentTerms,
        notes: quoteData.notes,
        subtotalMaterials: quoteSubtotalMaterials,
        subtotalAdditionals: quoteSubtotalAdditionals,
        ...financials,
        createdBy: (session.user as any).id,
        items: { create: itemsToCreate }
      },
      include: { client: true }
    })

    return NextResponse.json(quote, { status: 201 })
  })
  } catch (error) {
    console.error('[POST /api/quotes]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
