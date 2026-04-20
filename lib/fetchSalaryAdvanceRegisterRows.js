/**
 * Salary advances as synthetic register rows — mirrors GET /api/expenses
 * (same filters; not branch-scoped, like the list API).
 */
export async function fetchSalaryAdvanceRegisterRows(
  prisma,
  {
    tenantId,
    dateFrom,
    dateTo,
    search,
    category,
    accountId
  }
) {
  const categoryLower = typeof category === 'string' ? category.toLowerCase() : '';

  const includeSalaryAdvances =
    (!accountId && (!category || category === 'all' || category === '')) ||
    categoryLower === 'salary advance' ||
    category === 'Salary Advance';

  if (!includeSalaryAdvances) {
    return [];
  }

  const salaryAdvanceFilter = {
    tenantId,
    status: { not: 'Cancelled' }
  };

  if (dateFrom || dateTo) {
    salaryAdvanceFilter.advanceDate = {};
    if (dateFrom) {
      salaryAdvanceFilter.advanceDate.gte = new Date(dateFrom);
    }
    if (dateTo) {
      salaryAdvanceFilter.advanceDate.lte = new Date(dateTo);
    }
  }

  if (search) {
    salaryAdvanceFilter.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { employee: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const salaryAdvances = await prisma.salaryAdvance.findMany({
    where: salaryAdvanceFilter,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeId: true
        }
      }
    },
    orderBy: { advanceDate: 'desc' }
  });

  return salaryAdvances.map((advance) => ({
    entryType: 'Salary Advance',
    id: `salary-advance-${advance.id}`,
    description: `Salary Advance: ${advance.employee?.name || 'Employee'}${advance.reference ? ` (${advance.reference})` : ''}`,
    amount: Number(advance.amount),
    taxAmount: 0,
    paidAmount: Number(advance.amount),
    date: advance.advanceDate,
    createdAt: advance.createdAt || advance.advanceDate,
    category: 'Salary Advance',
    status: 'Approved',
    paymentStatus: 'Fully paid',
    merchant: '',
    notes: advance.notes || '',
    branchId: '',
    submittedBy: { name: 'System', email: '' },
    glJournalId: '',
    glAccount: '',
    transactionId: ''
  }));
}
