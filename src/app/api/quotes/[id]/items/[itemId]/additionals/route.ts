import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { toNumber } from '@/lib/calculations'
import { recalcItem } from '@/lib/recalcItem'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId } = await ctx.params
  const { description, materialId, quantity, pdfVisibility, manualPrice, applyLabor } = await req.json()

  await prisma.$transaction(async tx => {
    const mat = materialId ? await tx.material.findUnique({ where: { id: materialId } }) : null
    const unitCost = mat ? toNumber(mat.unitCost) : 0
    const subtotalCost = manualPrice != null ? manualPrice : unitCost * (quantity ?? 1)
    await tx.quoteItemAdditional.create({
      data: {
        quoteItemId: itemId,
        materialId: materialId || null,
        materialNameSnapshot: mat?.name,
        materialUnitCostSnapshot: unitCost,
        description,
        quantity: quantity ?? 1,
        subtotalCost,
        pdfVisibility: pdfVisibility ?? 'DESCRIPTION_AND_PRICE',
        applyLabor: applyLabor ?? false,
      },
    })
    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
