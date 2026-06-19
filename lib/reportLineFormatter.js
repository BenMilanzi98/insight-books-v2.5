/**
 * Standard report line shape — every ledger-backed report uses this structure.
 */
import { roundMoney } from '@/lib/money.js';
import { buildCoaAccountSourceHref } from '@/lib/coaReportAccountLinks.js';

/**
 * @param {object} params
 * @param {object} params.account
 * @param {number} [params.openingBalance]
 * @param {number} [params.periodDebit]
 * @param {number} [params.periodCredit]
 * @param {number} [params.netMovement]
 * @param {number} [params.closingBalance]
 * @param {number} [params.sourceCount]
 * @param {string} [params.sectionKey]
 */
export function toStandardReportLine({
  account,
  openingBalance = 0,
  periodDebit = 0,
  periodCredit = 0,
  netMovement = 0,
  closingBalance = 0,
  sourceCount = 0,
  sectionKey = '',
}) {
  const accountCode = String(account?.accountCode || account?.code || '').trim();
  const accountName = String(account?.accountName || account?.name || 'Unknown Account').trim();
  const accountId = account?.id || account?.accountId || null;
  const accountType = account?.accountType || account?.type || '';
  const normalBalance = account?.normalBalance || null;
  const parentAccount = account?.parentAccount
    ? {
        id: account.parentAccount.id,
        accountCode: account.parentAccount.accountCode,
        accountName: account.parentAccount.accountName,
      }
    : account?.parentAccountId
      ? { id: account.parentAccountId }
      : null;

  return {
    key: `${sectionKey}-${accountId || accountCode}`,
    accountId,
    accountCode,
    accountName,
    accountType,
    parentAccount,
    normalBalance,
    openingDebit: normalBalance === 'Debit' && openingBalance > 0 ? roundMoney(openingBalance) : 0,
    openingCredit: normalBalance === 'Credit' && openingBalance > 0 ? roundMoney(openingBalance) : 0,
    openingBalance: roundMoney(openingBalance),
    periodDebit: roundMoney(periodDebit),
    periodCredit: roundMoney(periodCredit),
    netMovement: roundMoney(netMovement),
    closingBalance: roundMoney(closingBalance),
    amount: roundMoney(Math.abs(closingBalance || netMovement)),
    sourceCount,
    sourceHref: accountId
      ? buildCoaAccountSourceHref({ accountId, accountCode })
      : null,
    drillDown: accountId
      ? {
          type: 'Account',
          accountId,
          accountCode,
          accountName,
        }
      : null,
  };
}

/**
 * Map GL P&L line item to UI expense/revenue row.
 * @param {object} line
 */
export function plLineToUiRow(line) {
  return {
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.label || line.accountName,
    accountType: line.accountType,
    amount: line.amount,
    debitTotal: line.debitTotal,
    creditTotal: line.creditTotal,
    sourceHref: line.sourceHref,
    drillDown: line.accountId
      ? { type: 'Account', accountId: line.accountId, accountCode: line.accountCode }
      : null,
  };
}

/**
 * Map balance sheet GL line to UI lineItem.
 * @param {object} line
 */
export function bsLineToUiLineItem(line) {
  const label =
    line.accountCode && line.accountName
      ? `${line.accountCode} — ${line.accountName}`
      : line.accountName || line.label || 'Account';
  return {
    key: `bs-${line.accountId}`,
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    label,
    value: line.balance,
    balance: line.balance,
    debitTotal: line.debitTotal,
    creditTotal: line.creditTotal,
    sourceHref: line.sourceHref,
    drillDown: line.accountId
      ? { type: 'Account', accountId: line.accountId, accountCode: line.accountCode }
      : null,
  };
}
