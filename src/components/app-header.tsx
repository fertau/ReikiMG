import Link from 'next/link';
import { initials } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/types';
import type { SessionUser } from '@/lib/types';

export function AppHeader({ user }: { user: SessionUser }) {
  const roleLabel =
    user.roles.length > 0
      ? user.roles.map((role) => ROLE_LABELS[role]).join(' · ')
      : 'Sin rol asignado';

  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">
            R
          </span>
          <span className="text-base font-bold text-ink">ReikiMG</span>
        </Link>

        <Link href="/mas" className="flex items-center gap-2 text-right">
          <span className="hidden text-xs leading-tight sm:block">
            <span className="block font-semibold text-slate-700">
              {user.full_name ?? user.email}
            </span>
            <span className="block text-muted">{roleLabel}</span>
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {initials(user.full_name, user.email)}
          </span>
        </Link>
      </div>
    </header>
  );
}
