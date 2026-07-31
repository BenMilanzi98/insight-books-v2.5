/**
 * Capital Account / owner statement — balances from posted equity txs + JE linkage.
 * Does not sum settings counters or EquityAccount.currentBalance.
 */

import { minorToDecimalString } from '../../accountingV2/domain/money.js';
import { getEquitySubledger } from './reconciliationService.js';
import { listRelationships } from './partyService.js';

export async function getOwnerCapitalStatement(db, context, relationshipId, { fromDate, toDate } = {}) {
  let rows = await getEquitySubledger(db, context.businessId, { relationshipId, limit: 1000 });
  if (fromDate) {
    const from = new Date(fromDate);
    rows = rows.filter((r) => new Date(r.transactionDate) >= from);
  }
  if (toDate) {
    const to = new Date(toDate);
    rows = rows.filter((r) => new Date(r.transactionDate) <= to);
  }

  const contributions = rows.filter((r) =>
    ['CAPITAL_CONTRIBUTION', 'NON_CASH_CONTRIBUTION', 'SHARE_ISSUANCE', 'OWNER_LOAN_CONVERSION'].includes(
      r.transactionType
    )
  );
  const drawings = rows.filter((r) =>
    ['OWNER_DRAWING', 'PARTNER_DRAWING'].includes(r.transactionType)
  );
  const dividendsPaid = rows.filter((r) => r.transactionType === 'DIVIDEND_PAYMENT');

  const contribMinor = contributions.reduce((s, r) => s + r.amountMinor, 0);
  const drawingMinor = drawings.reduce((s, r) => s + r.amountMinor, 0);
  const divMinor = dividendsPaid.reduce((s, r) => s + r.amountMinor, 0);
  const closingMinor = contribMinor - drawingMinor; // dividends paid clear payable, capital statement focuses on capital/drawings

  return {
    relationshipId,
    openingBalance: '0.00',
    contributions: minorToDecimalString(contribMinor),
    drawings: minorToDecimalString(drawingMinor),
    dividendsPaid: minorToDecimalString(divMinor),
    closingCapital: minorToDecimalString(closingMinor),
    lines: rows.map((r) => ({
      ...r,
      amount: minorToDecimalString(r.amountMinor),
      runningBalance: minorToDecimalString(r.runningBalanceMinor),
    })),
    authority: 'EqV2EquityTransaction + JournalEntry (ACCOUNTING_V2)',
  };
}

export async function getEquityDashboard(db, context) {
  const [owners, txs, holdings, recon] = await Promise.all([
    listRelationships(db, context.businessId, { ownershipStatus: 'ACTIVE' }),
    db.eqV2EquityTransaction.findMany({
      where: { tenantId: context.businessId, accountingStatus: 'POSTED' },
    }),
    db.eqV2OwnershipHolding.count({
      where: { tenantId: context.businessId, status: 'ACTIVE', effectiveTo: null },
    }),
    db.eqV2EquityReconciliationRun.findFirst({
      where: { tenantId: context.businessId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const byType = (type) =>
    txs.filter((t) => t.transactionType === type).reduce((s, t) => s + t.amountMinor, 0);

  return {
    ownerCount: owners.length,
    activeHoldings: holdings,
    contributionsPosted: minorToDecimalString(byType('CAPITAL_CONTRIBUTION') + byType('NON_CASH_CONTRIBUTION')),
    drawingsPosted: minorToDecimalString(byType('OWNER_DRAWING') + byType('PARTNER_DRAWING')),
    dividendsDeclared: minorToDecimalString(byType('DIVIDEND_DECLARATION')),
    dividendsPaid: minorToDecimalString(byType('DIVIDEND_PAYMENT')),
    lastReconciliation: recon
      ? { id: recon.id, overallOk: recon.overallOk, asOfDate: recon.asOfDate }
      : null,
    note: 'Financial totals are from posted Equity Transactions linked to journals — not TenantSettings counters.',
  };
}
