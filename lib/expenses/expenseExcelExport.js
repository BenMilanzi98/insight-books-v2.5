/**
 * Expense xlsx backup export (ExcelJS).
 * Sheets: Export Manifest, Expenses, Expense Lines, Payments.
 */

const FORMULA_INJECTION = /^[=+\-@\t\r]/;

/** Neutralize spreadsheet formula injection for text cells. */
export function sanitizeCell(value) {
  if (value == null) return '';
  const text = String(value);
  return FORMULA_INJECTION.test(text) ? `'${text}` : text;
}

function cell(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.toISOString();
  return sanitizeCell(value);
}

function toNumber(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return sanitizeCell(value);
  return d.toISOString().slice(0, 10);
}

/**
 * Build an Excel workbook buffer for expense backup / round-trip.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {object[]} params.expenses
 * @param {object[]} [params.payments]
 * @param {object} [params.meta]
 * @returns {Promise<Buffer>}
 */
export async function buildExpenseWorkbookBuffer({
  tenantId,
  expenses = [],
  payments = [],
  meta = {},
}) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InsightBooks';
  workbook.created = new Date();

  const manifest = workbook.addWorksheet('Export Manifest');
  manifest.columns = [
    { header: 'Key', key: 'key', width: 28 },
    { header: 'Value', key: 'value', width: 56 },
  ];
  const manifestRows = [
    ['format', 'insightbooks-expense-backup'],
    ['formatVersion', meta.formatVersion || '1.0'],
    ['tenantId', tenantId],
    ['exportedAt', meta.exportedAt || new Date().toISOString()],
    ['exportedBy', meta.exportedBy || ''],
    ['expenseCount', expenses.length],
    ['paymentCount', payments.length],
    ['modeHints', 'NEW_EXPENSE_IMPORT|DRAFT_ONLY_IMPORT|RECONCILE_EXISTING'],
    ['notes', meta.notes || 'Accounts resolved by account code + tenantId only on import'],
  ];
  for (const [key, value] of manifestRows) {
    manifest.addRow({ key: sanitizeCell(key), value: cell(value) });
  }
  manifest.getRow(1).font = { bold: true };

  const expensesSheet = workbook.addWorksheet('Expenses');
  const expenseHeaders = [
    'expenseId',
    'date',
    'description',
    'category',
    'accountCode',
    'accountName',
    'amount',
    'taxAmount',
    'taxRate',
    'paymentStatus',
    'status',
    'paymentMethod',
    'paidAmount',
    'merchant',
    'supplierId',
    'branchId',
    'originalReference',
    'notes',
    'externalRef',
  ];
  expensesSheet.columns = expenseHeaders.map((h) => ({ header: h, key: h, width: 18 }));
  expensesSheet.getRow(1).font = { bold: true };

  for (const e of expenses) {
    const account = e.expenseAccount || e.account || {};
    expensesSheet.addRow({
      expenseId: cell(e.id),
      date: formatDate(e.date),
      description: cell(e.description),
      category: cell(e.category),
      accountCode: cell(account.accountCode || account.code || e.accountCode),
      accountName: cell(account.accountName || account.name || e.accountName),
      amount: toNumber(e.amount),
      taxAmount: toNumber(e.taxAmount),
      taxRate: toNumber(e.taxRate),
      paymentStatus: cell(e.paymentStatus),
      status: cell(e.status),
      paymentMethod: cell(e.paymentMethod),
      paidAmount: toNumber(e.paidAmount),
      merchant: cell(e.merchant),
      supplierId: cell(e.supplierId),
      branchId: cell(e.branchId),
      originalReference: cell(e.originalReference),
      notes: cell(e.notes),
      externalRef: cell(e.externalRef || e.originalReference),
    });
  }

  const linesSheet = workbook.addWorksheet('Expense Lines');
  const lineHeaders = [
    'expenseId',
    'lineNumber',
    'accountCode',
    'accountName',
    'description',
    'amount',
    'taxAmount',
  ];
  linesSheet.columns = lineHeaders.map((h) => ({ header: h, key: h, width: 18 }));
  linesSheet.getRow(1).font = { bold: true };

  let lineNo = 1;
  for (const e of expenses) {
    const account = e.expenseAccount || e.account || {};
    linesSheet.addRow({
      expenseId: cell(e.id),
      lineNumber: lineNo++,
      accountCode: cell(account.accountCode || account.code || e.accountCode),
      accountName: cell(account.accountName || account.name || e.accountName),
      description: cell(e.description),
      amount: toNumber(e.amount),
      taxAmount: toNumber(e.taxAmount),
    });
  }

  const paymentsSheet = workbook.addWorksheet('Payments');
  const paymentHeaders = [
    'paymentId',
    'expenseId',
    'paymentDate',
    'amount',
    'paymentMethod',
    'reference',
    'status',
    'notes',
  ];
  paymentsSheet.columns = paymentHeaders.map((h) => ({ header: h, key: h, width: 18 }));
  paymentsSheet.getRow(1).font = { bold: true };

  for (const p of payments) {
    paymentsSheet.addRow({
      paymentId: cell(p.id),
      expenseId: cell(p.expenseId),
      paymentDate: formatDate(p.paymentDate),
      amount: toNumber(p.amount),
      paymentMethod: cell(p.paymentMethod),
      reference: cell(p.reference),
      status: cell(p.status),
      notes: cell(p.notes),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
