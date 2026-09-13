'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import clsx from 'clsx';
import type { ActionState } from '@/lib/action-state';
import { idleState } from '@/lib/action-state';

type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess = false,
}: {
  action: ServerAction;
  children: (state: ActionState) => React.ReactNode;
  className?: string;
  onSuccess?: (state: ActionState) => void;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!state.ok) return;
    if (onSuccess) onSuccess(state);
    // Cambiar la key remonta el formulario y limpia los campos: al cargar
    // varias filas seguidas el campo tiene que quedar vacío cada vez.
    if (resetOnSuccess) setResetKey((value) => value + 1);
    // onSuccess se re-crea en cada render del padre; sólo interesa el cambio de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className={className} key={resetKey}>
      {children(state)}
    </form>
  );
}

export function SubmitButton({
  children,
  className = 'btn-primary w-full',
  pendingLabel = 'Guardando…',
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200 ring-inset">
      {state.error}
    </div>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.ok || !state.message) return null;
  return (
    <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
      {state.message}
    </div>
  );
}

interface FieldProps {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  required,
  className,
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <input
        id={id}
        name={name}
        required={required}
        className={clsx('input', error && 'ring-red-400')}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  required,
  className,
  rows = 3,
  ...props
}: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        className={clsx('input', error && 'ring-red-400')}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder = 'Seleccionar…',
  ...props
}: FieldProps & {
  options: { value: string; label: string }[];
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      name={name}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <select
        id={id}
        name={name}
        required={required}
        className={clsx('input appearance-none', error && 'ring-red-400')}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={clsx(
        'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-300',
        className,
      )}
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        value="1"
        defaultChecked={defaultChecked}
        className="size-5 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
      />
      <span className="text-sm font-medium text-slate-700">
        {label}
        {hint ? <span className="block text-xs font-normal text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
