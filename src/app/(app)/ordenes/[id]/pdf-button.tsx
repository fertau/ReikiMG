'use client';

import { useState } from 'react';
import { PrintIcon } from '@/components/icons';
import {
  PART_LABELS,
  PART_ORDER,
  itemDimensions,
  partDetail,
  partMeasure,
  type OrderPdfData,
} from '@/lib/order-pdf';

const MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface LoadedImage {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  ratio: number;
}

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('lectura fallida'));
      reader.readAsDataURL(blob);
    });

    const ratio = await new Promise<number>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalHeight / image.naturalWidth || 0.75);
      image.onerror = () => resolve(0.75);
      image.src = dataUrl;
    });

    return {
      dataUrl,
      format: blob.type.includes('png') ? 'PNG' : 'JPEG',
      ratio,
    };
  } catch {
    return null;
  }
}

/**
 * Genera el PDF en el navegador. Evita pasar imágenes y datos por el servidor
 * y permite guardarlo desde el celular sin instalar nada.
 */
export function PdfButton({ data }: { data: OrderPdfData }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setBusy(true);
    setError(null);

    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const finalY = () =>
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
        MARGIN;

      let cursor = MARGIN;

      const ensureSpace = (needed: number) => {
        if (cursor + needed > PAGE_HEIGHT - MARGIN - 8) {
          doc.addPage();
          cursor = MARGIN;
        }
      };

      // Encabezado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('ORDEN DE PRODUCCIÓN', MARGIN, cursor + 4);
      doc.setFontSize(14);
      doc.text(data.number, PAGE_WIDTH - MARGIN, cursor + 4, { align: 'right' });
      cursor += 8;
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, cursor, PAGE_WIDTH - MARGIN, cursor);
      cursor += 4;

      autoTable(doc, {
        startY: cursor,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 1.2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 28 },
          1: { cellWidth: 63 },
          2: { fontStyle: 'bold', cellWidth: 28 },
          3: { cellWidth: 63 },
        },
        body: [
          ['Fecha', data.issuedAt, 'Cliente', data.clientName],
          ['Obra', `${data.projectName} (${data.projectCode})`, 'Dirección', data.address ?? '—'],
          [
            'Contacto',
            [data.contactName, data.contactPhone].filter(Boolean).join(' · ') || '—',
            'Entrega',
            data.dueDate ?? '—',
          ],
          ['Relevamiento', data.measurementCode, 'Medidor', data.measuredBy],
          ['Aprobó', data.approvedBy, 'Estado', data.status],
        ],
        margin: { left: MARGIN, right: MARGIN },
      });

      cursor = finalY() + 3;

      if (data.notes) {
        autoTable(doc, {
          startY: cursor,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
          head: [['Indicaciones para producción']],
          body: [[data.notes]],
          margin: { left: MARGIN, right: MARGIN },
        });
        cursor = finalY() + 3;
      }

      for (const [index, item] of data.items.entries()) {
        ensureSpace(40);

        // Título del ítem
        doc.setFillColor(15, 23, 42);
        doc.rect(MARGIN, cursor, CONTENT_WIDTH, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(
          `ÍTEM ${index + 1} · ${item.location} · ${item.room}`,
          MARGIN + 2,
          cursor + 4.8,
        );
        doc.setTextColor(15, 23, 42);
        cursor += 9;

        autoTable(doc, {
          startY: cursor,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 1.8 },
          headStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
          head: [['Producto', 'Cantidad', 'Medidas']],
          body: [
            [
              item.label ? `${item.label} — ${item.product}` : item.product,
              String(item.quantity),
              itemDimensions(item),
            ],
          ],
          columnStyles: { 1: { cellWidth: 22 }, 2: { cellWidth: 45 } },
          margin: { left: MARGIN, right: MARGIN },
        });
        cursor = finalY() + 2;

        if (item.fields.length > 0) {
          const rows: string[][] = [];
          for (let i = 0; i < item.fields.length; i += 2) {
            const left = item.fields[i]!;
            const right = item.fields[i + 1];
            rows.push([
              left.label,
              left.value,
              right?.label ?? '',
              right?.value ?? '',
            ]);
          }

          autoTable(doc, {
            startY: cursor,
            theme: 'striped',
            styles: { fontSize: 8.5, cellPadding: 1.4 },
            headStyles: { fillColor: [241, 245, 249], textColor: 15, fontStyle: 'bold' },
            head: [['Característica', 'Valor', 'Característica', 'Valor']],
            body: rows,
            columnStyles: {
              0: { fontStyle: 'bold', cellWidth: 38 },
              1: { cellWidth: 53 },
              2: { fontStyle: 'bold', cellWidth: 38 },
              3: { cellWidth: 53 },
            },
            margin: { left: MARGIN, right: MARGIN },
          });
          cursor = finalY() + 2;
        }

        const partRows: string[][] = [];
        for (const kind of PART_ORDER) {
          for (const part of item.parts.filter((p) => p.kind === kind)) {
            partRows.push([
              PART_LABELS[kind],
              `${part.quantity}${part.unit ? ` ${part.unit}` : ''}`,
              partMeasure(part),
              [part.description, partDetail(part)].filter(Boolean).join(' · '),
              part.notes ?? '',
            ]);
          }
        }

        if (partRows.length > 0) {
          autoTable(doc, {
            startY: cursor,
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.4 },
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            head: [['Tipo', 'Cant.', 'Medidas', 'Descripción', 'Observación']],
            body: partRows,
            columnStyles: {
              0: { cellWidth: 24 },
              1: { cellWidth: 15 },
              2: { cellWidth: 30 },
              4: { cellWidth: 35 },
            },
            margin: { left: MARGIN, right: MARGIN },
          });
          cursor = finalY() + 2;
        }

        const extra: string[][] = [];
        if (item.notes) extra.push(['Observaciones', item.notes]);
        for (const note of item.item_notes) extra.push(['Nota', note]);

        if (extra.length > 0) {
          autoTable(doc, {
            startY: cursor,
            theme: 'plain',
            styles: { fontSize: 8.5, cellPadding: 1.2 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 } },
            body: extra,
            margin: { left: MARGIN, right: MARGIN },
          });
          cursor = finalY() + 2;
        }

        // Fotografías seleccionadas
        const photos = item.photos.filter((photo) => item.photoUrls[photo.id]);
        if (photos.length > 0) {
          const width = (CONTENT_WIDTH - 4) / 2;

          for (let i = 0; i < photos.length; i += 2) {
            const pair = photos.slice(i, i + 2);
            const loaded = await Promise.all(
              pair.map((photo) => loadImage(item.photoUrls[photo.id]!)),
            );
            const heights = loaded.map((image) =>
              image ? Math.min(width * image.ratio, 70) : 0,
            );
            const rowHeight = Math.max(...heights, 0);
            if (rowHeight === 0) continue;

            ensureSpace(rowHeight + 8);

            pair.forEach((photo, column) => {
              const image = loaded[column];
              if (!image) return;
              const x = MARGIN + column * (width + 4);
              doc.addImage(image.dataUrl, image.format, x, cursor, width, heights[column]!);
              doc.setFontSize(7.5);
              doc.setTextColor(100);
              doc.text(
                [photo.category, photo.caption].filter(Boolean).join(' · ').slice(0, 70),
                x,
                cursor + heights[column]! + 3.2,
              );
              doc.setTextColor(15, 23, 42);
            });

            cursor += rowHeight + 6;
          }
        }

        cursor += 3;
      }

      // Pie de página
      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `${data.number} · ${data.projectName}`,
          MARGIN,
          PAGE_HEIGHT - 8,
        );
        doc.text(`Página ${page} de ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, {
          align: 'right',
        });
      }

      doc.save(`${data.number}.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={build} disabled={busy} className="btn-primary w-full">
        <PrintIcon className="size-5" />
        {busy ? 'Generando PDF…' : 'Descargar PDF'}
      </button>
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
