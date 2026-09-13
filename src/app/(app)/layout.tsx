import { requireUser } from '@/lib/auth';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { Alert } from '@/components/ui';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh">
      <AppHeader user={user} />
      <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
        {user.roles.length === 0 ? (
          <div className="mb-4">
            <Alert tone="warn" title="Sin rol asignado">
              Un administrador todavía no te asignó permisos. Vas a ver la aplicación
              vacía hasta que lo haga.
            </Alert>
          </div>
        ) : null}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
