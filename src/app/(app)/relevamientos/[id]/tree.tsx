'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from '@/components/form';
import { Disclosure } from '@/components/disclosure';
import { CameraIcon, ChevronRightIcon, MicIcon, NoteIcon, PartsIcon } from '@/components/icons';
import { LOCATION_KIND_LABELS } from '@/lib/status';
import { dimensions } from '@/lib/format';
import { createLocation, createRoom } from '../../obras/actions';
import type { Location, Room } from '@/lib/types';

export interface TreeItem {
  id: string;
  room_id: string;
  label: string | null;
  quantity: number;
  width_mm: number | null;
  height_mm: number | null;
  depth_mm: number | null;
  product_name: string;
  photos: number;
  notes: number;
  audios: number;
  parts: number;
}

const KIND_OPTIONS = Object.entries(LOCATION_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function ItemBadges({ item }: { item: TreeItem }) {
  const badges = [
    { icon: CameraIcon, value: item.photos, title: 'Fotos' },
    { icon: NoteIcon, value: item.notes, title: 'Notas' },
    { icon: MicIcon, value: item.audios, title: 'Audios' },
    { icon: PartsIcon, value: item.parts, title: 'Despiece' },
  ].filter((badge) => badge.value > 0);

  if (badges.length === 0) return null;

  return (
    <span className="mt-1 flex items-center gap-2.5 text-xs text-muted">
      {badges.map(({ icon: Icon, value, title }) => (
        <span key={title} className="inline-flex items-center gap-0.5" title={title}>
          <Icon className="size-3.5" />
          {value}
        </span>
      ))}
    </span>
  );
}

export function MeasurementTree({
  measurementId,
  projectId,
  locations,
  rooms,
  items,
  canEdit,
}: {
  measurementId: string;
  projectId: string;
  locations: Location[];
  rooms: Room[];
  items: TreeItem[];
  canEdit: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {locations.map((location) => {
        const locationRooms = rooms.filter((room) => room.location_id === location.id);

        return (
          <div key={location.id} className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="font-semibold text-ink">{location.name}</p>
              <p className="text-xs text-muted">
                {LOCATION_KIND_LABELS[location.kind] ?? location.kind}
                {location.floor ? ` · Piso ${location.floor}` : ''}
              </p>
            </div>

            {locationRooms.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Sin ambientes.</p>
            ) : (
              locationRooms.map((room) => {
                const roomItems = items.filter((item) => item.room_id === room.id);
                return (
                  <div key={room.id} className="border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between gap-2 px-4 pt-3">
                      <p className="text-sm font-semibold text-slate-700">{room.name}</p>
                      <span className="text-xs text-muted">
                        {roomItems.length} ítem{roomItems.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {roomItems.length > 0 ? (
                      <ul className="mt-1 divide-y divide-slate-100">
                        {roomItems.map((item) => (
                          <li key={item.id}>
                            <Link href={`/items/${item.id}`} className="list-row">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-ink">
                                  {item.label || item.product_name}
                                </p>
                                <p className="truncate text-sm text-muted">
                                  {item.quantity > 1 ? `${item.quantity} × ` : ''}
                                  {dimensions(item.width_mm, item.height_mm, item.depth_mm)}
                                  {item.label ? ` · ${item.product_name}` : ''}
                                </p>
                                <ItemBadges item={item} />
                              </div>
                              <ChevronRightIcon className="size-5 shrink-0 text-slate-400" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {canEdit ? (
                      <div className="px-4 py-3">
                        <Link
                          href={`/relevamientos/${measurementId}/items/nuevo?ambiente=${room.id}`}
                          className="btn-secondary btn-sm w-full"
                        >
                          + Ítem en {room.name}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {canEdit ? (
              <div className="p-3">
                <Disclosure label="Ambiente" variant="ghost">
                  {(close) => (
                    <ActionForm
                      action={createRoom}
                      className="space-y-3"
                      onSuccess={() => {
                        close();
                        router.refresh();
                      }}
                    >
                      {(state) => (
                        <>
                          <FormError state={state} />
                          <input type="hidden" name="location_id" value={location.id} />
                          <input type="hidden" name="project_id" value={projectId} />
                          <TextField
                            name="name"
                            label="Nombre del ambiente"
                            placeholder="Ej.: Baño principal"
                            required
                            autoFocus
                            error={state.fieldErrors?.name}
                          />
                          <SubmitButton className="btn-primary btn-sm w-full">
                            Agregar ambiente
                          </SubmitButton>
                        </>
                      )}
                    </ActionForm>
                  )}
                </Disclosure>
              </div>
            ) : null}
          </div>
        );
      })}

      {canEdit ? (
        <Disclosure label="Unidad / Sector">
          {(close) => (
            <ActionForm
              action={createLocation}
              className="space-y-3"
              onSuccess={() => {
                close();
                router.refresh();
              }}
            >
              {(state) => (
                <>
                  <FormError state={state} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <TextField
                    name="name"
                    label="Nombre"
                    placeholder="Ej.: Departamento 8B"
                    required
                    autoFocus
                    error={state.fieldErrors?.name}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      name="kind"
                      label="Tipo"
                      placeholder="Unidad"
                      defaultValue="unidad"
                      options={KIND_OPTIONS}
                    />
                    <TextField name="floor" label="Piso" placeholder="8" />
                  </div>
                  <SubmitButton className="btn-primary btn-sm w-full">
                    Agregar unidad
                  </SubmitButton>
                </>
              )}
            </ActionForm>
          )}
        </Disclosure>
      ) : null}

      {locations.length === 0 && !canEdit ? (
        <p className="text-sm text-muted">La obra no tiene unidades cargadas.</p>
      ) : null}
    </div>
  );
}
