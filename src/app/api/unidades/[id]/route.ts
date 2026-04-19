import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const unitSchema = z.object({
  code: z.string().min(1).max(10).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = unitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const unit = await prisma.unit.update({ where: { id }, data: parsed.data })
    return NextResponse.json(unit)
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: { fieldErrors: { code: ['Ya existe una unidad con ese código'] } } }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const count = await prisma.material.count({ where: { unitId: id } })
  if (count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: hay ${count} material(es) usando esta unidad` },
      { status: 409 }
    )
  }

  await prisma.unit.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
