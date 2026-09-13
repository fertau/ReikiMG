'use client';

import { updateOrderStatus } from '../actions';
import type { OrderStatus } from '@/lib/types';

const NEXT: Partial<Record<OrderStatus, { value: OrderStatus; label: string }[]>> = {
  generada: [{ value: 'en_produccion', label: 'Enviar a producción' }],
  en_produccion: [{ value: 'finalizada', label: 'Marcar como finalizada' }],
};

export function OrderStatusActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const options = NEXT[status] ?? [];
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      {options.map((option) => (
        <form key={option.value} action={updateOrderStatus}>
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="status" value={option.value} />
          <button type="submit" className="btn-secondary w-full">
            {option.label}
          </button>
        </form>
      ))}
    </div>
  );
}
