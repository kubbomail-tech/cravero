import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { recalcItem } from '@/lib/recalcItem'

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
