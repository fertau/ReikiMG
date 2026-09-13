import { dimensions, mm, qty } from '@/lib/format';
import { PART_KIND_LABELS } from '@/lib/status';
import type { FullItem } from '@/lib/measurement-data';
import type { PartKind } from '@/lib/types';

const KINDS: PartKind[] = ['vidrio', 'perfileria', 'herraje', 'otro'];

function partLine(part: FullItem['parts'][number]): string {
  const name = part.material?.name ?? part.description ?? '—';
  const bits: (string | null)[] = [name];

  if (part.kind === 'vidrio' && part.width_mm && part.height_mm) {
    bits.push(`${mm(part.width_mm)} × ${mm(part.height_mm)} mm`);
  }
  if (part.kind === 'perfileria' && part.length_mm) {
    bits.push(`${mm(part.length_mm)} mm`);
  }

  bits.push(part.thickness, part.finish, part.color, part.code);
  return bits.filter(Boolean).join(' · ');
}

/** Vista compacta y completa de un ítem. La usa el supervisor para revisar. */
export function ItemSummary({
  full,
  photoUrls,
}: {
  full: FullItem;
  photoUrls?: Map<string, string>;
}) {
  const { item, productType, fields, parts, photos, notes, audios } = full;

  return (
    <article className="card-pad">
      <header className="mb-2">
        <h3 className="font-semibold text-ink">{item.label || productType.name}</h3>
        <p className="text-sm text-muted">
          {item.quantity > 1 ? `${item.quantity} × ` : ''}
          {dimensions(item.width_mm, item.height_mm, item.depth_mm)}
          {item.label ? ` · ${productType.name}` : ''}
        </p>
      </header>

      {fields.length > 0 ? (
        <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {fields.map((field) => (
            <div key={`${field.section}-${field.label}`} className="text-sm">
              <dt className="text-xs text-muted">{field.label}</dt>
              <dd className="font-medium text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {item.notes ? (
        <p className="mb-3 rounded-lg bg-slate-50 p-2 text-sm whitespace-pre-line text-slate-700">
          {item.notes}
        </p>
      ) : null}

      {parts.length > 0 ? (
        <div className="mb-3">
          <p className="section-title mb-1">Despiece</p>
          {KINDS.map((kind) => {
            const group = parts.filter((part) => part.kind === kind);
            if (group.length === 0) return null;
            return (
              <div key={kind} className="mb-1.5">
                <p className="text-xs font-semibold text-slate-500">
                  {PART_KIND_LABELS[kind]}
                </p>
                <ul className="text-sm text-slate-700">
                  {group.map((part) => (
                    <li key={part.id}>
                      {qty(part.quantity)}
                      {part.unit ? ` ${part.unit}` : ' ×'} {partLine(part)}
                      {part.notes ? (
                        <span className="text-muted"> — {part.notes}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-3 text-sm text-amber-700">Sin despiece cargado.</p>
      )}

      {notes.length > 0 ? (
        <div className="mb-3">
          <p className="section-title mb-1">Notas</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {notes.map((note) => (
              <li key={note.id} className="whitespace-pre-line">
                {note.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="mb-2">
          <p className="section-title mb-1">Fotos ({photos.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => {
              const url = photoUrls?.get(photo.storage_path);
              return url ? (
                <a
                  key={photo.id}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={photo.caption ?? photo.category}
                    loading="lazy"
                    className="h-24 w-full object-cover"
                  />
                </a>
              ) : (
                <div
                  key={photo.id}
                  className="flex h-24 items-center justify-center rounded-lg bg-slate-100 text-xs text-muted"
                >
                  {photo.category}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {audios.length > 0 ? (
        <p className="text-sm text-muted">
          {audios.length} nota{audios.length === 1 ? '' : 's'} de voz cargada
          {audios.length === 1 ? '' : 's'}.
        </p>
      ) : null}
    </article>
  );
}
