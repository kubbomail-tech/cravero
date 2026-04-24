import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { toNumber } from '@/lib/calculations'

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
      const totalMat = allItems.reduce(
        (a, i) => a + toNumber(i.subtotalMaterials) + toNumber(i.subtotalHardware) + toNumber(i.subtotalAdditionals),
        0
      )
      const labor = totalMat * (toNumber(quote.laborPercentage) / 100)
      const subtotalBeforeDiscount = totalMat + labor
      const discountDollar = subtotalBeforeDiscount * (toNumber(quote.discountAmount) / 100)
      const beforeTax = subtotalBeforeDiscount - discountDollar
      const vat = beforeTax * (toNumber(quote.vatPercentage) / 100)
      const total = beforeTax + vat

      await tx.quote.update({
        where: { id: quoteId },
        data: {
          subtotalMaterials: totalMat,
          subtotalLabor: labor,
          subtotalBeforeTax: beforeTax,
          vatAmount: vat,
          totalAmount: total,
        },
      })
    }
  })

  return NextResponse.json({ ok: true })
}
