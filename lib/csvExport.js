export function formatValue(value) {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join('; ');
  }

  if (typeof value === 'object') {
    // Prisma Decimal and other custom objects
    if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
      return value.toString();
    }
    return JSON.stringify(value);
  }

  return '';
}

export function buildCsv(columns, records) {
  const headers = columns.map((col) => escapeCell(col.header));
  const rows = records.map((record) =>
    columns.map((col) => escapeCell(formatValue(record[col.key]))).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function escapeCell(value) {
  const normalized = value ?? '';
  if (normalized === '') return '""';
  const stringValue = normalized.toString();
  const needsQuotes = /[",\n]/.test(stringValue);
  const escaped = stringValue.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : `"${escaped}"`;
}












