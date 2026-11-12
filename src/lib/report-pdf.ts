import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generate PDF from a report HTML element.
 * Renders to canvas then places on A4 PDF.
 */
export async function generatePDF(reportElement: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(reportElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const width = imgWidth * ratio;
  const height = imgHeight * ratio;
  const x = (pdfWidth - width) / 2;

  pdf.addImage(imgData, 'PNG', x, 0, width, height);

  return pdf.output('blob');
}
