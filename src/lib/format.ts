const TZ = 'America/Argentina/Buenos_Aires';

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
});

const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

/** Medidas en milímetros, sin decimales innecesarios. */
export function mm(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}`;
}

/** "1200 × 2100 mm" o "1200 × 2100 × 150 mm". */
export function dimensions(
  width: number | string | null,
  height: number | string | null,
  depth?: number | string | null,
): string {
  const parts = [width, height, depth]
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => mm(v));
  if (parts.length === 0) return '—';
  return `${parts.join(' × ')} mm`;
}

export function qty(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return '—';
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

export function initials(name: string | null | undefined, email?: string): string {
  const source = name?.trim() || email?.split('@')[0] || '?';
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function displayName(
  user: { full_name?: string | null; email?: string | null } | null | undefined,
): string {
  if (!user) return 'Sistema';
  return user.full_name?.trim() || user.email?.split('@')[0] || 'Usuario';
}

export function duration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
