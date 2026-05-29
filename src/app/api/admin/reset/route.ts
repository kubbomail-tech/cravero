import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.$transaction(async tx => {
    await tx.auditLog.deleteMany({})
    await tx.priceUpdateBatchItem.deleteMany({})
    await tx.priceUpdateBatch.deleteMany({})
    await tx.quote.deleteMany({})  // cascades items, cuts, edge bands, accessories, additionals, pdfs
    await tx.client.deleteMany({})
    await tx.material.deleteMany({})
  })

  return NextResponse.json({ ok: true })
}
