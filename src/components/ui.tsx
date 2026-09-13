import Link from 'next/link';
import clsx from 'clsx';
import { STATUS_COLORS } from '@/lib/status';

export function StatusChip({
  label,
  color,
  className,
}: {
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <span className={clsx('chip', STATUS_COLORS[color] ?? STATUS_COLORS.slate, className)}>
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold text-ink">{title}</h1>
        {subtitle ? <div className="mt-0.5 text-sm text-muted">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-pad flex flex-col items-center gap-2 py-10 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {description ? <p className="max-w-xs text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('mb-5', className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value ?? '—'}</dd>
    </div>
  );
}

export function StatTile({
  label,
  value,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  href: string;
  tone?: 'default' | 'warn' | 'danger' | 'ok';
}) {
  const tones = {
    default: 'text-brand-700',
    warn: 'text-amber-600',
    danger: 'text-red-600',
    ok: 'text-emerald-600',
  } as const;

  return (
    <Link
      href={href}
      className="card flex min-h-20 flex-col justify-between p-3 transition active:scale-[0.98]"
    >
      <span className={clsx('text-2xl font-bold tabular-nums', tones[tone])}>{value}</span>
      <span className="text-xs leading-tight font-medium text-slate-600">{label}</span>
    </Link>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'ok';
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: 'bg-blue-50 text-blue-900 ring-blue-200',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200',
    danger: 'bg-red-50 text-red-900 ring-red-200',
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  } as const;

  return (
    <div className={clsx('rounded-xl p-3 text-sm ring-1 ring-inset', tones[tone])}>
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      <div className="[&_p]:mt-1">{children}</div>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
