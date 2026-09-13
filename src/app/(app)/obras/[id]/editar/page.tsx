import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { BackLink, PageHeader } from '@/components/ui';
import { ProjectForm } from '../../project-form';
import { updateProject } from '../../actions';
import type { AppUser, Project } from '@/lib/types';

export const metadata: Metadata = { title: 'Editar obra' };

export default async function EditarObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('supervisor');
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: staff }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('users')
      .select('id, full_name, email, is_active')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  if (!project) notFound();

  return (
    <>
      <BackLink href={`/obras/${id}`} label="Volver a la obra" />
      <PageHeader title="Editar obra" subtitle={project.code} />
      <div className="card-pad">
        <ProjectForm
          action={updateProject}
          project={project as unknown as Project}
          staff={(staff ?? []) as unknown as AppUser[]}
          submitLabel="Guardar cambios"
        />
      </div>
    </>
  );
}
