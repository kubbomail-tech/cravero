import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { quoteSchema } from '@/lib/validations'
import { toNumber } from '@/lib/calculations'

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

  // Allow partial updates including status
  const quote = await prisma.quote.update({
    where: { id },
    data: {
      ...body,
      ...(body.issueDate && { issueDate: new Date(body.issueDate) }),
      ...(body.expirationDate && { expirationDate: new Date(body.expirationDate) }),
    },
    include: { client: true },
  })

  return NextResponse.json(quote)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  await prisma.quote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
