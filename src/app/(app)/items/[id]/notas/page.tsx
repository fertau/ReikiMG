import { loadItemContext } from '@/lib/item-context';
import { BackLink, EmptyState, PageHeader } from '@/components/ui';
import { ConfirmSubmit } from '@/components/confirm-submit';
import { TrashIcon } from '@/components/icons';
import { displayName, formatDateTime } from '@/lib/format';
import { NoteForm } from './note-form';
import { deleteNote } from '../../note-actions';
import type { ItemNote } from '@/lib/types';

export const metadata = { title: 'Notas' };

export default async function NotasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, canEdit, title } = await loadItemContext(id);

  const { data } = await supabase
    .from('item_notes')
    .select('*, author:users!item_notes_created_by_fkey(id, full_name)')
    .eq('item_id', id)
    .order('created_at', { ascending: false });

  const notes = (data ?? []) as unknown as ItemNote[];

  return (
    <>
      <BackLink href={`/items/${id}`} label={title} />
      <PageHeader
        title="Notas"
        subtitle={`${notes.length} nota${notes.length === 1 ? '' : 's'}`}
      />

      {canEdit ? (
        <div className="mb-5">
          <NoteForm itemId={id} />
        </div>
      ) : null}

      {notes.length === 0 ? (
        <EmptyState
          title="Sin notas"
          description={
            canEdit
              ? 'Anotá lo que no se ve en una foto ni en una medida.'
              : 'Este ítem no tiene notas cargadas.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="card-pad">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm whitespace-pre-line text-ink">
                  {note.body}
                </p>
                {canEdit ? (
                  <form action={deleteNote}>
                    <input type="hidden" name="id" value={note.id} />
                    <input type="hidden" name="item_id" value={id} />
                    <ConfirmSubmit
                      message="¿Eliminar esta nota?"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar nota"
                    >
                      <TrashIcon className="size-4" />
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted">
                {displayName(note.author)} · {formatDateTime(note.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
