import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { recalcItem } from '@/lib/recalcItem'
import { toNumber } from '@/lib/calculations'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string; addId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId, addId } = await ctx.params
  const { description, materialId, quantity, pdfVisibility, manualPrice, applyLabor } = await req.json()

  await prisma.$transaction(async tx => {
    const mat = materialId ? await tx.material.findUnique({ where: { id: materialId } }) : null
    const unitCost = mat ? toNumber(mat.unitCost) : 0
    const subtotalCost = manualPrice != null ? manualPrice : unitCost * (quantity ?? 1)
    await tx.quoteItemAdditional.update({
      where: { id: addId },
      data: {
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

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string; addId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId, addId } = await ctx.params

  await prisma.$transaction(async tx => {
    await tx.quoteItemAdditional.delete({ where: { id: addId } })
    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true })
}
