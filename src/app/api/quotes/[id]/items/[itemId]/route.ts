import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { toNumber, recalcQuoteFinancials } from '@/lib/calculations'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await ctx.params

  const item = await prisma.quoteItem.findUnique({
    where: { id: itemId },
    include: {
      furnitureType: true,
      cuts: { include: { edgeBands: true } },
      accessories: true,
      additionals: true,
    }
  })

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(item)
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; itemId: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: quoteId, itemId } = await ctx.params

  await prisma.$transaction(async tx => {
    await tx.quoteItem.delete({ where: { id: itemId } })

    const allItems = await tx.quoteItem.findMany({ where: { quoteId } })
    const quote = await tx.quote.findUnique({ where: { id: quoteId } })

    if (quote) {
      const totalLaborBase = allItems.reduce((a, i) => a + toNumber(i.subtotalMaterials) + toNumber(i.subtotalHardware), 0)
      const totalAdditionals = allItems.reduce((a, i) => a + toNumber(i.subtotalAdditionals), 0)
      const financials = recalcQuoteFinancials({
        subtotalMaterials: totalLaborBase,
        subtotalAdditionals: totalAdditionals,
        laborPercentage: toNumber(quote.laborPercentage),
        vatPercentage: toNumber(quote.vatPercentage),
        discountAmount: toNumber(quote.discountAmount),
      })

      await tx.quote.update({
        where: { id: quoteId },
        data: {
          subtotalMaterials: totalLaborBase,
          subtotalAdditionals: totalAdditionals,
          ...financials,
        },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
