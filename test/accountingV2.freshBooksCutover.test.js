/**
 * Phase 6 — Fresh-books V2 + CoA SoT verification gates.
 * Static checks that production code does not invoke retired GL writers.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = join(process.cwd());
const {
  scan,
  POST_GL_ENTRY_ALLOW,
  TRANSACTION_CREATE_ALLOW,
  BALANCE_MUTATION_ALLOW,
} = require('../scripts/forbid-legacy-gl-writers.cjs');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('fresh-books V2 legacy GL writer gates', () => {
  it('forbid-legacy-gl-writers reports zero violations', () => {
    const violations = scan();
    expect(
      violations,
      violations.map((v) => `[${v.rule}] ${v.file}:${v.line}`).join('\n')
    ).toEqual([]);
  });

  it('documents allowlists for dead-code residuals only', () => {
    expect(POST_GL_ENTRY_ALLOW.has('lib/accountingEngine/postGlEntry.js')).toBe(true);
    expect(TRANSACTION_CREATE_ALLOW.has('lib/purchaseAccounting.js')).toBe(true);
    expect(BALANCE_MUTATION_ALLOW.has('lib/accountBalanceService.js')).toBe(true);
    expect(BALANCE_MUTATION_ALLOW.has('lib/purchaseAccounting.js')).toBe(true);
  });

  it('createSaleJournalEntries / createInvoiceJournalEntry throw LEGACY_POSTING_REMOVED', () => {
    const helpers = read('lib/transactionJournalHelpers.js');
    expect(helpers).toMatch(/export async function createSaleJournalEntries/);
    expect(helpers).toMatch(/export async function createInvoiceJournalEntry/);
    expect(helpers).toContain('LEGACY_POSTING_REMOVED');

    const saleFn = helpers.slice(helpers.indexOf('export async function createSaleJournalEntries'));
    const invoiceFn = helpers.slice(helpers.indexOf('export async function createInvoiceJournalEntry'));
    expect(saleFn.slice(0, 400)).toContain('LEGACY_POSTING_REMOVED');
    expect(invoiceFn.slice(0, 400)).toContain('LEGACY_POSTING_REMOVED');
  });

  it('autoPostTaxEntry throws LEGACY_POSTING_REMOVED', () => {
    const tax = read('lib/taxCalculationService.js');
    expect(tax).toMatch(/export async function autoPostTaxEntry/);
    const fn = tax.slice(tax.indexOf('export async function autoPostTaxEntry'));
    expect(fn.slice(0, 400)).toContain('LEGACY_POSTING_REMOVED');
  });

  it('postGlEntry and updateAccountBalanceOnTransaction fail closed', () => {
    const postGl = read('lib/accountingEngine/postGlEntry.js');
    expect(postGl).toContain('LEGACY_POSTING_REMOVED');

    const balances = read('lib/accountBalanceService.js');
    expect(balances).toContain('LEGACY_BALANCE_MUTATION_DISABLED');
  });
});
