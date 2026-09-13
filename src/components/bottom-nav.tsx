'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  BuildingIcon,
  HomeIcon,
  MenuIcon,
  OrderIcon,
  RulerIcon,
} from '@/components/icons';

const TABS = [
  { href: '/', label: 'Inicio', icon: HomeIcon, exact: true },
  { href: '/obras', label: 'Obras', icon: BuildingIcon },
  { href: '/relevamientos/nuevo', label: 'Medir', icon: RulerIcon, primary: true },
  { href: '/ordenes', label: 'Órdenes', icon: OrderIcon },
  { href: '/mas', label: 'Más', icon: MenuIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur safe-bottom">
      <ul className="mx-auto flex max-w-2xl items-stretch">
        {TABS.map((tab) => {
          const active =
            'exact' in tab && tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          const primary = 'primary' in tab && tab.primary;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition',
                  active ? 'text-brand-700' : 'text-slate-500',
                )}
              >
                {primary ? (
                  <span className="-mt-4 flex size-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-4 ring-white">
                    <Icon className="size-6" />
                  </span>
                ) : (
                  <Icon className="size-6" />
                )}
                <span className={primary ? 'mt-0.5' : undefined}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
