import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { proveedorSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const isActive = searchParams.get('isActive')

  const where: any = {}
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (isActive !== null && isActive !== '') where.isActive = isActive === 'true'

  const proveedores = await prisma.proveedor.findMany({
    where,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(proveedores)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = proveedorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const proveedor = await prisma.proveedor.create({ data: parsed.data })
  return NextResponse.json(proveedor, { status: 201 })
}
