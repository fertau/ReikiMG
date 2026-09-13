'use client';

import { useFormStatus } from 'react-dom';
import clsx from 'clsx';

/** Botón de envío con confirmación previa, para acciones destructivas. */
export function ConfirmSubmit({
  message,
  children,
  className,
  title,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      className={clsx(className, pending && 'opacity-50')}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
