/**
 * Cash-basis (Collected) P&L movements: only journals that touch cash/bank
 * accounts contribute; P&L impact is taken from non-cash counter-lines on those journals.
 */
import { listCanonicalLines } from '../ledger/canonicalJournalSource.js';
import { resolveAccountProfile, isAmountBearingAccount } from './reportDefinitions.js';
import { presentBalance, resolveNormalBalance } from '../ledger/ledgerQueryService.js';

function toAccountRow(account, periodDebitMinor, periodCreditMinor, lineCount) {
  const { normalBalance, source, warning } = resolveNormalBalance(account);
  const openingSigned = 0;
  const movementSigned = periodDebitMinor - periodCreditMinor;
  const closingSigned = movementSigned;
  return {
    accountId: account.id,
    id: account.id,
    accountCode: account.accountCode ?? account.code,
    accountName: account.accountName ?? account.name,
    code: account.accountCode ?? account.code,
    name: account.accountName ?? account.name,
    coaV2Category: account.coaV2Category,
    coaV2SubType: account.coaV2SubType,
    coaV2Section: account.coaV2Section,
    coaV2Purpose: account.coaV2Purpose,
    coaV2CashFlowClass: account.coaV2CashFlowClass,
    coaV2ControlPurpose: account.coaV2ControlPurpose,
    accountType: account.accountType ?? account.type,
    type: account.type ?? account.accountType,
    normalBalance,
    normalBalanceSource: source,
    normalBalanceWarning: warning,
    opening: presentBalance(openingSigned, normalBalance),
    periodDebitMinor,
    periodCreditMinor,
    closing: presentBalance(closingSigned, normalBalance),
    lineCount,
    hasDirectActivity: periodDebitMinor !== 0 || periodCreditMinor !== 0,
    exceptionalPostingAccount: false,
  };
}

/**
 * @returns {Promise<{
 *   accounts: object[],
 *   sourceTypeByAccount: Map<string, Map<string, { debitMinor: number, creditMinor: number, lineCount: number }>>,
 *   anomalies: object[],
 * }>}
 */
export async function buildCashBasisAccountMovements(db, context, scope) {
  const tenantId = context.businessId;
  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true, mergedIntoAccountId: null },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const cashIds = new Set();
  const pnlIds = new Set();
  for (const a of accounts) {
    const profile = resolveAccountProfile({
      ...a,
      accountId: a.id,
    });
    if (profile.isCash) cashIds.add(a.id);
    if (profile.isPnl && isAmountBearingAccount(a)) pnlIds.add(a.id);
  }

  const lines = await listCanonicalLines(db, context, {
    startDate: scope.fromDate ?? undefined,
    endDate: scope.toDate ?? undefined,
    branchId: scope.branchId ?? null,
  });

  const cashJournals = new Set();
  for (const line of lines) {
    if (cashIds.has(line.accountId)) cashJournals.add(line.journalId);
  }

  /** @type {Map<string, { debitMinor: number, creditMinor: number, lineCount: number }>} */
  const byAccount = new Map();
  /** @type {Map<string, Map<string, { debitMinor: number, creditMinor: number, lineCount: number }>>} */
  const sourceTypeByAccount = new Map();

  for (const line of lines) {
    if (!cashJournals.has(line.journalId)) continue;
    if (!pnlIds.has(line.accountId)) continue;
    const cur = byAccount.get(line.accountId) || { debitMinor: 0, creditMinor: 0, lineCount: 0 };
    cur.debitMinor += line.debitMinor || 0;
    cur.creditMinor += line.creditMinor || 0;
    cur.lineCount += 1;
    byAccount.set(line.accountId, cur);

    const src = String(line.sourceType || 'MANUAL').toUpperCase();
    if (!sourceTypeByAccount.has(line.accountId)) sourceTypeByAccount.set(line.accountId, new Map());
    const sm = sourceTypeByAccount.get(line.accountId);
    const sCur = sm.get(src) || { debitMinor: 0, creditMinor: 0, lineCount: 0 };
    sCur.debitMinor += line.debitMinor || 0;
    sCur.creditMinor += line.creditMinor || 0;
    sCur.lineCount += 1;
    sm.set(src, sCur);
  }

  const rows = [];
  for (const [accountId, t] of byAccount) {
    const account = byId.get(accountId);
    if (!account) continue;
    rows.push(toAccountRow(account, t.debitMinor, t.creditMinor, t.lineCount));
  }

  return { accounts: rows, sourceTypeByAccount, anomalies: [] };
}
