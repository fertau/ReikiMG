import { loadItemContext } from '@/lib/item-context';
import { BackLink, EmptyState, PageHeader } from '@/components/ui';
import { PhotoUploader } from './uploader';
import { PhotoCard } from './photo-card';
import type { ItemPhoto, PhotoCategory } from '@/lib/types';

export const metadata = { title: 'Fotos' };

export default async function FotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, item, canEdit, title } = await loadItemContext(id);

  const [{ data: photoRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from('item_photos')
      .select('*, author:users!item_photos_created_by_fkey(id, full_name)')
      .eq('item_id', id)
      .order('created_at'),
    supabase
      .from('photo_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  const photos = (photoRows ?? []) as unknown as ItemPhoto[];
  const categories = (categoryRows ?? []) as unknown as PhotoCategory[];

  const urls = new Map<string, string>();
  if (photos.length > 0) {
    const { data: signed } = await supabase.storage
      .from('item-photos')
      .createSignedUrls(
        photos.map((photo) => photo.storage_path),
        60 * 60,
      );

    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) urls.set(entry.path, entry.signedUrl);
    }
  }

  return (
    <>
      <BackLink href={`/items/${id}`} label={title} />
      <PageHeader
        title="Fotos"
        subtitle={`${photos.length} fotografía${photos.length === 1 ? '' : 's'}`}
      />

      {canEdit ? (
        <div className="mb-5">
          <PhotoUploader
            itemId={id}
            measurementId={item.measurement_id}
            categories={categories}
          />
        </div>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState
          title="Sin fotos"
          description={
            canEdit
              ? 'Sacá una foto general, los laterales y los detalles que necesite taller.'
              : 'Este ítem no tiene fotografías cargadas.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              url={urls.get(photo.storage_path) ?? null}
              categories={categories}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </>
  );
}
