import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { materialSchema } from '@/lib/validations'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const material = await prisma.material.findUnique({
    where: { id },
    include: { category: true, unit: true, proveedor: true },
  })
  if (!material) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(material)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const body = await req.json()
  const parsed = materialSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const material = await prisma.material.update({ where: { id }, data: parsed.data })
  return NextResponse.json(material)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const material = await prisma.material.update({
    where: { id },
    data: { isActive: false },
  })
  return NextResponse.json(material)
}
