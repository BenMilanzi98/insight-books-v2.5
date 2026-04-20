/**
 * COGS GL lines as synthetic expense-shaped rows — mirrors GET /api/expenses
 * (same accounts, filters, and reversal exclusion).
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

  const cogsAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        {
          accountType: 'Expense',
          OR: [
            { accountCode: '5000' },
            { code: '5000' },
            { accountCode: '5100' },
            { code: '5100' },
            { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
            { accountName: { contains: 'cost of sales', mode: 'insensitive' } },
            { accountName: { contains: 'cogs', mode: 'insensitive' } },
            { name: { contains: 'cost of goods', mode: 'insensitive' } },
            { name: { contains: 'cost of sales', mode: 'insensitive' } },
            { name: { contains: 'cogs', mode: 'insensitive' } }
          ]
        },
        { accountCode: '5100' },
        { code: '5100' }
      ]
    },
    select: { id: true, accountName: true, name: true }
  });
  const cogsAccountIds = [...new Set(cogsAccounts.map((acc) => acc.id))];

  const cogsTransactionFilter =
    cogsAccountIds.length > 0
      ? {
          accountId: { in: cogsAccountIds },
          debitAmount: { gt: 0 },
          transaction: {
            tenantId,
            status: 'posted'
          }
        }
      : null;

  if (!cogsTransactionFilter) {
    return [];
  }

  if (branchIdParam) {
    cogsTransactionFilter.transaction.branchId = branchIdParam;
  } else if (currentBranchId) {
    cogsTransactionFilter.transaction.branchId = currentBranchId;
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

  return cogsTransactionLines.map((line) => {
    const debit = Number(line.debitAmount) || 0;
    const ref = line.transaction.reference || '';
    return {
      entryType: 'COGS',
      id: `cogs-${line.transaction.id}-${line.id}`,
      description:
        line.transaction.description ||
        `COGS - ${ref || 'Sale'}`,
      amount: debit,
      taxAmount: 0,
      paidAmount: debit,
      date: line.transaction.date,
      createdAt: line.transaction.createdAt,
      category: 'Cost of Goods Sold',
      status: 'Approved',
      paymentStatus: 'Fully paid',
      merchant: '',
      notes: `GL COGS from journal ${ref || line.transaction.id}`,
      branchId: line.transaction.branchId || '',
      submittedBy: { name: 'System', email: '' },
      glAccountLabel: line.account.accountName || line.account.name || '',
      transactionId: line.transaction.id
    };
  });
}
