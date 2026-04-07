import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

async function captureAndSave(el: HTMLElement, title?: string): Promise<void> {
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const contentWidth = pageWidth - margin * 2;

  let yOffset = margin;

  if (title) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(40, 40, 40);
    pdf.text(title, margin, yOffset);
    yOffset += 22;
  }

  const sliceHeight = ((pageHeight - margin - yOffset) / contentWidth) * canvas.width;
  let srcY = 0;

  while (srcY < canvas.height) {
    const remaining = canvas.height - srcY;
    const slice = Math.min(sliceHeight, remaining);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = slice;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, slice, 0, 0, canvas.width, slice);

    const sliceData = sliceCanvas.toDataURL('image/png');
    const sliceRenderedHeight = (slice * contentWidth) / canvas.width;
    pdf.addImage(sliceData, 'PNG', margin, yOffset, contentWidth, sliceRenderedHeight);

    srcY += slice;
    if (srcY < canvas.height) {
      pdf.addPage();
      yOffset = margin;
    }
  }

  const fileName = (title ?? 'newton-document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  pdf.save(`${fileName}.pdf`);
}

/** Download the panel's content element as a PDF (preferred — captures full document). */
export async function downloadElementAsPDF(el: HTMLElement, title?: string): Promise<void> {
  await captureAndSave(el, title);
}

/** Fallback: look up by data-message-id in the DOM (captures chat bubble, not full doc). */
export async function downloadMessageAsPDF(messageId: string, title?: string): Promise<void> {
  const el = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
  if (!el) return;
  await captureAndSave(el, title);
}
