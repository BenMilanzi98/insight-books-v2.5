/**
 * Excel export helpers — GL account detail sheets for accountant-friendly exports.
 */

const GL_DETAIL_HEADERS = [
  'Account Code',
  'Account Name',
  'Account Type',
  'Normal Balance',
  'Opening Balance',
  'Period Debit',
  'Period Credit',
  'Net Movement',
  'Closing Balance',
];

/**
 * @param {import('exceljs').Workbook} workbook
 * @param {object[]} accountLines
 * @param {string} [sheetName]
 */
export async function appendGlAccountDetailSheet(workbook, accountLines, sheetName = 'GL Account Detail') {
  if (!accountLines?.length) return workbook;

  const ws = workbook.addWorksheet(sheetName.slice(0, 31), { views: [{ state: 'normal' }] });
  const currencyNumFmt = '#,##0.00;(#,##0.00)';

  const headerRow = ws.addRow(GL_DETAIL_HEADERS);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
  });

  for (const line of accountLines) {
    const row = ws.addRow([
      line.accountCode || '',
      line.accountName || line.label || '',
      line.accountType || '',
      line.normalBalance || '',
      Number(line.openingBalance ?? 0),
      Number(line.periodDebit ?? line.debitTotal ?? 0),
      Number(line.periodCredit ?? line.creditTotal ?? 0),
      Number(line.netMovement ?? 0),
      Number(line.closingBalance ?? line.amount ?? 0),
    ]);
    [5, 6, 7, 8, 9].forEach((col) => {
      const cell = row.getCell(col);
      cell.numFmt = currencyNumFmt;
      cell.alignment = { horizontal: 'right' };
    });
  }

  ws.columns = [
    { width: 14 },
    { width: 36 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  return workbook;
}

/**
 * @param {object[]} accountLines
 */
export function glAccountLinesToCsvRows(accountLines) {
  if (!accountLines?.length) return [];
  return accountLines.map((line) => ({
    accountCode: line.accountCode || '',
    accountName: line.accountName || '',
    accountType: line.accountType || '',
    openingBalance: line.openingBalance ?? 0,
    periodDebit: line.periodDebit ?? 0,
    periodCredit: line.periodCredit ?? 0,
    netMovement: line.netMovement ?? 0,
    closingBalance: line.closingBalance ?? line.amount ?? 0,
  }));
}
