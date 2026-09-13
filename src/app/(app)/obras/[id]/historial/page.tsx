import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { HistoryList } from '@/components/history-list';
import type { WorkflowEvent } from '@/lib/types';

export const metadata = { title: 'Historial de obra' };

export default async function HistorialObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: events }] = await Promise.all([
    supabase.from('projects').select('id, code, name').eq('id', id).maybeSingle(),
    supabase
      .from('workflow_history')
      .select('*, actor:users!workflow_history_actor_id_fkey(id, full_name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (!project) notFound();

  return (
    <>
      <BackLink href={`/obras/${id}`} label={project.name} />
      <PageHeader title="Historial" subtitle={project.code} />
      <HistoryList events={(events ?? []) as unknown as WorkflowEvent[]} />
    </>
  );
}
