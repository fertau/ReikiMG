'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MicIcon, TrashIcon } from '@/components/icons';
import { duration as formatDuration } from '@/lib/format';
import { registerAudio } from '../../audio-actions';

const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function baseType(mime: string): string {
  return mime.split(';')[0] ?? mime;
}

function extensionFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'audio';
}

type Phase = 'idle' | 'recording' | 'recorded' | 'saving';

export function AudioRecorder({
  itemId,
  measurementId,
}: {
  itemId: string;
  measurementId: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
  }

  async function startRecording() {
    setError(null);

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite grabar audio. Probá con Chrome o Safari actualizado.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        setPhase('recorded');
      };

      recorder.start();
      recorderRef.current = recorder;
      resetPreview();
      setPhase('recording');

      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      setError('No se pudo acceder al micrófono. Revisá los permisos del navegador.');
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
  }

  async function save() {
    const blob = blobRef.current;
    if (!blob) return;

    setPhase('saving');
    setError(null);

    try {
      const type = baseType(blob.type || 'audio/webm');
      const path = `${measurementId}/${itemId}/${crypto.randomUUID()}.${extensionFor(type)}`;
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from('item-audio')
        .upload(path, blob, { contentType: type, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const formData = new FormData();
      formData.set('item_id', itemId);
      formData.set('storage_path', path);
      formData.set('duration_seconds', String(seconds));
      formData.set('mime_type', type);
      formData.set('byte_size', String(blob.size));

      const result = await registerAudio({ ok: false }, formData);
      if (!result.ok) throw new Error(result.error ?? 'No se pudo registrar el audio');

      resetPreview();
      setPhase('idle');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al guardar el audio');
      setPhase('recorded');
    }
  }

  return (
    <div className="card-pad space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        {phase === 'recording' ? (
          <>
            <span className="text-3xl font-bold tabular-nums text-red-600">
              {formatDuration(seconds)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="flex size-28 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition active:scale-95"
              aria-label="Detener grabación"
            >
              <span className="size-10 rounded-md bg-white" />
            </button>
            <p className="text-sm font-medium text-red-600">Grabando… tocá para detener</p>
          </>
        ) : phase === 'recorded' ? (
          <>
            <span className="text-2xl font-bold tabular-nums text-ink">
              {formatDuration(seconds)}
            </span>
            {previewUrl ? (
              <audio src={previewUrl} controls className="w-full" preload="metadata" />
            ) : null}
            <div className="grid w-full grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  resetPreview();
                  setPhase('idle');
                }}
                className="btn-secondary text-red-600"
              >
                <TrashIcon className="size-5" />
                Descartar
              </button>
              <button type="button" onClick={save} className="btn-primary">
                Guardar
              </button>
            </div>
            <button type="button" onClick={startRecording} className="btn-ghost btn-sm w-full">
              Volver a grabar
            </button>
          </>
        ) : phase === 'saving' ? (
          <p className="py-8 font-semibold text-muted">Guardando audio…</p>
        ) : (
          <>
            <button
              type="button"
              onClick={startRecording}
              className="flex size-28 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition active:scale-95"
              aria-label="Grabar nota de voz"
            >
              <MicIcon className="size-12" />
            </button>
            <p className="text-sm font-medium text-slate-600">Tocá para grabar</p>
          </>
        )}
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
