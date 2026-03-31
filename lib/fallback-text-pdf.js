// lib/fallback-text-pdf.js
/**
 * Minimal PDF generator that embeds plain text.
 * This is used as a resilient fallback when Puppeteer/Chromium PDF generation fails.
 *
 * Notes:
 * - This does NOT support advanced layout, fonts, or images.
 * - It's intentionally dependency-free and works in Node runtimes.
 */

function escapePdfString(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toPdfTextLines(text) {
  const raw = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Keep lines reasonably short to avoid very long PDF string runs
  const lines = [];
  for (const line of raw.split('\n')) {
    if (line.length <= 90) {
      lines.push(line);
      continue;
    }
    for (let i = 0; i < line.length; i += 90) {
      lines.push(line.slice(i, i + 90));
    }
  }
  return lines;
}

/**
 * Generates a minimal single-page PDF buffer containing the provided [text].
 *
 * @param {string} text
 * @returns {Buffer}
 */
export function textToMinimalPdf(text) {
  const lines = toPdfTextLines(text);
  const startX = 50;
  const startY = 750;
  const lineHeight = 14;

  // Build content stream: each line advances downward.
  const textOps = [];
  textOps.push('BT');
  textOps.push('/F1 10 Tf');
  textOps.push(`${startX} ${startY} Td`);
  for (let i = 0; i < lines.length; i++) {
    const safe = escapePdfString(lines[i]);
    textOps.push(`(${safe}) Tj`);
    if (i < lines.length - 1) {
      textOps.push(`0 -${lineHeight} Td`);
    }
  }
  textOps.push('ET');
  const stream = textOps.join('\n');

  // Basic PDF objects (Catalog, Pages, Page, Contents, Font).
  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n';
  const obj2 = '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n';
  const obj3 =
    '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n>>\nendobj\n';
  const obj4 =
    `4 0 obj\n<<\n/Length ${Buffer.byteLength(stream, 'utf8')}\n>>\nstream\n${stream}\nendstream\nendobj\n`;

  // Compute xref offsets
  const parts = [header, obj1, obj2, obj3, obj4];
  const offsets = [];
  let cursor = 0;
  for (const p of parts) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(p, 'utf8');
  }

  // xref table (5 entries: object 0..4)
  const xrefStart = cursor;
  const xref =
    'xref\n0 5\n' +
    '0000000000 65535 f \n' +
    offsets
      .slice(1) // objs 1..4
      .map((off) => String(off).padStart(10, '0') + ' 00000 n \n')
      .join('');

  const trailer =
    'trailer\n<<\n/Size 5\n/Root 1 0 R\n>>\n' +
    `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(parts.join('') + xref + trailer, 'utf8');
}

