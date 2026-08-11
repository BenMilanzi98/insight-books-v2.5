/**
 * COGS GL lines as synthetic expense-shaped rows — mirrors GET /api/expenses.
 * Includes:
 *   - legacy Transaction / TransactionLine (older postings)
 *   - Accounting V2 JournalEntry / JournalEntryLine (current POS Sale-COGS path)
 *
 * Amounts are signed (debit − credit) so exports match net COGS stats.
 */

import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import {
  cogsRegisterDedupeKey,
  resolveCogsLinkedSaleId,
} from '@/lib/cogsExpenseRegisterLink';
import { enrichCogsRegisterRowLabels } from '@/lib/cogsSourceSoldItems';
function buildBranchClause(branchIdParam, currentBranchId) {
  if (branchIdParam) return { branchId: branchIdParam };
  const bid =
    typeof currentBranchId === 'string' ? currentBranchId : currentBranchId?.id;
  if (bid) return { OR: [{ branchId: bid }, { branchId: null }] };
  return {};
}

function buildDateClause(dateFrom, dateTo, field = 'date') {
  if (!dateFrom && !dateTo) return {};
  const range = {};
  if (dateFrom) range.gte = new Date(dateFrom);
  if (dateTo) range.lte = new Date(dateTo);
  return { [field]: range };
}

/**
 * JournalEntry AND filters for V2 COGS register lines.
 * JournalEntry.entryType is required (default "Regular") — never filter with entryType: null
 * or Prisma throws and the expenses register silently drops all Sale-COGS / Invoice-COGS rows.
 *
 * Only document COGS postings (Sale-COGS / Invoice-COGS) are included — not ordinary Expense
 * journals that happen to debit the Purchases/COGS leaf (those already appear as Expense rows).
 *
 * @param {{ branchClause?: object, searchOr?: object[] | null, dateFrom?: string | Date | null, dateTo?: string | Date | null }} opts
 */
export function buildV2CogsJournalEntryAnd({
  branchClause = {},
  searchOr = null,
  dateFrom = null,
  dateTo = null,
} = {}) {
  const v2JournalAnd = [
    {
      sourceType: { in: ['Sale-COGS', 'Invoice-COGS'] },
    },
    {
      OR: [
        { reversalStatus: null },
        { reversalStatus: 'NOT_REVERSED' },
        { reversalStatus: { equals: '' } },
      ],
    },
    {
      entryType: { notIn: ['Reversal', 'REVERSAL'] },
    },
  ];
  if (branchClause && Object.keys(branchClause).length > 0) {
    v2JournalAnd.push(branchClause);
  }
  if (searchOr) {
    v2JournalAnd.push({ OR: searchOr });
  }
  if (dateFrom || dateTo) {
    const gte = dateFrom ? new Date(dateFrom) : undefined;
    const lte = dateTo ? new Date(dateTo) : undefined;
    v2JournalAnd.push({
      OR: [
        {
          postingDate: {
            ...(gte ? { gte } : {}),
            ...(lte ? { lte } : {}),
          },
        },
        {
          postingDate: null,
          entryDate: {
            ...(gte ? { gte } : {}),
            ...(lte ? { lte } : {}),
          },
        },
      ],
    });
  }
  return v2JournalAnd;
}

/**
 * @returns {Promise<object[]>}
 */
export async function fetchCogsExpenseRegisterRows(
  prisma,
  {
    tenantId,
    branchIdParam,
    currentBranchId,
    dateFrom,
    dateTo,
    search,
    category,
  }
) {
  const categoryLower = typeof category === 'string' ? category.toLowerCase() : '';
  const includeCOGS =
    !category ||
    category === 'all' ||
    categoryLower.includes('cost of goods') ||
    categoryLower.includes('cogs');

  if (
    !includeCOGS ||
    categoryLower === 'salary advance' ||
    category === 'Salary Advance'
  ) {
    return [];
  }

  const cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, tenantId);
  if (cogsAccountIds.length === 0) {
    return [];
  }

  const branchClause = buildBranchClause(branchIdParam, currentBranchId);
  const searchOr = search
    ? [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { journalNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { sourceNumber: { contains: search, mode: 'insensitive' } },
      ]
    : null;

  // ── Legacy Transaction lines ──────────────────────────────────────────────
  const legacyTxnAnd = [];
  if (Object.keys(branchClause).length > 0) legacyTxnAnd.push(branchClause);
  if (dateFrom || dateTo) {
    legacyTxnAnd.push(buildDateClause(dateFrom, dateTo, 'date'));
  }
  if (search) {
    legacyTxnAnd.push({
      OR: [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ],
    });
  }
  const legacyFilter = {
    accountId: { in: cogsAccountIds },
    OR: [{ debitAmount: { gt: 0 } }, { creditAmount: { gt: 0 } }],
    transaction: {
      tenantId,
      status: { in: ['posted', 'Posted', 'POSTED'] },
      ...(legacyTxnAnd.length ? { AND: legacyTxnAnd } : {}),
    },
  };

  try {
    const reversedParents = await prisma.transaction.findMany({
      where: {
        tenantId,
        isReversal: true,
        reversedTransactionId: { not: null },
      },
      select: { reversedTransactionId: true },
    });
    const reversedParentIds = [
      ...new Set(reversedParents.map((r) => r.reversedTransactionId).filter(Boolean)),
    ];
    if (reversedParentIds.length > 0) {
      legacyFilter.transaction.id = { notIn: reversedParentIds };
    }
  } catch (reversalFilterErr) {
    console.warn('COGS reversed-transaction filter skipped:', reversalFilterErr?.message);
  }

  const legacyLines = await prisma.transactionLine
    .findMany({
      where: legacyFilter,
      include: {
        transaction: {
          select: {
            id: true,
            date: true,
            description: true,
            reference: true,
            sourceId: true,
            sourceType: true,
            branchId: true,
            createdAt: true,
          },
        },
        account: {
          select: { id: true, accountName: true, name: true },
        },
      },
      orderBy: { transaction: { date: 'desc' } },
    })
    .catch((err) => {
      console.warn('Legacy COGS TransactionLine fetch failed:', err?.message);
      return [];
    });

  const legacyRows = legacyLines
    .map((line) => {
      const debit = Number(line.debitAmount) || 0;
      const credit = Number(line.creditAmount) || 0;
      const signed = debit - credit;
      if (Math.abs(signed) < 1e-9) return null;
      const ref = line.transaction.reference || '';
      const isCredit = signed < 0;
      const linkedSaleId = resolveCogsLinkedSaleId(
        line.transaction.sourceType,
        line.transaction.sourceId
      );
      return {
        entryType: 'COGS',
        id: `cogs-${line.transaction.id}-${line.id}`,
        description:
          line.transaction.description ||
          (isCredit ? `COGS credit — ${ref || 'Journal'}` : `COGS — ${ref || 'Sale'}`),
        amount: signed,
        taxAmount: 0,
        paidAmount: signed,
        date: line.transaction.date,
        createdAt: line.transaction.createdAt,
        category: 'Cost of Goods Sold',
        status: 'Approved',
        paymentStatus: isCredit ? 'GL credit' : 'Fully paid',
        merchant: '',
        notes: isCredit
          ? `GL COGS credit (net), journal ${ref || line.transaction.id}`
          : `GL COGS debit (net), journal ${ref || line.transaction.id}`,
        branchId: line.transaction.branchId || '',
        submittedBy: { name: 'System', email: '', id: 'system' },
        sourceAccount: {
          id: line.account.id,
          name: line.account.accountName || line.account.name || '',
        },
        glAccountLabel: line.account.accountName || line.account.name || '',
        transactionId: line.transaction.id,
        transactionReference: ref,
        sourceType: line.transaction.sourceType,
        sourceId: line.transaction.sourceId,
        linkedSaleId,
        isCOGS: true,
        payments: [],
        attachments: [],
        ledger: 'legacy',
      };
    })
    .filter(Boolean);

  // ── Accounting V2 journal lines (current POS Sale-COGS path) ──────────────
  const v2JournalAnd = buildV2CogsJournalEntryAnd({
    branchClause,
    searchOr,
    dateFrom,
    dateTo,
  });

  const v2Filter = {
    accountId: { in: cogsAccountIds },
    OR: [{ debitAmount: { gt: 0 } }, { creditAmount: { gt: 0 } }],
    journalEntry: {
      tenantId,
      status: { in: ['Posted', 'POSTED', 'posted'] },
      AND: v2JournalAnd,
    },
  };

  const v2Lines = await prisma.journalEntryLine
    .findMany({
      where: v2Filter,
      include: {
        journalEntry: {
          select: {
            id: true,
            postingDate: true,
            entryDate: true,
            description: true,
            referenceNumber: true,
            journalNumber: true,
            sourceNumber: true,
            sourceId: true,
            sourceType: true,
            branchId: true,
            createdAt: true,
          },
        },
        account: {
          select: { id: true, accountName: true, name: true },
        },
      },
      orderBy: { journalEntry: { postingDate: 'desc' } },
    })
    .catch((err) => {
      console.error('V2 COGS JournalEntryLine fetch failed:', err?.message || err);
      return [];
    });

  const v2Rows = v2Lines
    .map((line) => {
      const debit = Number(line.debitAmount) || 0;
      const credit = Number(line.creditAmount) || 0;
      const signed = debit - credit;
      if (Math.abs(signed) < 1e-9) return null;
      const je = line.journalEntry;
      const ref =
        je.journalNumber || je.referenceNumber || je.sourceNumber || '';
      const isCredit = signed < 0;
      const linkedSaleId = resolveCogsLinkedSaleId(je.sourceType, je.sourceId);
      const when = je.postingDate || je.entryDate || je.createdAt;
      return {
        entryType: 'COGS',
        id: `cogs-v2-${je.id}-${line.id}`,
        description:
          je.description ||
          line.description ||
          (isCredit ? `COGS credit — ${ref || 'Journal'}` : `COGS — ${ref || 'Sale'}`),
        amount: signed,
        taxAmount: 0,
        paidAmount: signed,
        date: when,
        createdAt: je.createdAt,
        category: 'Cost of Goods Sold',
        status: 'Approved',
        paymentStatus: isCredit ? 'GL credit' : 'Fully paid',
        merchant: '',
        notes: isCredit
          ? `GL COGS credit (V2), journal ${ref || je.id}`
          : `GL COGS debit (V2), journal ${ref || je.id}`,
        branchId: je.branchId || '',
        submittedBy: { name: 'System', email: '', id: 'system' },
        sourceAccount: {
          id: line.account.id,
          name: line.account.accountName || line.account.name || '',
        },
        glAccountLabel: line.account.accountName || line.account.name || '',
        transactionId: je.id,
        transactionReference: ref,
        sourceType: je.sourceType,
        sourceId: je.sourceId,
        linkedSaleId,
        isCOGS: true,
        payments: [],
        attachments: [],
        ledger: 'v2',
      };
    })
    .filter(Boolean);

  // Prefer V2 when the same sale/document was also mirrored as a legacy Transaction.
  const byKey = new Map();
  for (const row of legacyRows) {
    byKey.set(cogsRegisterDedupeKey(row), row);
  }
  for (const row of v2Rows) {
    const key = cogsRegisterDedupeKey(row);
    const existing = byKey.get(key);
    if (!existing || existing.ledger === 'legacy') {
      byKey.set(key, row);
    }
  }

  return enrichCogsRegisterRowLabels(
    prisma,
    tenantId,
    [...byKey.values()].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const dbDate = b.date ? new Date(b.date).getTime() : 0;
      return dbDate - da;
    })
  );
}
