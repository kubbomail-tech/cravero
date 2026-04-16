import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, name: true, email: true, role: true },
  })

  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { name, currentPassword, newPassword } = await req.json()
  const userId = (session.user as any).id

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Ingresá tu contraseña actual' }, { status: 400 })
    }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: userId },
      data: { ...(name ? { name } : {}), passwordHash: hash },
    })
    return NextResponse.json({ ok: true, passwordChanged: true })
  }

  if (name) {
    if (name.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
    }
    await prisma.user.update({ where: { id: userId }, data: { name: name.trim() } })
    return NextResponse.json({ ok: true, name: name.trim() })
  }

  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
}
