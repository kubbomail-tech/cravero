import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { materialCategorySchema } from '@/lib/validations'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = materialCategorySchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const categoria = await prisma.materialCategory.update({ where: { id }, data: parsed.data })
    return NextResponse.json(categoria)
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: { fieldErrors: { name: ['Ya existe una categoría con ese nombre'] } } }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const materialsCount = await prisma.material.count({ where: { categoryId: id } })
  if (materialsCount > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: hay ${materialsCount} material(es) en esta categoría` },
      { status: 409 }
    )
  }

  await prisma.materialCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
