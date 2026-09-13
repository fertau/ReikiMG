import { displayName, formatDateTime } from '@/lib/format';
import type { WorkflowEvent } from '@/lib/types';

export function HistoryList({ events }: { events: WorkflowEvent[] }) {
  if (events.length === 0) {
    return <p className="px-1 text-sm text-muted">Sin movimientos registrados.</p>;
  }

  return (
    <ol className="card divide-y divide-slate-100">
      {events.map((event) => {
        const motivo =
          typeof event.metadata?.motivo === 'string' ? event.metadata.motivo : null;

        return (
          <li key={event.id} className="px-4 py-3">
            <p className="text-sm text-ink">
              <span className="font-semibold">{displayName(event.actor)}</span>{' '}
              {event.description}
            </p>
            {motivo ? (
              <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-sm text-red-800">
                {motivo}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted">{formatDateTime(event.created_at)}</p>
          </li>
        );
      })}
    </ol>
  );
}
