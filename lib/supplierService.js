// lib/supplierService.js
/**
 * Supplier Management Service
 * Manages supplier CRUD operations, financial aggregations, and reporting
 * Supports expense integration and supplier aging analysis
 */

import prisma from './prisma';

/**
 * Supplier status constants
 */
export const SUPPLIER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked'
};

/**
 * Bill status constants
 */
export const SUPPLIER_BILL_STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  FINALIZED: 'Finalized',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled'
};

/**
 * Payment status constants
 */
export const SUPPLIER_PAYMENT_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  VOIDED: 'Voided'
};

/**
 * Generate unique supplier code
 */
export async function generateSupplierCode(tenantId) {
  const count = await prisma.supplier.count({
    where: { tenantId }
  });
  
  // Format: SUP-001, SUP-002, etc.
  const number = (count + 1).toString().padStart(4, '0');
  return `SUP-${number}`;
}

/**
 * Validate supplier creation/update data
 */
export async function validateSupplierData(tenantId, supplierData, existingSupplierId = null) {
  const errors = [];

  // Required fields validation
  if (!supplierData.supplierName || supplierData.supplierName.trim() === '') {
    errors.push('Supplier name is required');
  }

  // Email validation
  if (supplierData.email && supplierData.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supplierData.email)) {
      errors.push('Invalid email format');
    }
    
    // Check for duplicate email
    const existingEmail = await prisma.supplier.findFirst({
      where: {
        tenantId,
        email: supplierData.email,
        id: existingSupplierId ? { not: existingSupplierId } : undefined
      }
    });
    
    if (existingEmail) {
      errors.push('A supplier with this email already exists');
    }
  }

  // Phone validation
  if (supplierData.phone && supplierData.phone.trim() !== '') {
    const phoneRegex = /^[+\d\s-]{10,}$/;
    if (!phoneRegex.test(supplierData.phone)) {
      errors.push('Invalid phone number format');
    }
  }

  // Credit limit validation
  if (supplierData.creditLimit !== undefined && supplierData.creditLimit !== null) {
    if (supplierData.creditLimit < 0) {
      errors.push('Credit limit cannot be negative');
    }
  }

  // Payment terms validation
  if (supplierData.paymentTerms !== undefined && supplierData.paymentTerms !== null) {
    if (supplierData.paymentTerms < 0 || supplierData.paymentTerms > 365) {
      errors.push('Payment terms must be between 0 and 365 days');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a new supplier
 */
export async function createSupplier(tenantId, userId, supplierData) {
  // Validate data first
  const validation = await validateSupplierData(tenantId, supplierData);
  if (!validation.isValid) {
    throw new Error(validation.errors.join('; '));
  }

  const supplierCode = await generateSupplierCode(tenantId);

  const {
    supplierName,
    contactPerson,
    email,
    phone,
    mobile,
    address,
    city,
    country,
    postalCode,
    taxId,
    paymentTerms = 30,
    paymentPreference,
    currency = 'MWK',
    creditLimit,
    bankName,
    bankAccountNumber,
    bankBranch,
    notes,
    website,
    category // Optional supplier category
  } = supplierData;

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      supplierCode,
      supplierName,
      contactPerson,
      email,
      phone,
      mobile,
      address,
      city,
      country: country || 'Malawi',
      postalCode,
      taxId,
      paymentTerms,
      paymentPreference,
      currency,
      creditLimit,
      bankName,
      bankAccountNumber,
      bankBranch,
      notes,
      website,
      category,
      createdById: userId,
      modifiedById: userId,
      currentBalance: 0 // Start with zero balance
    }
  });

  return supplier;
}

/**
 * Update an existing supplier
 */
export async function updateSupplier(supplierId, tenantId, userId, updates) {
  // Check if supplier exists
  const existingSupplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId }
  });

  if (!existingSupplier) {
    throw new Error('Supplier not found');
  }

  // Validate update data
  const validation = await validateSupplierData(tenantId, updates, supplierId);
  if (!validation.isValid) {
    throw new Error(validation.errors.join('; '));
  }

  const {
    supplierName,
    contactPerson,
    email,
    phone,
    mobile,
    address,
    city,
    country,
    postalCode,
    taxId,
    paymentTerms,
    currency,
    creditLimit,
    bankName,
    bankAccountNumber,
    bankBranch,
    notes,
    website,
    category,
    isActive
  } = updates;

  const updateData = {
    updatedAt: new Date(),
    modifiedById: userId
  };

  // Update only provided fields
  if (supplierName) updateData.supplierName = supplierName;
  if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (mobile !== undefined) updateData.mobile = mobile;
  if (address !== undefined) updateData.address = address;
  if (city !== undefined) updateData.city = city;
  if (country !== undefined) updateData.country = country;
  if (postalCode !== undefined) updateData.postalCode = postalCode;
  if (taxId !== undefined) updateData.taxId = taxId;
  if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
  if (currency !== undefined) updateData.currency = currency;
  if (creditLimit !== undefined) updateData.creditLimit = creditLimit;
  if (bankName !== undefined) updateData.bankName = bankName;
  if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber;
  if (bankBranch !== undefined) updateData.bankBranch = bankBranch;
  if (notes !== undefined) updateData.notes = notes;
  if (website !== undefined) updateData.website = website;
  if (category !== undefined) updateData.category = category;
  if (isActive !== undefined) updateData.isActive = isActive;

  const supplier = await prisma.supplier.update({
    where: { id: supplierId },
    data: updateData
  });

  return supplier;
}

/**
 * Delete a supplier (soft delete by deactivating)
 */
export async function deleteSupplier(supplierId, tenantId) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId }
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  // Check if supplier has related transactions
  const billCount = await prisma.supplierBill.count({
    where: { supplierId, status: { notIn: ['Cancelled', 'Draft'] } }
  });

  const paymentCount = await prisma.supplierPayment.count({
    where: { supplierId }
  });

  if (billCount > 0 || paymentCount > 0) {
    // Soft delete - just deactivate
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
    
    return { 
      success: true, 
      message: 'Supplier has related transactions. Deactivated instead of deleted.',
      deactivated: true
    };
  }

  // Hard delete only if no transactions
  await prisma.supplier.delete({
    where: { id: supplierId }
  });

  return { success: true, message: 'Supplier deleted successfully', deleted: true };
}

/**
 * Get supplier by ID with full details
 */
export async function getSupplierById(supplierId, tenantId) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    include: {
      _count: {
        select: {
          supplierBills: true,
          supplierPayments: true,
          purchaseOrders: true,
          goodsReceipts: true
        }
      }
    }
  });

  if (!supplier) {
    return null;
  }

  return supplier;
}

/**
 * Get all suppliers with filters and pagination
 */
export async function getSuppliers(tenantId, options = {}) {
  const {
    search,
    status,
    isActive,
    page = 1,
    limit = 20,
    sortBy = 'supplierName',
    sortOrder = 'asc'
  } = options;

  const where = {
    tenantId
  };

  // Search filter
  if (search) {
    where.OR = [
      { supplierName: { contains: search, mode: 'insensitive' } },
      { supplierCode: { contains: search, mode: 'insensitive' } },
      { contactPerson: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Status filter
  if (isActive !== undefined) {
    where.isActive = isActive;
  } else {
    where.isActive = true; // Default to active only
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        contactPerson: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        currentBalance: true,
        creditLimit: true,
        paymentTerms: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            supplierBills: true,
            supplierPayments: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit
    }),
    prisma.supplier.count({ where })
  ]);

  return {
    suppliers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get supplier financial summary
 */
export async function getSupplierFinancialSummary(supplierId, tenantId) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId }
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  // Get bill aggregations
  const billsAggregation = await prisma.supplierBill.aggregate({
    where: {
      supplierId,
      status: { in: ['Approved', 'Finalized', 'Partially Paid', 'Paid'] }
    },
    _sum: {
      totalAmount: true,
      amountPaid: true
    },
    _count: true
  });

  // Get payment aggregations
  const paymentsAggregation = await prisma.supplierPayment.aggregate({
    where: {
      supplierId,
      status: 'Completed'
    },
    _sum: {
      totalAmount: true
    },
    _count: true
  });

  // Get pending bills (unpaid or partially paid)
  const pendingBills = await prisma.supplierBill.findMany({
    where: {
      supplierId,
      status: { in: ['Approved', 'Finalized', 'Partially Paid'] },
      dueDate: { gte: new Date() }
    },
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      totalAmount: true,
      amountPaid: true,
      status: true
    },
    orderBy: { dueDate: 'asc' },
    take: 10
  });

  // Calculate outstanding balance
  const totalBills = billsAggregation._sum.totalAmount || 0;
  const totalPaid = billsAggregation._sum.amountPaid || 0;
  const outstandingBalance = totalBills - totalPaid;

  // Calculate aging of outstanding amounts
  const now = new Date();
  const agingAnalysis = await getSupplierAgingAnalysis(supplierId, tenantId);

  return {
    supplier: {
      id: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      creditLimit: supplier.creditLimit,
      currentBalance: supplier.currentBalance,
      paymentTerms: supplier.paymentTerms
    },
    summary: {
      totalBills: totalBills,
      totalPayments: paymentsAggregation._sum.totalAmount || 0,
      outstandingBalance: outstandingBalance,
      billCount: billsAggregation._count,
      paymentCount: paymentsAggregation._count,
      availableCredit: (supplier.creditLimit || 0) - outstandingBalance
    },
    aging: agingAnalysis,
    pendingBills
  };
}

/**
 * Get supplier aging analysis
 */
export async function getSupplierAgingAnalysis(supplierId, tenantId) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get unpaid bills grouped by age
  const unpaidBills = await prisma.supplierBill.findMany({
    where: {
      supplierId,
      status: { in: ['Approved', 'Finalized', 'Partially Paid'] }
    },
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      totalAmount: true,
      amountPaid: true,
      status: true
    }
  });

  // Calculate aging buckets
  let current = 0;      // 0-30 days
  let days31to60 = 0;  // 31-60 days
  let days61to90 = 0;  // 61-90 days
  let over90 = 0;      // 90+ days

  for (const bill of unpaidBills) {
    const unpaidAmount = (bill.totalAmount || 0) - (bill.amountPaid || 0);
    const daysPastDue = Math.floor((now - new Date(bill.dueDate)) / (24 * 60 * 60 * 1000));

    if (daysPastDue <= 0) {
      // Not yet due - count as current
      current += unpaidAmount;
    } else if (daysPastDue <= 30) {
      current += unpaidAmount;
    } else if (daysPastDue <= 60) {
      days31to60 += unpaidAmount;
    } else if (daysPastDue <= 90) {
      days61to90 += unpaidAmount;
    } else {
      over90 += unpaidAmount;
    }
  }

  const totalOutstanding = current + days31to60 + days61to90 + over90;

  return {
    current,
    days31to60,
    days61to90,
    over90,
    totalOutstanding,
    bucketPercentages: totalOutstanding > 0 ? {
      current: (current / totalOutstanding) * 100,
      days31to60: (days31to60 / totalOutstanding) * 100,
      days61to90: (days61to90 / totalOutstanding) * 100,
      over90: (over90 / totalOutstanding) * 100
    } : null
  };
}

/**
 * Update supplier balance after bill, payment, or expense
 */
export async function updateSupplierBalance(supplierId, tenantId) {
  // Calculate total outstanding from bills
  const billsResult = await prisma.supplierBill.aggregate({
    where: {
      supplierId,
      status: { in: ['Approved', 'Finalized', 'Partially Paid'] }
    },
    _sum: {
      totalAmount: true,
      amountPaid: true
    }
  });

  const totalBills = billsResult._sum.totalAmount || 0;
  const totalPaid = billsResult._sum.amountPaid || 0;
  const billsBalance = totalBills - totalPaid;

  // Calculate total outstanding from expenses (unpaid supplier expenses)
  const expensesResult = await prisma.expense.aggregate({
    where: {
      supplierId,
      tenantId,
      isDeleted: false,
      paymentStatus: { in: ['Pending', 'Partially'] }
    },
    _sum: {
      amount: true,
      paidAmount: true
    }
  });

  const totalExpenses = expensesResult._sum.amount || 0;
  const totalExpensesPaid = expensesResult._sum.paidAmount || 0;
  const expensesBalance = totalExpenses - totalExpensesPaid;

  // Total balance = bills balance + expenses balance
  const newBalance = billsBalance + expensesBalance;

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      currentBalance: newBalance,
      updatedAt: new Date()
    }
  });

  return newBalance;
}

/**
 * Get suppliers with outstanding balances (accounts payable aging)
 */
export async function getSuppliersAgingReport(tenantId, options = {}) {
  const { asOfDate = new Date(), includeDetails = false } = options;

  // Get all suppliers with unpaid bills
  const suppliers = await prisma.supplier.findMany({
    where: {
      tenantId,
      isActive: true
    },
    select: {
      id: true,
      supplierCode: true,
      supplierName: true,
      contactPerson: true,
      email: true,
      phone: true,
      paymentTerms: true,
      creditLimit: true,
      currentBalance: true
    },
    orderBy: { supplierName: 'asc' }
  });

  const reportData = await Promise.all(
    suppliers.map(async (supplier) => {
      const aging = await getSupplierAgingAnalysis(supplier.id, tenantId);
      
      // Skip suppliers with zero balance
      if (aging.totalOutstanding === 0) return null;

      const result = {
        supplier: {
          id: supplier.id,
          code: supplier.supplierCode,
          name: supplier.supplierName,
          contactPerson: supplier.contactPerson,
          email: supplier.email,
          phone: supplier.phone,
          paymentTerms: supplier.paymentTerms,
          creditLimit: supplier.creditLimit
        },
        aging: {
          current: aging.current,
          days31to60: aging.days31to60,
          days61to90: aging.days61to90,
          over90: aging.over90,
          totalOutstanding: aging.totalOutstanding
        },
        riskAssessment: getRiskAssessment(aging)
      };

      if (includeDetails) {
        const unpaidBills = await prisma.supplierBill.findMany({
          where: {
            supplierId: supplier.id,
            status: { in: ['Approved', 'Finalized', 'Partially Paid'] }
          },
          select: {
            id: true,
            billNumber: true,
            billDate: true,
            dueDate: true,
            totalAmount: true,
            amountPaid: true
          },
          orderBy: { dueDate: 'asc' }
        });
        
        result.unpaidBills = unpaidBills.map(bill => ({
          ...bill,
          unpaidAmount: (bill.totalAmount || 0) - (bill.amountPaid || 0)
        }));
      }

      return result;
    })
  );

  // Filter out nulls and sort by total outstanding (descending)
  const filteredData = reportData
    .filter(item => item !== null)
    .sort((a, b) => b.aging.totalOutstanding - a.aging.totalOutstanding);

  // Calculate totals
  const totals = {
    current: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
    totalOutstanding: 0,
    supplierCount: filteredData.length
  };

  for (const item of filteredData) {
    totals.current += item.aging.current;
    totals.days31to60 += item.aging.days31to60;
    totals.days61to90 += item.aging.days61to90;
    totals.over90 += item.aging.over90;
    totals.totalOutstanding += item.aging.totalOutstanding;
  }

  return {
    asOfDate,
    data: filteredData,
    totals
  };
}

/**
 * Assess payment risk based on aging
 */
function getRiskAssessment(aging) {
  const overduePercent = ((aging.days31to60 + aging.days61to90 + aging.over90) / aging.totalOutstanding) * 100;
  
  if (overduePercent > 50 || aging.over90 > aging.totalOutstanding * 0.25) {
    return { level: 'high', label: 'High Risk', color: 'red' };
  } else if (overduePercent > 25 || aging.over90 > 0) {
    return { level: 'medium', label: 'Medium Risk', color: 'orange' };
  } else {
    return { level: 'low', label: 'Low Risk', color: 'green' };
  }
}

/**
 * Get supplier purchase history
 */
export async function getSupplierPurchaseHistory(supplierId, tenantId, options = {}) {
  const { startDate, endDate, limit = 50 } = options;

  const where = {
    supplierId,
    status: { in: ['Approved', 'Finalized', 'Partially Paid', 'Paid'] }
  };

  if (startDate && endDate) {
    where.billDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const bills = await prisma.supplierBill.findMany({
    where,
    select: {
      id: true,
      billNumber: true,
      billDate: true,
      dueDate: true,
      totalAmount: true,
      amountPaid: true,
      status: true,
      createdAt: true
    },
    orderBy: { billDate: 'desc' },
    take: limit
  });

  const aggregation = await prisma.supplierBill.aggregate({
    where,
    _sum: {
      totalAmount: true,
      amountPaid: true
    },
    _count: true
  });

  return {
    bills: bills.map(bill => ({
      ...bill,
      unpaidAmount: (bill.totalAmount || 0) - (bill.amountPaid || 0)
    })),
    summary: {
      totalPurchases: aggregation._sum.totalAmount || 0,
      totalPaid: aggregation._sum.amountPaid || 0,
      billCount: aggregation._count
    }
  };
}

/**
 * Get supplier payment history
 */
export async function getSupplierPaymentHistory(supplierId, tenantId, options = {}) {
  const { startDate, endDate, limit = 50 } = options;

  const where = {
    supplierId,
    status: 'Completed'
  };

  if (startDate && endDate) {
    where.paymentDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const payments = await prisma.supplierPayment.findMany({
    where,
    select: {
      id: true,
      paymentNumber: true,
      paymentDate: true,
      paymentMethod: true,
      totalAmount: true,
      referenceNumber: true,
      notes: true,
      createdAt: true
    },
    orderBy: { paymentDate: 'desc' },
    take: limit
  });

  const aggregation = await prisma.supplierPayment.aggregate({
    where,
    _sum: {
      totalAmount: true
    },
    _count: true
  });

  return {
    payments,
    summary: {
      totalPayments: aggregation._sum.totalAmount || 0,
      paymentCount: aggregation._count
    }
  };
}

/**
 * Get top suppliers by spending
 */
export async function getTopSuppliersBySpending(tenantId, options = {}) {
  const { startDate, endDate, limit = 10 } = options;

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.billDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  // Get spending by supplier
  const spending = await prisma.supplierBill.groupBy({
    by: ['supplierId'],
    where: {
      tenantId,
      status: { in: ['Approved', 'Finalized', 'Partially Paid', 'Paid'] },
      ...dateFilter
    },
    _sum: {
      totalAmount: true
    },
    orderBy: {
      _sum: {
        totalAmount: 'desc'
      }
    },
    take: limit
  });

  // Get supplier details for each
  const supplierIds = spending.map(s => s.supplierId);
  const suppliers = await prisma.supplier.findMany({
    where: {
      id: { in: supplierIds }
    },
    select: {
      id: true,
      supplierCode: true,
      supplierName: true,
      contactPerson: true,
      email: true
    }
  });

  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  return spending.map(item => ({
    supplier: supplierMap.get(item.supplierId),
    totalSpending: item._sum.totalAmount || 0
  }));
}

/**
 * Check if supplier can make purchases on credit
 */
export async function checkSupplierCredit(supplierId, tenantId, newPurchaseAmount = 0) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId }
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  if (!supplier.isActive) {
    return {
      canPurchase: false,
      reason: 'Supplier is inactive',
      currentBalance: supplier.currentBalance,
      creditLimit: supplier.creditLimit,
      availableCredit: 0
    };
  }

  const availableCredit = (supplier.creditLimit || 0) - supplier.currentBalance;
  const newBalance = supplier.currentBalance + newPurchaseAmount;
  const withinLimit = newBalance <= (supplier.creditLimit || 0);

  return {
    canPurchase: withinLimit,
    reason: withinLimit ? 'Within credit limit' : 'Exceeds credit limit',
    currentBalance: supplier.currentBalance,
    creditLimit: supplier.creditLimit,
    availableCredit,
    newBalance,
    willExceedLimit: !withinLimit
  };
}

/**
 * Get supplier expense summary (expenses linked to this supplier)
 */
export async function getSupplierExpenseSummary(supplierId, tenantId, options = {}) {
  const { startDate, endDate, status } = options;

  const where = {
    supplierId,
    isDeleted: false
  };

  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  // Get expense aggregations
  const expensesAggregation = await prisma.expense.aggregate({
    where,
    _sum: {
      amount: true,
      paidAmount: true
    },
    _count: true
  });

  // Get payment aggregations for these expenses
  const paymentsAggregation = await prisma.payment.aggregate({
    where: {
      expense: { supplierId },
      status: 'Completed'
    },
    _sum: {
      amount: true
    },
    _count: true
  });

  // Get expense counts by status
  const statusCounts = await prisma.expense.groupBy({
    by: ['paymentStatus'],
    where: { supplierId, isDeleted: false },
    _count: true
  });

  // Get last expense date
  const lastExpense = await prisma.expense.findFirst({
    where: { supplierId, isDeleted: false },
    orderBy: { date: 'desc' },
    select: { date: true }
  });

  // Get last payment date
  const lastPayment = await prisma.payment.findFirst({
    where: {
      expense: { supplierId },
      status: 'Completed'
    },
    orderBy: { paymentDate: 'desc' },
    select: { paymentDate: true }
  });

  const totalAmount = expensesAggregation._sum.amount || 0;
  const totalPaid = paymentsAggregation._sum.amount || 0;
  const outstandingBalance = totalAmount - totalPaid;

  // Calculate status counts
  const statusCountMap = {};
  for (const item of statusCounts) {
    statusCountMap[item.paymentStatus] = item._count;
  }

  return {
    summary: {
      totalExpenses: expensesAggregation._count,
      totalAmount,
      totalPaid,
      outstandingBalance,
      fullyPaidCount: statusCountMap['Fully paid'] || 0,
      partiallyPaidCount: statusCountMap['Partially'] || 0,
      unpaidCount: statusCountMap['Pending'] || 0,
      paymentCount: paymentsAggregation._count
    },
    lastExpenseDate: lastExpense?.date || null,
    lastPaymentDate: lastPayment?.paymentDate || null
  };
}

/**
 * Get supplier expense history (chronological list of expenses)
 */
export async function getSupplierExpenseHistory(supplierId, tenantId, options = {}) {
  const { 
    startDate, 
    endDate, 
    status,
    page = 1, 
    limit = 25 
  } = options;

  const where = {
    supplierId,
    isDeleted: false
  };

  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [expenses, totalCount] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' },
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            reference: true,
            status: true
          }
        }
      }
    }),
    prisma.expense.count({ where })
  ]);

  return {
    expenses,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}

/**
 * Sync expense suppliers (for expense-to-supplier linking)
 */
export async function syncExpenseSuppliers(tenantId) {
  // Get unique suppliers from expenses
  const expenseSuppliers = await prisma.expense.findMany({
    where: {
      tenantId,
      merchant: { not: null },
      isDeleted: false
    },
    select: {
      merchant: true
    },
    distinct: ['merchant']
  });

  const syncedCount = 0;
  const results = [];

  for (const expense of expenseSuppliers) {
    if (!expense.merchant) continue;
    
    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        tenantId,
        supplierName: { equals: expense.merchant, mode: 'insensitive' }
      }
    });

    if (!existingSupplier) {
      // Create a new supplier from expense merchant
      const newSupplier = await createSupplier(tenantId, null, {
        supplierName: expense.merchant,
        notes: 'Auto-created from expense records'
      });
      
      results.push({
        merchant: expense.merchant,
        action: 'created',
        supplierId: newSupplier.id
      });
      syncedCount++;
    }
  }

  return {
    syncedCount,
    results
  };
}

export default {
  // Constants
  SUPPLIER_STATUS,
  SUPPLIER_BILL_STATUS,
  SUPPLIER_PAYMENT_STATUS,
  
  // CRUD operations
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  
  // Financial operations
  getSupplierFinancialSummary,
  getSupplierAgingAnalysis,
  updateSupplierBalance,
  getSuppliersAgingReport,
  
  // History and reports
  getSupplierPurchaseHistory,
  getSupplierPaymentHistory,
  getSupplierExpenseSummary,
  getSupplierExpenseHistory,
  getTopSuppliersBySpending,
  
  // Credit management
  checkSupplierCredit,
  
  // Integration
  syncExpenseSuppliers,
  
  // Utilities
  generateSupplierCode,
  validateSupplierData
};
