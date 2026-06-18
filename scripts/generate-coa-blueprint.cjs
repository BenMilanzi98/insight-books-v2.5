#!/usr/bin/env node
/**
 * Regenerate lib/chartOfAccountsBlueprint.js from scripts/_merged-coa.json
 */
const fs = require('fs');
const path = require('path');

const rows = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_merged-coa.json'), 'utf8')
);

const descriptions = {
  '1000':
    'Header only — roll-up of asset children. Do not post journals here.',
  '2000':
    'Header only — roll-up of liability children. Post to AP, loans, statutory accounts, etc.',
  '3000':
    'Header only — roll-up of equity lines. Post to capital, retained earnings, 3999 suspense, etc.',
  '4000':
    'Header only — roll-up of revenue. Post to 4100, 4110, 4300, 4900, etc.',
  '5000':
    'Header only — roll-up of expense children. Post to COGS subtree, salaries, rent, 5900 other, etc.',
  '1130':
    'Parent for Malawi bank GL accounts (1131–1138). Bare 1130 is rollup-only.',
  '1110': 'Primary cash on hand — all cash GL postings use this account.',
  '1120': 'Till float and petty cash.',
  '1200': 'Trade receivables.',
  '2110': 'Trade payables.',
  '3999': 'System suspense for opening balance workflow.',
    '5200': 'Employee salaries and wages.',
    '5350': 'Software, SaaS, cloud hosting, domains, and IT subscriptions.',
  '5700': 'Header for tenant-defined expense accounts (5701–5899).',
  '1999':
    'Catch-all for asset-range codes (1000–1999) pending reclassification.',
  '2999':
    'Catch-all for liability-range codes (2000–2999) pending reclassification.',
  '4900':
    'Catch-all for revenue-range codes (4000–4900) pending reclassification.',
  '5900':
    'Catch-all for expense-range codes (5000–5900) pending reclassification.',
  '2041': 'Default account for tax collected from sales, invoices and POS.',
  '2045': 'Default account for tax on expenses and supplier bills.',
};

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function defaultNormal(type) {
  return type === 'Asset' || type === 'Expense' ? 'Debit' : 'Credit';
}

let out = `/**
 * Canonical Chart of Accounts blueprint (hierarchical GL).
 * Merged from platform export (2026-06) + extended bank/mobile/receivable accounts.
 * Five roots: 1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Revenue, 5000 Expenses.
 * All accounts are system-managed (isSystem: true) and provisioned automatically for new tenants.
 *
 * Posting conventions: cash GL uses 1110; bank accounts under 1130; mobile money 1140/1141; POS clearing 1145.
 */

/** @typedef {'Asset'|'Liability'|'Equity'|'Income'|'Expense'} CoaAccountType */

/**
 * @typedef {Object} CoaBlueprintRow
 * @property {string} code
 * @property {string} name
 * @property {CoaAccountType} type
 * @property {'Debit'|'Credit'} [normalBalance]
 * @property {string} [subtype]
 * @property {string} [parentCode]
 * @property {string} [description]
 * @property {boolean} [isSystem]
 * @property {boolean} [requiresReclassification]
 */

/** @type {CoaBlueprintRow[]} */
export const CHART_OF_ACCOUNTS_BLUEPRINT = [
`;

for (const r of rows) {
  const parts = [
    `  { code: '${esc(r.code)}', name: '${esc(r.name)}', type: '${r.type}'`,
  ];
  if (r.parentCode) parts.push(`parentCode: '${esc(r.parentCode)}'`);
  parts.push(`subtype: '${esc(r.subtype)}'`);
  parts.push('isSystem: true');
  const nb = r.normalBalance || defaultNormal(r.type);
  if (nb !== defaultNormal(r.type)) {
    parts.push(`normalBalance: '${nb}'`);
  }
  if (descriptions[r.code]) {
    parts.push(`description: '${esc(descriptions[r.code])}'`);
  }
  if (['1999', '2999', '4900', '5900'].includes(r.code)) {
    parts.push('requiresReclassification: true');
  }
  out += `${parts.join(', ') } },\n`;
}

out += '];\n';

const outPath = path.join(__dirname, '..', 'lib', 'chartOfAccountsBlueprint.js');
fs.writeFileSync(outPath, out);
console.log(`Wrote ${rows.length} accounts to ${outPath}`);
