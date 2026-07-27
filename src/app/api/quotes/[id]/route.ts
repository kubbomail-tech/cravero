import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { quoteUpdateSchema } from '@/lib/validations'
import { toNumber, recalcQuoteFinancials } from '@/lib/calculations'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      items: {
        include: {
          furnitureType: true,
          cuts: {
            include: { edgeBands: true },
          },
          accessories: true,
          additionals: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(quote)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json()
  const parsed = quoteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }
  const data = parsed.data

  try {
    const existing = await prisma.quote.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Recalculate financials whenever a commercial parameter changes — the
    // materials/additionals subtotals themselves are untouched by this endpoint.
    const needsRecalc = ['laborPercentage', 'vatPercentage', 'discountAmount'].some(k => k in data)
    const financials = needsRecalc
      ? recalcQuoteFinancials({
          subtotalMaterials: toNumber(existing.subtotalMaterials),
          subtotalAdditionals: toNumber(existing.subtotalAdditionals),
          laborPercentage: toNumber(data.laborPercentage ?? existing.laborPercentage),
          vatPercentage: toNumber(data.vatPercentage ?? existing.vatPercentage),
          discountAmount: toNumber(data.discountAmount ?? existing.discountAmount),
        })
      : {}

    const quote = await prisma.quote.update({
      where: { id },
      data: {
        ...data,
        ...(data.issueDate && { issueDate: new Date(data.issueDate) }),
        ...(data.expirationDate && { expirationDate: new Date(data.expirationDate) }),
        ...financials,
      },
      include: { client: true },
    })

    return NextResponse.json(quote)
  } catch (error) {
    console.error('[PATCH /api/quotes/[id]]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  await prisma.quote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
