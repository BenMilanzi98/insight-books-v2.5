import { launchPuppeteer, PDF_SET_CONTENT_OPTIONS } from './puppeteer-launch';

/**
 * Render receipt / HTML string to PDF (thermal-style HTML from sales receipt route).
 */
export async function receiptHtmlToPdf(htmlString) {
  const browser = await launchPuppeteer();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, PDF_SET_CONTENT_OPTIONS);
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.35in',
        right: '0.35in',
        bottom: '0.35in',
        left: '0.35in',
      },
    });
  } finally {
    await browser.close();
  }
}
