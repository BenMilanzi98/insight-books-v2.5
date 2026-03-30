import puppeteer from 'puppeteer';

/**
 * Render receipt / HTML string to PDF (thermal-style HTML from sales receipt route).
 */
export async function receiptHtmlToPdf(htmlString) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });
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
