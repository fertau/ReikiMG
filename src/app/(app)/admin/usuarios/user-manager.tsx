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
import { displayName } from '@/lib/format';
import { ROLE_LABELS, ROLES, type AppRole } from '@/lib/types';
import { createUser, toggleUserActive, updateUserRoles } from '../user-actions';

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  roles: AppRole[];
}

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

export function NewUserForm() {
  const router = useRouter();

  return (
    <Disclosure label="Nuevo usuario" variant="primary">
      {(close) => (
        <ActionForm
          action={createUser}
          className="space-y-3"
          onSuccess={() => {
            close();
            router.refresh();
          }}
        >
          {(state) => (
            <>
              <FormError state={state} />
              <TextField
                name="full_name"
                label="Nombre y apellido"
                required
                autoFocus
                error={state.fieldErrors?.full_name}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                required
                error={state.fieldErrors?.email}
              />
              <TextField
                name="password"
                label="Contraseña inicial"
                type="text"
                required
                hint="Mínimo 8 caracteres. El usuario la puede cambiar después."
                error={state.fieldErrors?.password}
              />
              <TextField
                name="phone"
                label="Teléfono"
                type="tel"
                error={state.fieldErrors?.phone}
              />
              <SelectField
                name="role"
                label="Rol"
                required
                options={ROLE_OPTIONS}
                error={state.fieldErrors?.role}
              />
              <SubmitButton className="btn-primary w-full">Crear usuario</SubmitButton>
            </>
          )}
        </ActionForm>
      )}
    </Disclosure>
  );
}

export function UserCard({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  const router = useRouter();

  return (
    <div className="card-pad">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {displayName(user)}
            {isSelf ? <span className="ml-1 text-xs text-muted">(vos)</span> : null}
          </p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <p className="text-xs text-muted">
            {user.roles.length > 0
              ? user.roles.map((role) => ROLE_LABELS[role]).join(' · ')
              : 'Sin rol asignado'}
          </p>
        </div>
        <span
          className={
            user.is_active
              ? 'chip bg-emerald-100 text-emerald-700 ring-emerald-200'
              : 'chip bg-zinc-100 text-zinc-600 ring-zinc-200'
          }
        >
          {user.is_active ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <Disclosure label="Editar roles" variant="ghost">
        {(close) => (
          <ActionForm
            action={updateUserRoles}
            className="space-y-3"
            onSuccess={() => {
              close();
              router.refresh();
            }}
          >
            {(state) => (
              <>
                <FormError state={state} />
                <input type="hidden" name="user_id" value={user.id} />
                <div className="space-y-2">
                  {ROLES.map((role) => (
                    <label
                      key={role}
                      className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-300"
                    >
                      <input
                        type="checkbox"
                        name="roles[]"
                        value={role}
                        defaultChecked={user.roles.includes(role)}
                        className="size-5 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                      />
                      <span className="text-sm text-slate-700">{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
                <SubmitButton className="btn-primary btn-sm w-full">
                  Guardar roles
                </SubmitButton>
              </>
            )}
          </ActionForm>
        )}
      </Disclosure>

      {!isSelf ? (
        <form action={toggleUserActive} className="mt-2">
          <input type="hidden" name="user_id" value={user.id} />
          <input type="hidden" name="active" value={user.is_active ? '0' : '1'} />
          <button type="submit" className="btn-secondary btn-sm w-full">
            {user.is_active ? 'Desactivar acceso' : 'Reactivar acceso'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
