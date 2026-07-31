/**
 * Financial / security control total capture (exact decimal strings).
 * Does not invent balances — aggregates from DB when models exist.
 */

import { parseToMinor, minorToDecimalString } from '../financialPlanning/domain/money.js';

export function emptyFinancialControlTotals(businessId = null) {
  return {
    businessId,
    capturedAt: new Date().toISOString(),
    journalCount: 0,
    journalLineCount: 0,
    totalDebits: '0.00',
    totalCredits: '0.00',
    balanced: true,
    notes: 'Empty template — populate from production query before cutover.',
  };
}

/**
 * Aggregate debit/credit minors from journal line rows.
 * @param {Array<{ debit?: any, credit?: any, debitMinor?: any, creditMinor?: any }>} lines
 */
export function summarizeJournalLines(lines = []) {
  let debit = 0n;
  let credit = 0n;
  for (const l of lines) {
    debit += parseToMinor(l.debitMinor ?? l.debit ?? 0);
    credit += parseToMinor(l.creditMinor ?? l.credit ?? 0);
  }
  return {
    journalLineCount: lines.length,
    totalDebits: minorToDecimalString(debit),
    totalCredits: minorToDecimalString(credit),
    totalDebitsMinor: String(debit),
    totalCreditsMinor: String(credit),
    balanced: debit === credit,
  };
}

export function compareControlTotals(source, target) {
  const diffs = [];
  for (const key of ['journalCount', 'journalLineCount', 'totalDebits', 'totalCredits']) {
    if (String(source?.[key]) !== String(target?.[key])) {
      diffs.push({ key, source: source?.[key], target: target?.[key] });
    }
  }
  return {
    equal: diffs.length === 0 && source?.balanced !== false && target?.balanced !== false,
    diffs,
  };
}

export function emptySecurityControlTotals() {
  return {
    capturedAt: new Date().toISOString(),
    userCount: null,
    activeUserCount: null,
    membershipCount: null,
    roleCount: null,
    permissionAssignmentCount: null,
    approvalPolicyCount: null,
    auditEventCount: null,
    notes: 'TO FILL FROM PRODUCTION',
  };
}

export function emptyDocumentControlTotals() {
  return {
    capturedAt: new Date().toISOString(),
    fileCount: null,
    totalBytes: null,
    missingHashCount: null,
    notes: 'TO FILL FROM PRODUCTION — do not embed file contents',
  };
}
