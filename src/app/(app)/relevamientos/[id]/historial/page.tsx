import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { HistoryList } from '@/components/history-list';
import type { WorkflowEvent } from '@/lib/types';

export const metadata = { title: 'Historial del relevamiento' };

export default async function HistorialRelevamientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: measurement }, { data: events }] = await Promise.all([
    supabase.from('measurements').select('id, code').eq('id', id).maybeSingle(),
    supabase
      .from('workflow_history')
      .select('*, actor:users!workflow_history_actor_id_fkey(id, full_name)')
      .eq('measurement_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (!measurement) notFound();

  return (
    <>
      <BackLink href={`/relevamientos/${id}`} label={measurement.code} />
      <PageHeader title="Historial" subtitle={measurement.code} />
      <HistoryList events={(events ?? []) as unknown as WorkflowEvent[]} />
    </>
  );
}
