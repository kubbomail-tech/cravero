import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { recalcItem } from '@/lib/recalcItem'
import { calculateCutCost, calculateEdgeBandCost, toNumber } from '@/lib/calculations'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string; cutId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId, cutId } = await ctx.params
  const { description, materialId, width, height, quantity, pdfVisibility, edgeBands } = await req.json()

  await prisma.$transaction(async tx => {
    let unitCost = 0
    let materialNameSnapshot = null
    let materialUnitCostSnapshot = null

    if (materialId) {
      const mat = await tx.material.findUnique({ where: { id: materialId } })
      if (mat) {
        unitCost = toNumber(mat.unitCost)
        materialNameSnapshot = mat.name
        materialUnitCostSnapshot = unitCost
      }
    }

    const { areaPerUnit, totalArea, subtotalCost } = calculateCutCost({ width, height, quantity: quantity ?? 1, unitCost })

    await tx.quoteItemCut.update({
      where: { id: cutId },
      data: { materialId: materialId || null, materialNameSnapshot, materialUnitCostSnapshot, description, width, height, quantity: quantity ?? 1, areaPerUnit, totalArea, subtotalCost, pdfVisibility: pdfVisibility ?? 'HIDDEN' },
    })

    await tx.quoteItemEdgeBand.deleteMany({ where: { quoteItemCutId: cutId } })

    for (const band of (edgeBands ?? [])) {
      let bandUnitCost = 0
      let bandNameSnapshot = null
      let bandCostSnapshot = null
      if (band.materialId) {
        const mat = await tx.material.findUnique({ where: { id: band.materialId } })
        if (mat) { bandUnitCost = toNumber(mat.unitCost); bandNameSnapshot = mat.name; bandCostSnapshot = bandUnitCost }
      }
      const length = band.side === 'TOP' || band.side === 'BOTTOM' ? width : height
      const { totalLength, subtotalCost: bandCost } = calculateEdgeBandCost({ length, quantity: band.quantity ?? 1, unitCost: bandUnitCost })
      await tx.quoteItemEdgeBand.create({
        data: { quoteItemCutId: cutId, materialId: band.materialId || null, materialNameSnapshot: bandNameSnapshot, materialUnitCostSnapshot: bandCostSnapshot, side: band.side, length, quantity: band.quantity ?? 1, totalLength, subtotalCost: bandCost },
      })
    }

    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string; cutId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId, cutId } = await ctx.params

  await prisma.$transaction(async tx => {
    await tx.quoteItemCut.delete({ where: { id: cutId } })
    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true })
}
