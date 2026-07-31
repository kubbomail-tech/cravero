import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { toNumber, calculateCutCost, calculateEdgeBandCost } from '@/lib/calculations'
import { recalcItem } from '@/lib/recalcItem'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId } = await ctx.params
  const { description, materialId, width, height, quantity, edgeBands, pdfVisibility } = await req.json()

  await prisma.$transaction(async tx => {
    const mat = materialId ? await tx.material.findUnique({ where: { id: materialId } }) : null
    const unitCost = mat ? toNumber(mat.unitCost) : 0
    const { areaPerUnit, totalArea, subtotalCost } = calculateCutCost({ width, height, quantity: quantity ?? 1, unitCost })

    const cut = await tx.quoteItemCut.create({
      data: {
        quoteItemId: itemId,
        materialId: materialId || null,
        materialNameSnapshot: mat?.name,
        materialUnitCostSnapshot: unitCost,
        description,
        width,
        height,
        quantity: quantity ?? 1,
        areaPerUnit,
        totalArea,
        subtotalCost,
        pdfVisibility: pdfVisibility ?? 'HIDDEN',
      },
    })

    for (const eb of (edgeBands ?? [])) {
      const eMat = eb.materialId ? await tx.material.findUnique({ where: { id: eb.materialId } }) : null
      const eUnitCost = eMat ? toNumber(eMat.unitCost) : 0
      const length = eb.side === 'TOP' || eb.side === 'BOTTOM' ? width : height
      const { totalLength, subtotalCost: ebCost } = calculateEdgeBandCost({ length, quantity: eb.quantity ?? 1, unitCost: eUnitCost })
      await tx.quoteItemEdgeBand.create({
        data: {
          quoteItemCutId: cut.id,
          materialId: eb.materialId || null,
          materialNameSnapshot: eMat?.name,
          materialUnitCostSnapshot: eUnitCost,
          side: eb.side,
          length,
          quantity: eb.quantity ?? 1,
          totalLength,
          subtotalCost: ebCost,
        },
      })
    }

    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
