import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { generateQuoteNumber, toNumber } from '@/lib/calculations'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const original = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          cuts: { include: { edgeBands: true } },
          accessories: true,
        },
      },
    },
  })

  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const count = await prisma.quote.count()
  const quoteNumber = generateQuoteNumber(count)

  const newQuote = await prisma.$transaction(async tx => {
    const q = await tx.quote.create({
      data: {
        quoteNumber,
        clientId: original.clientId,
        status: 'DRAFT',
        issueDate: new Date(),
        expirationDate: original.expirationDate,
        laborPercentage: original.laborPercentage,
        vatPercentage: original.vatPercentage,
        discountAmount: original.discountAmount,
        paymentTerms: original.paymentTerms,
        notes: original.notes,
        subtotalMaterials: original.subtotalMaterials,
        subtotalLabor: original.subtotalLabor,
        subtotalBeforeTax: original.subtotalBeforeTax,
        vatAmount: original.vatAmount,
        totalAmount: original.totalAmount,
        createdBy: (session.user as any).id,
      },
    })

    for (const item of original.items) {
      const newItem = await tx.quoteItem.create({
        data: {
          quoteId: q.id,
          furnitureTypeId: item.furnitureTypeId,
          description: item.description,
          quantity: item.quantity,
          notes: item.notes,
          subtotalMaterials: item.subtotalMaterials,
          subtotalHardware: item.subtotalHardware,
          subtotalTotal: item.subtotalTotal,
        },
      })

      for (const cut of item.cuts) {
        const newCut = await tx.quoteItemCut.create({
          data: {
            quoteItemId: newItem.id,
            materialId: cut.materialId,
            materialNameSnapshot: cut.materialNameSnapshot,
            materialUnitCostSnapshot: cut.materialUnitCostSnapshot,
            description: cut.description,
            width: cut.width,
            height: cut.height,
            quantity: cut.quantity,
            areaPerUnit: cut.areaPerUnit,
            totalArea: cut.totalArea,
            notes: cut.notes,
            subtotalCost: cut.subtotalCost,
          },
        })

        for (const band of cut.edgeBands) {
          await tx.quoteItemEdgeBand.create({
            data: {
              quoteItemCutId: newCut.id,
              materialId: band.materialId,
              materialNameSnapshot: band.materialNameSnapshot,
              materialUnitCostSnapshot: band.materialUnitCostSnapshot,
              side: band.side,
              length: band.length,
              quantity: band.quantity,
              totalLength: band.totalLength,
              subtotalCost: band.subtotalCost,
            },
          })
        }
      }

      for (const acc of item.accessories) {
        await tx.quoteItemAccessory.create({
          data: {
            quoteItemId: newItem.id,
            materialId: acc.materialId,
            materialNameSnapshot: acc.materialNameSnapshot,
            materialUnitCostSnapshot: acc.materialUnitCostSnapshot,
            description: acc.description,
            quantity: acc.quantity,
            subtotalCost: acc.subtotalCost,
          },
        })
      }
    }

    return q
  })

  return NextResponse.json(newQuote, { status: 201 })
}
