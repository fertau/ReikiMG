'use client';

import { Disclosure } from '@/components/disclosure';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { TrashIcon } from '@/components/icons';
import { PART_KIND_LABELS } from '@/lib/status';
import { mm, qty } from '@/lib/format';
import { PartForm, type PartCatalogs } from './part-form';
import { deletePart } from '../../part-actions';
import type { ItemPart, PartKind } from '@/lib/types';

function describe(part: ItemPart): string {
  const name = part.material?.name ?? part.description ?? '—';

  switch (part.kind) {
    case 'vidrio':
      return [
        name,
        part.thickness,
        part.finish,
        part.material ? part.description : null,
      ]
        .filter(Boolean)
        .join(' · ');
    case 'perfileria':
      return [name, part.color, part.material ? part.description : null]
        .filter(Boolean)
        .join(' · ');
    case 'herraje':
      return [name, part.code, part.material ? part.description : null]
        .filter(Boolean)
        .join(' · ');
    default:
      return [name, part.material ? part.description : null].filter(Boolean).join(' · ');
  }
}

function measure(part: ItemPart): string {
  if (part.kind === 'vidrio') {
    if (!part.width_mm || !part.height_mm) return '';
    return `${mm(part.width_mm)} × ${mm(part.height_mm)} mm`;
  }
  if (part.kind === 'perfileria') {
    return part.length_mm ? `${mm(part.length_mm)} mm` : '';
  }
  return '';
}

export function PartsGroup({
  itemId,
  kind,
  parts,
  catalogs,
  canEdit,
}: {
  itemId: string;
  kind: PartKind;
  parts: ItemPart[];
  catalogs: PartCatalogs;
  canEdit: boolean;
}) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="section-title">{PART_KIND_LABELS[kind]}</h2>
        <span className="text-xs text-muted">{parts.length}</span>
      </div>

      <div className="card overflow-hidden">
        {parts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Sin filas cargadas.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {parts.map((part) => (
              <li key={part.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {qty(part.quantity)}
                      {part.unit ? ` ${part.unit}` : ' ×'} {describe(part)}
                    </p>
                    {measure(part) ? (
                      <p className="text-sm tabular-nums text-slate-600">{measure(part)}</p>
                    ) : null}
                    {part.notes ? (
                      <p className="text-xs text-muted">{part.notes}</p>
                    ) : null}
                  </div>

                  {canEdit ? (
                    <form action={deletePart}>
                      <input type="hidden" name="id" value={part.id} />
                      <input type="hidden" name="item_id" value={itemId} />
                      <ConfirmSubmit
                        message="¿Eliminar esta fila del despiece?"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar fila"
                      >
                        <TrashIcon className="size-4" />
                      </ConfirmSubmit>
                    </form>
                  ) : null}
                </div>

                {canEdit ? (
                  <div className="mt-2">
                    <Disclosure label="Editar" variant="ghost">
                      {(close) => (
                        <PartForm
                          itemId={itemId}
                          kind={kind}
                          catalogs={catalogs}
                          part={part}
                          onDone={close}
                        />
                      )}
                    </Disclosure>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <div className="border-t border-slate-100 p-3">
            <Disclosure label={`Agregar ${PART_KIND_LABELS[kind].toLowerCase()}`}>
              {(close) => (
                <PartForm
                  itemId={itemId}
                  kind={kind}
                  catalogs={catalogs}
                  onDone={close}
                />
              )}
            </Disclosure>
          </div>
        ) : null}
      </div>
    </section>
  );
}
