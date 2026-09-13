import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth';
import { Alert } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Ingresar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user?.is_active) redirect('/');

  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg">
            <span className="text-2xl font-black text-white">R</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">ReikiMG</h1>
          <p className="mt-1 text-sm text-muted">Relevamientos y órdenes de producción</p>
        </div>

        {error === 'inactivo' ? (
          <div className="mb-4">
            <Alert tone="warn" title="Usuario desactivado">
              Tu cuenta no está habilitada. Consultá con administración.
            </Alert>
          </div>
        ) : null}

        <div className="card-pad">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Las cuentas las crea un administrador desde el panel del sistema.
        </p>
      </div>
    </main>
  );
}
