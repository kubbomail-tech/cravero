import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { recalcItem } from '@/lib/recalcItem'
import { toNumber } from '@/lib/calculations'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string; accId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId, accId } = await ctx.params
  const { description, materialId, quantity, pdfVisibility } = await req.json()

  await prisma.$transaction(async tx => {
    const mat = materialId ? await tx.material.findUnique({ where: { id: materialId } }) : null
    const unitCost = mat ? toNumber(mat.unitCost) : 0
    await tx.quoteItemAccessory.update({
      where: { id: accId },
      data: {
        materialId: materialId || null,
        materialNameSnapshot: mat?.name,
        materialUnitCostSnapshot: unitCost,
        description,
        quantity: quantity ?? 1,
        subtotalCost: unitCost * (quantity ?? 1),
        pdfVisibility: pdfVisibility ?? 'HIDDEN',
      },
    })
    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; itemId: string; accId: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId, accId } = await ctx.params

  await prisma.$transaction(async tx => {
    await tx.quoteItemAccessory.delete({ where: { id: accId } })
    await recalcItem(tx, itemId, quoteId)
  })

  return NextResponse.json({ ok: true })
}
