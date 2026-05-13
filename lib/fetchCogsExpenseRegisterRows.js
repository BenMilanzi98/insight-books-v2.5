/**
 * COGS GL lines as synthetic expense-shaped rows — mirrors GET /api/expenses
 * filters, but amounts are **signed** (debit − credit) per line so summing the
 * export matches `sumNetCogsDebitMinusCredit` / expense statistics.
 */

import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';

export async function fetchCogsExpenseRegisterRows(
  prisma,
  {
    tenantId,
    branchIdParam,
    currentBranchId,
    dateFrom,
    dateTo,
    search,
    category
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

  const cogsTransactionFilter = {
    accountId: { in: cogsAccountIds },
    OR: [{ debitAmount: { gt: 0 } }, { creditAmount: { gt: 0 } }],
    transaction: {
      tenantId,
      status: { in: ['posted', 'Posted'] }
    }
  };

  if (branchIdParam) {
    cogsTransactionFilter.transaction.branchId = branchIdParam;
  } else if (currentBranchId) {
    const bid =
      typeof currentBranchId === 'string' ? currentBranchId : currentBranchId?.id;
    if (bid) {
      cogsTransactionFilter.transaction.OR = [{ branchId: bid }, { branchId: null }];
    }
  }

  if (dateFrom || dateTo) {
    cogsTransactionFilter.transaction.date = {};
    if (dateFrom) {
      cogsTransactionFilter.transaction.date.gte = new Date(dateFrom);
    }
    if (dateTo) {
      cogsTransactionFilter.transaction.date.lte = new Date(dateTo);
    }
  }

  if (search) {
    cogsTransactionFilter.transaction.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const reversedParents = await prisma.transaction.findMany({
      where: {
        tenantId,
        isReversal: true,
        reversedTransactionId: { not: null }
      },
      select: { reversedTransactionId: true }
    });
    const reversedParentIds = [
      ...new Set(reversedParents.map((r) => r.reversedTransactionId).filter(Boolean))
    ];
    if (reversedParentIds.length > 0) {
      cogsTransactionFilter.transaction.id = { notIn: reversedParentIds };
    }
  } catch (reversalFilterErr) {
    console.warn('COGS reversed-transaction filter skipped:', reversalFilterErr?.message);
  }

  const cogsTransactionLines = await prisma.transactionLine.findMany({
    where: cogsTransactionFilter,
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
          createdAt: true
        }
      },
      account: {
        select: {
          id: true,
          accountName: true,
          name: true
        }
      }
    },
    orderBy: {
      transaction: { date: 'desc' }
    }
  });

  return cogsTransactionLines
    .map((line) => {
      const debit = Number(line.debitAmount) || 0;
      const credit = Number(line.creditAmount) || 0;
      const signed = debit - credit;
      if (Math.abs(signed) < 1e-9) {
        return null;
      }
      const ref = line.transaction.reference || '';
      const isCredit = signed < 0;
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
        submittedBy: { name: 'System', email: '' },
        glAccountLabel: line.account.accountName || line.account.name || '',
        transactionId: line.transaction.id
      };
    })
    .filter(Boolean);
}
