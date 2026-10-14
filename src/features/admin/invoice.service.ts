import { renderInvoiceHTML, type InvoiceData } from './invoice.template';

export type { InvoiceData };

/**
 * Generate and download a PDF invoice for a single transaction.
 *
 * Strategy:
 *   1. Render an HTML invoice off-screen
 *   2. Convert to canvas via html2canvas
 *   3. Embed as image in jsPDF
 *
 * NOTE: jsPDF and html2canvas are imported dynamically
 *       so they only load when the user clicks "Download PDF".
 *       This keeps the initial bundle under 500 KB.
 */
export async function downloadInvoicePDF(data: InvoiceData): Promise<void> {
  // Dynamic imports — loaded only when this function is called
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const html = renderInvoiceHTML(data);

  // Create a hidden container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.zIndex = '-1';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const target = container.querySelector('#invoice-root') as HTMLElement;
    if (!target) throw new Error('INVOICE_ROOT_NOT_FOUND');

    // Wait a tick for fonts to settle
    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');

    // A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // If image is taller than page, scale it down
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;
    if (imgHeight > pageHeight) {
      finalHeight = pageHeight;
      finalWidth = (canvas.width * finalHeight) / canvas.height;
    }

    const xOffset = (pageWidth - finalWidth) / 2;

    pdf.addImage(imgData, 'PNG', xOffset, 0, finalWidth, finalHeight);

    const filename = `invoice-${data.transaction.code}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}