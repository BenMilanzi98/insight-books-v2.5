import { parseToMinor } from '../helpers/moneyAssert.js';
import { nextId, businessId } from './ids.js';

/**
 * Build a balanced double-entry journal payload for invariant tests.
 */
export function buildBalancedJournal({
  business = businessId(1),
  amount = '1000.00',
  debitAccount = '1000',
  creditAccount = '4000',
  sourceType = 'TEST',
  sourceId = null,
  status = 'POSTED',
} = {}) {
  const minor = parseToMinor(amount);
  const id = nextId('je');
  return {
    id,
    businessId: business,
    tenantId: business,
    status,
    sourceType,
    sourceId: sourceId || nextId('src'),
    lines: [
      {
        id: nextId('jel'),
        businessId: business,
        accountId: debitAccount,
        debit: minor,
        credit: 0n,
        debitMinor: String(minor),
        creditMinor: '0',
      },
      {
        id: nextId('jel'),
        businessId: business,
        accountId: creditAccount,
        debit: 0n,
        credit: minor,
        debitMinor: '0',
        creditMinor: String(minor),
      },
    ],
  };
}

export function buildUnbalancedJournal(opts = {}) {
  const j = buildBalancedJournal(opts);
  j.lines[0].debit = parseToMinor(opts.amount || '1000.00') + 1n;
  j.lines[0].debitMinor = String(j.lines[0].debit);
  return j;
}

export function buildReversalOf(journal) {
  return {
    ...journal,
    id: nextId('je_rev'),
    reversesJournalId: journal.id,
    lines: journal.lines.map((l) => ({
      ...l,
      id: nextId('jel'),
      debit: l.credit,
      credit: l.debit,
      debitMinor: String(l.credit ?? l.creditMinor ?? 0),
      creditMinor: String(l.debit ?? l.debitMinor ?? 0),
    })),
  };
}
