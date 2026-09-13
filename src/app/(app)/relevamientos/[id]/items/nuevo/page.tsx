import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { canEditMeasurement, requireUser } from '@/lib/auth';
import { loadProductFields } from '@/lib/catalogs';
import { Alert, BackLink, EmptyState, PageHeader } from '@/components/ui';
import { ItemForm } from '../../../../items/item-form';
import { createItem } from '../../../../items/actions';
import type { Location, Measurement, ProductFamily, ProductType, Room } from '@/lib/types';

export const metadata: Metadata = { title: 'Nuevo ítem' };

export default async function NuevoItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ambiente?: string; producto?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { ambiente, producto } = await searchParams;
  const supabase = await createClient();

  const { data: measurementRow } = await supabase
    .from('measurements')
    .select('*, project:projects(id, name)')
    .eq('id', id)
    .maybeSingle();

  if (!measurementRow) notFound();
  const measurement = measurementRow as unknown as Measurement;

  if (!canEditMeasurement(user, measurement)) {
    redirect(`/relevamientos/${id}`);
  }

  const { data: locationRows } = await supabase
    .from('locations')
    .select('*')
    .eq('project_id', measurement.project_id)
    .order('sort_order');

  const locations = (locationRows ?? []) as unknown as Location[];
  const { data: roomRows } = locations.length
    ? await supabase
        .from('rooms')
        .select('*')
        .in(
          'location_id',
          locations.map((location) => location.id),
        )
        .order('sort_order')
    : { data: [] };

  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const rooms = ((roomRows ?? []) as unknown as Room[]).map((room) => ({
    ...room,
    locationName: locationNames.get(room.location_id) ?? '',
  }));

  if (rooms.length === 0) {
    return (
      <>
        <BackLink href={`/relevamientos/${id}`} label={measurement.code} />
        <PageHeader title="Nuevo ítem" />
        <EmptyState
          title="Todavía no hay ambientes"
          description="Creá una unidad y un ambiente en el relevamiento antes de cargar ítems."
          action={
            <Link href={`/relevamientos/${id}`} className="btn-primary btn-sm">
              Volver al relevamiento
            </Link>
          }
        />
      </>
    );
  }

  // Paso 1 · elegir producto
  if (!producto) {
    const [{ data: familyRows }, { data: typeRows }] = await Promise.all([
      supabase
        .from('product_families')
        .select('*')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.from('product_types').select('*').eq('is_active', true).order('sort_order'),
    ]);

    const families = (familyRows ?? []) as unknown as ProductFamily[];
    const types = (typeRows ?? []) as unknown as ProductType[];
    const room = rooms.find((r) => r.id === ambiente);

    return (
      <>
        <BackLink href={`/relevamientos/${id}`} label={measurement.code} />
        <PageHeader
          title="¿Qué vas a medir?"
          subtitle={room ? `${room.locationName} · ${room.name}` : 'Elegí el producto'}
        />

        {types.length === 0 ? (
          <Alert tone="warn" title="Sin productos cargados">
            Un administrador tiene que cargar los productos desde el panel.
          </Alert>
        ) : (
          <div className="space-y-5">
            {families.map((family) => {
              const familyTypes = types.filter((type) => type.family_id === family.id);
              if (familyTypes.length === 0) return null;

              return (
                <section key={family.id}>
                  <h2 className="section-title mb-2 px-1">{family.name}</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {familyTypes.map((type) => {
                      const query = new URLSearchParams({ producto: type.id });
                      if (ambiente) query.set('ambiente', ambiente);
                      return (
                        <Link
                          key={type.id}
                          href={`/relevamientos/${id}/items/nuevo?${query.toString()}`}
                          className="card flex min-h-20 items-center p-4 text-sm font-semibold text-ink transition active:scale-[0.98]"
                        >
                          {type.name}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // Paso 2 · cargar medidas y características
  const { data: productRow } = await supabase
    .from('product_types')
    .select('*, family:product_families(name)')
    .eq('id', producto)
    .maybeSingle();

  if (!productRow) notFound();
  const product = productRow as unknown as ProductType;

  const { fields, catalogs } = await loadProductFields(supabase, product.id);

  const backQuery = ambiente ? `?ambiente=${ambiente}` : '';

  return (
    <>
      <BackLink
        href={`/relevamientos/${id}/items/nuevo${backQuery}`}
        label="Cambiar producto"
      />
      <PageHeader title="Nuevo ítem" subtitle={measurement.project?.name} />

      <div className="card-pad">
        <ItemForm
          action={createItem}
          measurementId={id}
          productTypeId={product.id}
          productName={product.name}
          requiresDepth={product.requires_depth}
          rooms={rooms}
          defaultRoomId={ambiente}
          fields={fields}
          catalogs={catalogs}
          submitLabel="Guardar ítem"
          redirectTo="item"
        />
      </div>
    </>
  );
}
