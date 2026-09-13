import { loadItemContext } from '@/lib/item-context';
import { BackLink, EmptyState, PageHeader } from '@/components/ui';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { TrashIcon } from '@/components/icons';
import { displayName, duration, fileSize, formatDateTime } from '@/lib/format';
import { AudioRecorder } from './recorder';
import { deleteAudio } from '../../audio-actions';
import type { ItemAudio } from '@/lib/types';

export const metadata = { title: 'Audios' };

export default async function AudiosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, item, canEdit, title } = await loadItemContext(id);

  const { data } = await supabase
    .from('item_audio')
    .select('*, author:users!item_audio_created_by_fkey(id, full_name)')
    .eq('item_id', id)
    .order('created_at', { ascending: false });

  const audios = (data ?? []) as unknown as ItemAudio[];

  const urls = new Map<string, string>();
  if (audios.length > 0) {
    const { data: signed } = await supabase.storage
      .from('item-audio')
      .createSignedUrls(
        audios.map((audio) => audio.storage_path),
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
        title="Audios"
        subtitle={`${audios.length} nota${audios.length === 1 ? '' : 's'} de voz`}
      />

      {canEdit ? (
        <div className="mb-5">
          <AudioRecorder itemId={id} measurementId={item.measurement_id} />
        </div>
      ) : null}

      {audios.length === 0 ? (
        <EmptyState
          title="Sin notas de voz"
          description={
            canEdit
              ? 'Grabá lo que sea más rápido decir que escribir.'
              : 'Este ítem no tiene audios cargados.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {audios.map((audio) => (
            <li key={audio.id} className="card-pad">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {duration(audio.duration_seconds)}
                  </p>
                  <p className="text-xs text-muted">
                    {displayName(audio.author)} · {formatDateTime(audio.created_at)} ·{' '}
                    {fileSize(audio.byte_size)}
                  </p>
                </div>
                {canEdit ? (
                  <form action={deleteAudio}>
                    <input type="hidden" name="id" value={audio.id} />
                    <input type="hidden" name="item_id" value={id} />
                    <ConfirmSubmit
                      message="¿Eliminar esta nota de voz?"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar audio"
                    >
                      <TrashIcon className="size-4" />
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </div>

              {urls.has(audio.storage_path) ? (
                <audio
                  src={urls.get(audio.storage_path)}
                  controls
                  preload="none"
                  className="w-full"
                />
              ) : (
                <p className="text-sm text-muted">No se pudo cargar el audio.</p>
              )}

              {audio.transcript ? (
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                  {audio.transcript}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
