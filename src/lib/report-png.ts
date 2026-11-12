import html2canvas from 'html2canvas';

/**
 * Generate PNG blob from a report HTML element.
 */
export async function generatePNG(reportElement: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(reportElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('PNG 생성 실패')),
      'image/png',
    );
  });
}
