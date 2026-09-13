'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { PlusIcon } from '@/components/icons';

/**
 * Botón que despliega un formulario en línea. Evita navegar a otra pantalla
 * para cargas cortas, que en obra es la diferencia entre dos toques y cinco.
 */
export function Disclosure({
  label,
  children,
  className,
  variant = 'secondary',
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className={clsx('rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200', className)}>
        {children(() => setOpen(false))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost btn-sm mt-2 w-full"
        >
          Cancelar
        </button>
      </div>
    );
  }

  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
  } as const;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={clsx(variants[variant], 'btn-sm w-full', className)}
    >
      <PlusIcon className="size-4" />
      {label}
    </button>
  );
}
