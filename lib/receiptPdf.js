import { launchPuppeteer, PDF_SET_CONTENT_OPTIONS } from './puppeteer-launch';

/**
 * Render receipt / HTML string to PDF sized for an 80mm thermal printer.
 */
export async function receiptHtmlToPdf(htmlString) {
  const browser = await launchPuppeteer();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, PDF_SET_CONTENT_OPTIONS);
    return await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' },
    });
  } finally {
    await browser.close();
  }
}
