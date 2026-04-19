import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const unitSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(10),
  name: z.string().min(1, 'El nombre es requerido'),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const units = await prisma.unit.findMany({ orderBy: { code: 'asc' } })
  return NextResponse.json(units)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = unitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const unit = await prisma.unit.create({ data: parsed.data })
    return NextResponse.json(unit, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: { fieldErrors: { code: ['Ya existe una unidad con ese código'] } } }, { status: 409 })
    }
    throw e
  }
}
