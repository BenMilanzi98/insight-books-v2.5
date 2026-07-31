/** Minimal CSV parser (quoted fields supported). */

export function parseCsv(csvText) {
  const normalizedText = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] !== undefined ? values[i] : '';
    });
    row.rowNumber = index + 2;
    return row;
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((v) => v.replace(/^"|"$/g, ''));
}

export function normalizeColumnName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[%()]/g, '')
    .replace(/[_\s]+/g, ' ');
}

export function getColumnValue(row, possibleNames) {
  const normalizedRow = {};
  Object.keys(row || {}).forEach((key) => {
    if (key === 'rowNumber') return;
    normalizedRow[normalizeColumnName(key)] = row[key];
  });
  for (const name of possibleNames) {
    const key = normalizeColumnName(name);
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== null) {
      return normalizedRow[key];
    }
  }
  return undefined;
}

export const TEMPLATE_HEADERS = [
  'date',
  'reference',
  'customer',
  'description',
  'qty',
  'unit_price',
  'tax_percent',
  'payment_method',
  'notes',
];

export function buildTemplateCsv() {
  const example = [
    '2024-01-15,INV-001,John Doe,Consulting day rate,1,50000,17.5,cash,Migrated from old books',
    '15/01/2024,REC-002,,Walk-in product sale,2,2500,0,mpamba,',
    '2024-01-16,,,Service line description,1,10000,17.5,bank_transfer,No customer',
  ];
  return [TEMPLATE_HEADERS.join(','), ...example].join('\n');
}
