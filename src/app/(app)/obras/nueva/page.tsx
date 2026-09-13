import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { ProjectForm } from '../project-form';
import { createProject } from '../actions';
import type { AppUser } from '@/lib/types';

export const metadata: Metadata = { title: 'Nueva obra' };

export default async function NuevaObraPage() {
  await requireRole('supervisor');
  const supabase = await createClient();

  const { data } = await supabase
    .from('users')
    .select('id, full_name, email, is_active')
    .eq('is_active', true)
    .order('full_name');

  return (
    <>
      <BackLink href="/obras" label="Obras" />
      <PageHeader title="Nueva obra" />
      <div className="card-pad">
        <ProjectForm
          action={createProject}
          staff={(data ?? []) as unknown as AppUser[]}
          submitLabel="Crear obra"
        />
      </div>
    </>
  );
}
