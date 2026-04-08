/**
 * PDF export using jsPDF + html2canvas.
 *
 * Renders the document element off-screen at a fixed A4-width, captures it
 * with html2canvas, slices it into A4 pages, and triggers a real file download
 * — no print dialog involved.
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 15;
const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;  // 180 mm
const CONTENT_H_MM = A4_H_MM - MARGIN_MM * 2;  // 267 mm

/** CSS pixel width we render into (≈ A4 at 96 dpi with side padding removed). */
const RENDER_PX = 740;

/** html2canvas scale factor — 2× gives crisp, retina-quality text. */
const SCALE = 2;

async function generatePDF(el: HTMLElement, title?: string): Promise<void> {
  // ── 1. Build an off-screen, A4-width clone of the content ──────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;top:-99999px;left:-99999px;' +
    `width:${RENDER_PX}px;padding:40px 48px;` +
    'background:#fff;box-sizing:border-box;' +
    'font-family:"Work Sans",sans-serif;font-size:14px;' +
    'line-height:1.7;color:#1a202c;';

  // Optional document title header
  if (title) {
    const titleEl = document.createElement('div');
    titleEl.style.cssText =
      'font-size:20px;font-weight:700;color:#1a202c;' +
      'margin:0 0 18px;padding-bottom:10px;' +
      'border-bottom:2px solid #e2e8f0;';
    titleEl.textContent = title;
    wrap.appendChild(titleEl);
  }

  // Clone the content node so we can strip UI chrome without mutating the DOM
  const body = document.createElement('div');
  // Carry over classes (e.g. 'doc-panel-content message-text') so the
  // document's existing stylesheets keep applying.
  body.className = el.className;
  body.innerHTML = el.innerHTML;
  body.querySelectorAll<HTMLElement>('.copy-code-btn, button').forEach(
    b => (b.style.display = 'none')
  );
  wrap.appendChild(body);
  document.body.appendChild(wrap);

  try {
    // ── 2. Render to canvas ─────────────────────────────────────────────────
    const canvas = await html2canvas(wrap, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // ── 3. Slice canvas into A4 pages and build PDF ─────────────────────────
    // canvas.width = RENDER_PX * SCALE (e.g. 1480 px) → maps to CONTENT_W_MM
    const pxPerMm = canvas.width / CONTENT_W_MM;
    const pageHeightPx = CONTENT_H_MM * pxPerMm;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let yPx = 0;
    let pageIdx = 0;

    while (yPx < canvas.height) {
      if (pageIdx++ > 0) pdf.addPage();

      const sliceH = Math.min(pageHeightPx, canvas.height - yPx);

      // Draw the relevant strip of the full canvas into a page-sized slice
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil(sliceH);
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0, yPx, canvas.width, sliceH,
        0, 0,   canvas.width, sliceH,
      );

      pdf.addImage(
        slice.toDataURL('image/jpeg', 0.95),
        'JPEG',
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_W_MM,
        sliceH / pxPerMm,
      );

      yPx += sliceH;
    }

    // ── 4. Trigger download ─────────────────────────────────────────────────
    const fileName =
      (title ?? 'document')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') + '.pdf';
    pdf.save(fileName);
  } finally {
    document.body.removeChild(wrap);
  }
}

/** Download the panel's content element as a PDF. */
export async function downloadElementAsPDF(el: HTMLElement, title?: string): Promise<void> {
  await generatePDF(el, title);
}

/** Fallback: look up by data-message-id in the DOM. */
export async function downloadMessageAsPDF(messageId: string, title?: string): Promise<void> {
  const el = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
  if (!el) return;
  await generatePDF(el, title);
}
