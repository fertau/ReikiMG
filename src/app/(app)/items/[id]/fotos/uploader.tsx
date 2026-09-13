'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CameraIcon } from '@/components/icons';
import { registerPhoto } from '../../photo-actions';
import type { PhotoCategory } from '@/lib/types';

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Reduce la foto antes de subirla. En obra se trabaja con datos móviles:
 * una foto de 4 MB tarda y a veces falla; 1600 px alcanza para ver un detalle
 * o leer un croquis.
 */
async function compress(file: File): Promise<{ blob: Blob; type: string }> {
  if (!file.type.startsWith('image/')) return { blob: file, type: file.type };

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { blob: file, type: file.type };
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );

    if (!blob) return { blob: file, type: file.type };
    return { blob, type: 'image/jpeg' };
  } catch {
    return { blob: file, type: file.type };
  }
}

export function PhotoUploader({
  itemId,
  measurementId,
  categories,
}: {
  itemId: string;
  measurementId: string;
  categories: PhotoCategory[];
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories[0]?.code ?? 'general');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const supabase = createClient();
    const list = Array.from(files);

    for (let index = 0; index < list.length; index += 1) {
      const file = list[index]!;
      setBusy(`Subiendo ${index + 1} de ${list.length}…`);

      try {
        const { blob, type } = await compress(file);
        const extension = type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
        const path = `${measurementId}/${itemId}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('item-photos')
          .upload(path, blob, { contentType: type, upsert: false });

        if (uploadError) throw new Error(uploadError.message);

        const formData = new FormData();
        formData.set('item_id', itemId);
        formData.set('storage_path', path);
        formData.set('category', category);
        formData.set('mime_type', type);
        formData.set('byte_size', String(blob.size));

        const result = await registerPhoto({ ok: false }, formData);
        if (!result.ok) throw new Error(result.error ?? 'No se pudo registrar la foto');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Error al subir la foto');
        break;
      }
    }

    setBusy(null);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    router.refresh();
  }

  return (
    <div className="card-pad space-y-3">
      <div>
        <label className="label" htmlFor="photo-category">
          Categoría de las próximas fotos
        </label>
        <select
          id="photo-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="input appearance-none"
        >
          {categories.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <button
        type="button"
        className="btn-primary w-full py-4"
        disabled={busy !== null}
        onClick={() => cameraRef.current?.click()}
      >
        <CameraIcon className="size-6" />
        {busy ?? 'SACAR FOTO'}
      </button>

      <button
        type="button"
        className="btn-secondary w-full"
        disabled={busy !== null}
        onClick={() => galleryRef.current?.click()}
      >
        Elegir de la galería
      </button>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
