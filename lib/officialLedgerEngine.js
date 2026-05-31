import { getPostedGlSurvivorTotalsForPeriod } from '@/lib/trialBalanceReport';

/**
 * Official reporting ledger source:
 * posted TransactionLine rows plus posted manual JournalEntryLine rows,
 * excluding JournalEntry rows that mirror a Transaction via transactionId.
 * Account merges roll up to the surviving account id.
 */
export async function buildOfficialLedgerTotals({
  tenantId,
  branchId = null,
  startDate,
  endDate,
  prisma,
}) {
  const totalsByAccountId = await getPostedGlSurvivorTotalsForPeriod({
    tenantId,
    branchId,
    startDate,
    endDate,
    prisma,
  });

  return {
    totalsByAccountId,
    sourcePolicy: {
      transactionLines: 'posted only',
      journalEntryLines: 'posted manual entries only',
      mirroredJournalEntries: 'excluded when transactionId is set',
      accountMerges: 'rolled up to survivor account',
    },
  };
}
