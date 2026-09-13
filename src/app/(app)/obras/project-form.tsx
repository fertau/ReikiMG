'use client';

import { useRouter } from 'next/navigation';
import {
  ActionForm,
  FormError,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from '@/components/form';
import { PROJECT_STATUS } from '@/lib/status';
import { displayName } from '@/lib/format';
import type { ActionState } from '@/lib/action-state';
import type { AppUser, Project, ProjectStatus } from '@/lib/types';

const STATUS_OPTIONS = (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((value) => ({
  value,
  label: PROJECT_STATUS[value].label,
}));

export function ProjectForm({
  action,
  project,
  staff,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Project;
  staff: AppUser[];
  submitLabel: string;
}) {
  const router = useRouter();

  return (
    <ActionForm
      action={action}
      className="space-y-4"
      onSuccess={(state) => {
        if (state.id) router.push(`/obras/${state.id}`);
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          {project ? <input type="hidden" name="id" value={project.id} /> : null}

          <TextField
            name="client_name"
            label="Cliente"
            required
            defaultValue={project?.client_name ?? ''}
            placeholder="Nombre del cliente"
            error={state.fieldErrors?.client_name}
          />
          <TextField
            name="name"
            label="Nombre de obra"
            required
            defaultValue={project?.name ?? ''}
            placeholder="Ej.: Edificio Libertador"
            error={state.fieldErrors?.name}
          />
          <TextField
            name="address"
            label="Dirección"
            defaultValue={project?.address ?? ''}
            placeholder="Calle, número, localidad"
            error={state.fieldErrors?.address}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              name="contact_name"
              label="Contacto"
              defaultValue={project?.contact_name ?? ''}
              error={state.fieldErrors?.contact_name}
            />
            <TextField
              name="contact_phone"
              label="Teléfono"
              type="tel"
              inputMode="tel"
              defaultValue={project?.contact_phone ?? ''}
              error={state.fieldErrors?.contact_phone}
            />
          </div>

          <SelectField
            name="assigned_to"
            label="Responsable"
            placeholder="Sin asignar"
            defaultValue={project?.assigned_to ?? ''}
            options={staff.map((person) => ({
              value: person.id,
              label: displayName(person),
            }))}
            error={state.fieldErrors?.assigned_to}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              name="scheduled_date"
              label="Fecha"
              type="date"
              defaultValue={project?.scheduled_date ?? ''}
              error={state.fieldErrors?.scheduled_date}
            />
            <SelectField
              name="status"
              label="Estado"
              placeholder="Pendiente"
              defaultValue={project?.status ?? 'pendiente'}
              options={STATUS_OPTIONS}
              error={state.fieldErrors?.status}
            />
          </div>

          <TextAreaField
            name="notes"
            label="Observaciones"
            rows={3}
            defaultValue={project?.notes ?? ''}
            error={state.fieldErrors?.notes}
          />

          <SubmitButton>{submitLabel}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
