import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (key) {
    const setting = await prisma.appSetting.findUnique({ where: { key } })
    return NextResponse.json({ key, value: setting?.value ?? null })
  }

  const settings = await prisma.appSetting.findMany()
  return NextResponse.json(settings)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { key, value } = body as { key: string; value: string }

  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  const setting = await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value ?? '' },
    update: { value: value ?? '' },
  })

  return NextResponse.json(setting)
}
