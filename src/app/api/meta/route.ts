import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [categories, units] = await Promise.all([
    prisma.materialCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ orderBy: { code: 'asc' } }),
  ])

  return NextResponse.json({ categories, units })
}
