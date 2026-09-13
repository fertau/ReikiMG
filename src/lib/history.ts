import type { SupabaseClient } from '@supabase/supabase-js';

interface HistoryEvent {
  entityType: string;
  entityId?: string | null;
  projectId?: string | null;
  measurementId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra una acción en el historial. Nunca interrumpe la operación
 * principal: si falla el registro, se loguea y se sigue.
 */
export async function logEvent(
  supabase: SupabaseClient,
  actorId: string,
  event: HistoryEvent,
): Promise<void> {
  const { error } = await supabase.from('workflow_history').insert({
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    project_id: event.projectId ?? null,
    measurement_id: event.measurementId ?? null,
    action: event.action,
    description: event.description,
    metadata: event.metadata ?? {},
    actor_id: actorId,
  });

  if (error) {
    console.error('[historial] no se pudo registrar el evento', event.action, error.message);
  }
}
