'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionForm,
  CheckboxField,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from '@/components/form';
import { Disclosure } from '@/components/disclosure';
import { ChevronRightIcon } from '@/components/icons';
import { saveProductFamily, saveProductType, toggleProductType } from '../catalog-actions';
import type { ProductFamily, ProductType } from '@/lib/types';

export function FamilyForm({ families }: { families: ProductFamily[] }) {
  const router = useRouter();

  return (
    <Disclosure label="Nueva familia">
      {(close) => (
        <ActionForm
          action={saveProductFamily}
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
                name="name"
                label="Nombre"
                required
                autoFocus
                error={state.fieldErrors?.name}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  name="code"
                  label="Código"
                  required
                  hint="Sin espacios"
                  error={state.fieldErrors?.code}
                />
                <TextField
                  name="sort_order"
                  label="Orden"
                  type="number"
                  defaultValue={families.length * 10 + 10}
                />
              </div>
              <SubmitButton className="btn-primary btn-sm w-full">Crear familia</SubmitButton>
            </>
          )}
        </ActionForm>
      )}
    </Disclosure>
  );
}

export function ProductList({
  family,
  products,
}: {
  family: ProductFamily;
  products: ProductType[];
}) {
  const router = useRouter();

  const form = (close: () => void, product?: ProductType) => (
    <ActionForm
      action={saveProductType}
      className="space-y-3"
      onSuccess={() => {
        close();
        router.refresh();
      }}
    >
      {(state) => (
        <>
          <FormError state={state} />
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          <SelectField
            name="family_id"
            label="Familia"
            required
            defaultValue={product?.family_id ?? family.id}
            options={[{ value: family.id, label: family.name }]}
          />
          <TextField
            name="name"
            label="Nombre"
            required
            autoFocus
            defaultValue={product?.name ?? ''}
            error={state.fieldErrors?.name}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              name="code"
              label="Código"
              required
              defaultValue={product?.code ?? ''}
              error={state.fieldErrors?.code}
            />
            <TextField
              name="sort_order"
              label="Orden"
              type="number"
              defaultValue={product?.sort_order ?? products.length * 10 + 10}
            />
          </div>
          <TextField
            name="description"
            label="Descripción"
            defaultValue={product?.description ?? ''}
          />
          <CheckboxField
            name="requires_depth"
            label="Pide profundidad"
            hint="Mostrar el campo de profundidad al cargar medidas."
            defaultChecked={product?.requires_depth ?? false}
          />
          <SubmitButton className="btn-primary btn-sm w-full">Guardar</SubmitButton>
        </>
      )}
    </ActionForm>
  );

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <p className="font-semibold text-ink">{family.name}</p>
        <p className="text-xs text-muted">{family.code}</p>
      </div>

      {products.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Sin productos.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {products.map((product) => (
            <li key={product.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/admin/productos/${product.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium text-ink">{product.name}</p>
                  <p className="text-xs text-muted">
                    {product.code}
                    {product.requires_depth ? ' · con profundidad' : ''}
                  </p>
                </Link>
                <form action={toggleProductType}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="active" value={product.is_active ? '0' : '1'} />
                  <button
                    type="submit"
                    className={
                      product.is_active
                        ? 'chip bg-emerald-100 text-emerald-700 ring-emerald-200'
                        : 'chip bg-zinc-100 text-zinc-600 ring-zinc-200'
                    }
                  >
                    {product.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </form>
                <Link href={`/admin/productos/${product.id}`}>
                  <ChevronRightIcon className="size-5 text-slate-400" />
                </Link>
              </div>
              <div className="mt-2">
                <Disclosure label="Editar" variant="ghost">
                  {(close) => form(close, product)}
                </Disclosure>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-slate-100 p-3">
        <Disclosure label="Producto">{(close) => form(close)}</Disclosure>
      </div>
    </div>
  );
}
