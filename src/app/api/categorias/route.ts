import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { materialCategorySchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const seccion = searchParams.get('seccion')

  const where: any = {}
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (seccion) where.seccion = seccion

  const categorias = await prisma.materialCategory.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { materials: { where: { isActive: true } } } } },
  })

  return NextResponse.json(categorias)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = materialCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const categoria = await prisma.materialCategory.create({ data: parsed.data })
    return NextResponse.json(categoria, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: { fieldErrors: { name: ['Ya existe una categoría con ese nombre'] } } }, { status: 409 })
    }
    throw e
  }
}
