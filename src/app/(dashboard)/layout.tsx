import { auth } from '@/lib/auth'
import AppShell from '@/components/AppShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <AppShell
      userName={session?.user?.name}
      userRole={(session?.user as any)?.role}
    >
      {children}
    </AppShell>
  )
}
