'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from '@/components/form';
import { Disclosure } from '@/components/disclosure';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { TrashIcon } from '@/components/icons';
import { LOCATION_KIND_LABELS } from '@/lib/status';
import type { Location, Room } from '@/lib/types';
import { createLocation, createRoom, deleteLocation, deleteRoom } from '../actions';

const KIND_OPTIONS = Object.entries(LOCATION_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function ProjectStructure({
  projectId,
  locations,
  rooms,
  canEdit,
}: {
  projectId: string;
  locations: Location[];
  rooms: Room[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-3">
      {locations.map((location) => {
        const children = rooms.filter((room) => room.location_id === location.id);
        return (
          <div key={location.id} className="card-pad">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{location.name}</p>
                <p className="text-xs text-muted">
                  {LOCATION_KIND_LABELS[location.kind] ?? location.kind}
                  {location.floor ? ` · Piso ${location.floor}` : ''}
                  {` · ${children.length} ambiente${children.length === 1 ? '' : 's'}`}
                </p>
              </div>
              {canEdit ? (
                <form action={deleteLocation}>
                  <input type="hidden" name="id" value={location.id} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <ConfirmSubmit
                    message={`¿Eliminar "${location.name}" y sus ambientes? No se puede si ya tienen ítems cargados.`}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar unidad"
                  >
                    <TrashIcon className="size-5" />
                  </ConfirmSubmit>
                </form>
              ) : null}
            </div>

            {children.length > 0 ? (
              <ul className="mb-2 divide-y divide-slate-100 border-y border-slate-100">
                {children.map((room) => (
                  <li key={room.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="truncate text-sm font-medium text-slate-700">
                      {room.name}
                    </span>
                    {canEdit ? (
                      <form action={deleteRoom}>
                        <input type="hidden" name="id" value={room.id} />
                        <input type="hidden" name="project_id" value={projectId} />
                        <ConfirmSubmit
                          message={`¿Eliminar el ambiente "${room.name}"?`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Eliminar ambiente"
                        >
                          <TrashIcon className="size-4" />
                        </ConfirmSubmit>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-2 text-sm text-muted">Sin ambientes cargados.</p>
            )}

            {canEdit ? (
              <Disclosure label="Ambiente" variant="ghost">
                {(close) => (
                  <ActionForm
                    action={createRoom}
                    className="space-y-3"
                    onSuccess={() => {
                      close();
                      refresh();
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
                refresh();
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
                      error={state.fieldErrors?.kind}
                    />
                    <TextField
                      name="floor"
                      label="Piso"
                      placeholder="8"
                      error={state.fieldErrors?.floor}
                    />
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
        <p className="text-sm text-muted">Sin unidades cargadas.</p>
      ) : null}
    </div>
  );
}
