/**
 * Standard export header metadata rows for Excel/PDF/CSV reports.
 * @param {object} scope - from buildReportScopeMetadata / bootstrapReportRoute
 * @param {{ startDate?: string|null, endDate?: string|null, asOfDate?: string|null }} filters
 * @returns {{ label: string, value: string }[]}
 */
export function buildExportHeaderRows(scope, filters = {}) {
  const rows = [];

  if (scope?.businessLabel) {
    rows.push({ label: 'Business(es)', value: scope.businessLabel });
  } else if (scope?.businessNames?.length) {
    rows.push({ label: 'Business(es)', value: scope.businessNames.join(', ') });
  }

  const { startDate, endDate, asOfDate } = filters;
  if (startDate && endDate) {
    rows.push({ label: 'Period', value: `${startDate} to ${endDate}` });
  } else if (asOfDate) {
    rows.push({ label: 'As of', value: asOfDate });
  } else if (endDate) {
    rows.push({ label: 'As of', value: endDate });
  }

  const generated = new Date();
  rows.push({
    label: 'Generated',
    value: generated.toISOString().slice(0, 10),
  });

  if (scope?.reportingCurrency) {
    rows.push({ label: 'Reporting currency', value: scope.reportingCurrency });
  }

  const consolidationNotes = scope?.consolidation?.notes || filters?.consolidation?.notes;
  if (consolidationNotes?.length) {
    rows.push({
      label: 'Consolidation',
      value: consolidationNotes.join(' '),
    });
  }

  return rows;
}

/**
 * Prepend header rows to CSV content (blank line between header block and table).
 */
export function prependHeaderRowsToCsv(csvContent, headerRows) {
  if (!headerRows?.length) return csvContent;
  const headerBlock = headerRows.map((r) => `"${r.label}","${String(r.value).replace(/"/g, '""')}"`).join('\n');
  return `${headerBlock}\n\n${csvContent}`;
}
