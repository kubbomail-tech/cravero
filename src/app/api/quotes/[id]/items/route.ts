import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { calculateCutCost, calculateEdgeBandCost, toNumber } from '@/lib/calculations'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId } = await ctx.params
  const body = await req.json()

  const { furnitureTypeId, description, quantity, notes, cuts, accessories } = body

  // Create item in transaction
  const item = await prisma.$transaction(async tx => {
    const item = await tx.quoteItem.create({
      data: {
        quoteId,
        furnitureTypeId: furnitureTypeId || null,
        description,
        quantity: quantity ?? 1,
        notes,
      },
    })

    let subtotalMaterials = 0
    let subtotalHardware = 0

    // Create cuts
    for (const cut of (cuts ?? [])) {
      let unitCost = 0
      let materialNameSnapshot = null
      let materialUnitCostSnapshot = null

      if (cut.materialId) {
        const mat = await tx.material.findUnique({ where: { id: cut.materialId } })
        if (mat) {
          unitCost = toNumber(mat.unitCost)
          materialNameSnapshot = mat.name
          materialUnitCostSnapshot = unitCost
        }
      }

      const { areaPerUnit, totalArea, subtotalCost } = calculateCutCost({
        width: cut.width,
        height: cut.height,
        quantity: cut.quantity ?? 1,
        unitCost,
      })

      const createdCut = await tx.quoteItemCut.create({
        data: {
          quoteItemId: item.id,
          materialId: cut.materialId || null,
          materialNameSnapshot,
          materialUnitCostSnapshot,
          description: cut.description,
          width: cut.width,
          height: cut.height,
          quantity: cut.quantity ?? 1,
          areaPerUnit,
          totalArea,
          notes: cut.notes,
          subtotalCost,
        },
      })

      subtotalMaterials += subtotalCost

      // Create edge bands
      for (const band of (cut.edgeBands ?? [])) {
        let bandUnitCost = 0
        let bandNameSnapshot = null
        let bandCostSnapshot = null

        if (band.materialId) {
          const mat = await tx.material.findUnique({ where: { id: band.materialId } })
          if (mat) {
            bandUnitCost = toNumber(mat.unitCost)
            bandNameSnapshot = mat.name
            bandCostSnapshot = bandUnitCost
          }
        }

        const length = band.side === 'TOP' || band.side === 'BOTTOM' ? cut.width : cut.height
        const { totalLength, subtotalCost: bandCost } = calculateEdgeBandCost({
          length,
          quantity: band.quantity ?? 1,
          unitCost: bandUnitCost,
        })

        await tx.quoteItemEdgeBand.create({
          data: {
            quoteItemCutId: createdCut.id,
            materialId: band.materialId || null,
            materialNameSnapshot: bandNameSnapshot,
            materialUnitCostSnapshot: bandCostSnapshot,
            side: band.side,
            length,
            quantity: band.quantity ?? 1,
            totalLength,
            subtotalCost: bandCost,
          },
        })

        subtotalMaterials += bandCost
      }
    }

    // Create accessories
    for (const acc of (accessories ?? [])) {
      let unitCost = 0
      let nameSnapshot = null
      let costSnapshot = null

      if (acc.materialId) {
        const mat = await tx.material.findUnique({ where: { id: acc.materialId } })
        if (mat) {
          unitCost = toNumber(mat.unitCost)
          nameSnapshot = mat.name
          costSnapshot = unitCost
        }
      }

      const subtotalCost = unitCost * (acc.quantity ?? 1)

      await tx.quoteItemAccessory.create({
        data: {
          quoteItemId: item.id,
          materialId: acc.materialId || null,
          materialNameSnapshot: nameSnapshot,
          materialUnitCostSnapshot: costSnapshot,
          description: acc.description,
          quantity: acc.quantity ?? 1,
          subtotalCost,
        },
      })

      subtotalHardware += subtotalCost
    }

    // Update item totals
    const updatedItem = await tx.quoteItem.update({
      where: { id: item.id },
      data: {
        subtotalMaterials,
        subtotalHardware,
        subtotalTotal: subtotalMaterials + subtotalHardware,
      },
    })

    // Recalculate quote totals
    const allItems = await tx.quoteItem.findMany({ where: { quoteId } })
    const quote = await tx.quote.findUnique({ where: { id: quoteId } })

    if (quote) {
      const totalLaborBase = allItems.reduce((a, i) => a + toNumber(i.subtotalMaterials) + toNumber(i.subtotalHardware), 0)
      const totalAdditionals = allItems.reduce((a, i) => a + toNumber(i.subtotalAdditionals), 0)
      const labor = totalLaborBase * (toNumber(quote.laborPercentage) / 100)
      const discountableBase = totalLaborBase + labor
      const discountDollar = discountableBase * (toNumber(quote.discountAmount) / 100)
      const afterDiscount = discountableBase - discountDollar
      const beforeTax = afterDiscount + totalAdditionals
      const vat = beforeTax * (toNumber(quote.vatPercentage) / 100)

      await tx.quote.update({
        where: { id: quoteId },
        data: {
          subtotalMaterials: totalLaborBase,
          subtotalLabor: labor,
          subtotalAdditionals: totalAdditionals,
          subtotalBeforeTax: beforeTax,
          vatAmount: vat,
          totalAmount: beforeTax + vat,
        },
      })
    }

    return updatedItem
  })

  return NextResponse.json(item, { status: 201 })
}
