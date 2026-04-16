import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { bulkPriceUpdateSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = bulkPriceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, percentage, scopeType, categoryId } = parsed.data

  // Get materials to update
  const where: any = { isActive: true }
  if (scopeType === 'CATEGORY' && categoryId) {
    where.categoryId = categoryId
  }

  const materials = await prisma.material.findMany({ where })

  // Create batch and items in transaction
  const batch = await prisma.$transaction(async tx => {
    const batch = await tx.priceUpdateBatch.create({
      data: {
        name,
        percentage,
        scopeType,
        categoryId: scopeType === 'CATEGORY' ? categoryId : null,
        createdBy: (session.user as any).id,
      },
    })

    for (const mat of materials) {
      const oldCost = parseFloat(mat.unitCost.toString())
      const newCost = oldCost * (1 + percentage / 100)

      await tx.priceUpdateBatchItem.create({
        data: {
          batchId: batch.id,
          materialId: mat.id,
          oldCost,
          newCost,
        },
      })

      await tx.material.update({
        where: { id: mat.id },
        data: { unitCost: newCost },
      })
    }

    return batch
  })

  return NextResponse.json({ batch, updatedCount: materials.length }, { status: 201 })
}
