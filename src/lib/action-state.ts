import { z } from 'zod';

export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Id de la entidad creada, para redirigir desde el cliente. */
  id?: string;
}

export const idleState: ActionState = { ok: false };

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors };
}

export function succeed(message?: string, id?: string): ActionState {
  return { ok: true, message, id };
}

/** Convierte los errores de zod al formato plano que consumen los formularios. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): { data: z.infer<T>; error?: never } | { data?: never; error: ActionState } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      const list = (raw[k] as string[] | undefined) ?? [];
      list.push(value);
      raw[k] = list;
    } else {
      raw[key] = value;
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      error: fail('Revisá los datos ingresados.', zodFieldErrors(result.error)),
    };
  }
  return { data: result.data };
}

/** Texto opcional: '' se normaliza a null para no guardar cadenas vacías. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} es obligatorio`).max(max);

export const optionalNumber = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
  .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), 'Valor numérico inválido')
  .nullable();
