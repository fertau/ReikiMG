'use client';

export function PrintButton() {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] gap-2 px-4">
      <button type="button" onClick={() => window.print()} className="btn-primary flex-1">
        Imprimir / Guardar como PDF
      </button>
    </div>
  );
}
