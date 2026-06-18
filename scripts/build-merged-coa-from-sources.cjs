#!/usr/bin/env node
/**
 * Build scripts/_merged-coa.json from the Excel export + supplemental MD accounts.
 * Run: node scripts/build-merged-coa-from-sources.cjs [path-to-xlsx]
 * Then: node scripts/generate-coa-blueprint.cjs
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const xlsxPath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Downloads', 'chart-of-accounts_2026-06-01_2026-06-17.xlsx');

if (!fs.existsSync(xlsxPath)) {
  console.error('Excel file not found:', xlsxPath);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const excel = XLSX.utils.sheet_to_json(wb.Sheets['ChartOfAccounts']).map((r) => ({
  code: String(r['Account Code']).trim(),
  name: String(r['Account Name']).trim(),
  type: r.Type === 'Income' ? 'Income' : r.Type,
  normalBalance: r['Normal Balance'],
}));

/** Malawi banks + mobile/receivable accounts (canonical platform chart). */
const mdExtras = [
  { code: '1131', name: 'National Bank of Malawi', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1132', name: 'Standard Bank Malawi', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1133', name: 'FDH Bank', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1134', name: 'NBS Bank', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1135', name: 'First Capital Bank', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1136', name: 'Ecobank Malawi', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1137', name: 'Centenary Bank Malawi', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1138', name: 'CDH Investment Bank', type: 'Asset', parentCode: '1130', subtype: 'Current Asset' },
  { code: '1140', name: 'Mobile Money - Airtel Money', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1141', name: 'Mobile Money - TNM Mpamba', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1145', name: 'POS Card Clearing', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1218', name: 'Insurance Receivable — Control', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1240', name: 'VAT Recoverable', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
];

const RETIRED_CODES = new Set(['1130-01', '1130-02']);

const parentMap = {
  1100: '1000',
  1500: '1000',
  1900: '1000',
  1110: '1100',
  1120: '1100',
  1130: '1100',
  1140: '1100',
  1141: '1100',
  1145: '1100',
  1200: '1100',
  1210: '1100',
  1215: '1100',
  1216: '1100',
  1218: '1100',
  1240: '1100',
  1300: '1100',
  1131: '1130',
  1132: '1130',
  1133: '1130',
  1134: '1130',
  1135: '1130',
  1136: '1130',
  1137: '1130',
  1138: '1130',
  1310: '1300',
  1320: '1300',
  1330: '1300',
  1510: '1500',
  1520: '1500',
  1530: '1500',
  1540: '1500',
  1590: '1500',
  1910: '1900',
  1920: '1900',
  1999: '1900',
  2041: '2000',
  2045: '2000',
  2100: '2000',
  2500: '2000',
  2999: '2500',
  2110: '2100',
  2120: '2100',
  2130: '2100',
  2140: '2100',
  2150: '2100',
  2160: '2100',
  2510: '2500',
  2520: '2500',
  3100: '3000',
  3200: '3000',
  3300: '3000',
  3999: '3000',
  4100: '4000',
  4110: '4000',
  4150: '4000',
  4200: '4000',
  4300: '4000',
  4900: '4000',
  5100: '5000',
  5200: '5000',
  5300: '5000',
  5301: '5000',
  5310: '5000',
  5320: '5000',
  5330: '5000',
  5340: '5000',
  5400: '5000',
  5500: '5000',
  5700: '5000',
  5900: '5000',
  5110: '5100',
  5120: '5100',
  5130: '5100',
  5140: '5100',
};

const groupCodes = new Set([
  '1000',
  '1100',
  '1130',
  '1300',
  '1500',
  '1900',
  '2000',
  '2100',
  '2500',
  '3000',
  '4000',
  '5000',
  '5100',
  '5700',
]);

function subtypeFor(code, type) {
  if (groupCodes.has(code)) return 'Group';
  if (code === '1590') return 'Non-current Asset';
  if (type === 'Asset') {
    return code.startsWith('15') || code.startsWith('19') ? 'Non-current Asset' : 'Current Asset';
  }
  if (type === 'Liability') {
    return ['2500', '2510', '2520', '2999'].includes(code)
      ? 'Non-current Liability'
      : 'Current Liability';
  }
  if (type === 'Equity') return 'Equity';
  if (type === 'Income') return 'Operating Income';
  if (code.startsWith('51')) return 'Cost of Sales';
  return 'Operating Expense';
}

const byCode = new Map();
for (const r of excel) {
  if (RETIRED_CODES.has(r.code)) continue;
  byCode.set(r.code, {
    ...r,
    parentCode: parentMap[r.code] || null,
    subtype: subtypeFor(r.code, r.type),
    isSystem: true,
  });
}
for (const r of mdExtras) {
  byCode.set(r.code, { ...r, normalBalance: 'Debit', isSystem: true });
}

const ordered = [...byCode.values()].sort((a, b) =>
  a.code.localeCompare(b.code, undefined, { numeric: true })
);

if (ordered.length !== new Set(ordered.map((x) => x.code)).size) {
  throw new Error('Duplicate account codes in merged chart');
}

const outPath = path.join(__dirname, '_merged-coa.json');
fs.writeFileSync(outPath, JSON.stringify(ordered, null, 2));
console.log(`Wrote ${ordered.length} accounts to ${outPath}`);
