// lib/cashFlowService.js
/**
 * Cash Flow Statement Service – Direct Method
 *
 * REPORT TYPE: Cash Flow Statement (Direct Method)
 *
 * CASH INFLOWS:
 * 1. Cash from Customer Payments – POS (Paid) + Invoices (Paid); payment method Cash/Bank/Mobile; date in period. Exclude credit not paid, journal entries, owner capital.
 * 2. Other Cash Receipts – Owner capital, refunds, asset sale proceeds, miscellaneous income "Cash received". Exclude sales.
 * 3. Total Cash Inflows = 1 + 2
 *
 * CASH OUTFLOWS:
 * 4. Payments to Suppliers – Expense (COGS or Supplier Expense, Paid, Cash/Bank/Mobile) + SupplierPayment (bills); exclude unpaid bills, asset purchases.
 * 5. Salary Payments – Payroll (Paid/Processed) + employer statutory if paid in cash.
 * 6. Rent Payments – Expense category Rent, Paid, cash/bank.
 * 7. Other Expense Payments – All other paid operating expenses (not supplier, salary, rent, asset).
 * 8. Asset Purchases – Asset module or Payment type Asset Purchase, Paid.
 * 9. Loan Payments – Loan repayments (principal + interest).
 * 10. Total Cash Outflows = 4 + 5 + 6 + 7 + 8 + 9
 *
 * NET CASH FLOW: 11. Net = Total Inflows − Total Outflows
 *
 * CASH BALANCES:
 * 12. Opening Cash Balance – Closing cash from previous reporting period (cash + bank + mobile).
 * 13. Add: Net Cash Flow
 * 14. Closing Cash Balance = Opening + Net. Validation: should match Balance Sheet cash as of end date.
 */

import prisma from './prisma.js';
import { generateBalanceSheetFromAccounts } from './balanceSheetService';
import { formatYmdInTimeZone, parseInclusiveApiYmdRange } from './dateUtils';
import {
  isCompletedReportStatus,
  isValidReportDocumentStatus,
} from './reportingSourceRules';
import {
  classifyCashFlowFromGl,
  bucketsToLineItems,
  sumBucketValues,
} from './cashFlowGlService.js';
import { resolveCashAndBankAccounts } from './cashAccountCoa.js';
import { addMoney, roundMoney, subtractMoney } from './money.js';

const CASH_PAYMENT_METHODS = [
  'cash', 'bank_transfer', 'airtel_money', 'mpamba', 'paychangu',
  'Cash', 'Bank', 'Bank Transfer', 'Airtel Money', 'Mpamba', 'PayChangu'
];

function isCashPaymentMethod(method) {
  if (!method) return false;
  const m = String(method).trim().toLowerCase().replace(/\s+/g, '_');
  return CASH_PAYMENT_METHODS.some(p => p.toLowerCase().replace(/\s+/g, '_') === m) ||
    m.includes('cash') || m.includes('bank') || m.includes('airtel') || m.includes('mpamba') || m.includes('paychangu');
}

/**
 * Get total cash balance as of a date (for opening/closing). Uses balance sheet logic so closing can match BS.
 */
async function getCashBalanceAsOfDate(tenantId, asOfDate, branchId = null) {
  const sheet = await generateBalanceSheetFromAccounts(tenantId, asOfDate, 'Company', null, branchId);
  return sheet?.assets?.currentAssets?.cashAndCashEquivalents ?? 0;
}

/**
 * Generate Cash Flow Statement (Direct Method) from payments, expenses, payroll, assets, loans.
 */
export async function generateCashFlowFromAccounts(
  tenantId,
  startDate,
  endDate,
  companyName = 'Company',
  logoUrl = null,
  branchId = null
) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);

  const branchFilter = branchId ? { branchId } : {};
  const dateFilter = { gte: start, lte: end };

  // —— CASH INFLOWS ——

  // 1. Cash from Customer Payments: POS (Paid) + Invoices (Paid), payment method Cash/Bank/Mobile, date in period
  // Exclude: owner capital injections, journal entries (these go to Other Receipts / Financing)
  const capitalPaymentTypes = ['capital', 'owner contribution', 'investment', 'capital injection'];
  const customerPayments = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      amount: { gt: 0 },
      OR: [
        { invoiceId: { not: null } },
        { saleId: { not: null } }
      ],
      ...branchFilter
    },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          status: true,
          voidedAt: true,
          refundedAt: true,
          isReversal: true,
          client: { select: { name: true } }
        }
      },
      sale: {
        select: {
          saleNumber: true,
          status: true,
          voidedAt: true,
          refundedAt: true,
          isReversal: true,
          client: { select: { name: true } }
        }
      }
    }
  });

  let cashFromCustomerPayments = 0;
  const customerPaymentDetails = [];
  for (const p of customerPayments) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    if (p.invoiceId) {
      const inv = p.invoice;
      if (!inv || inv.voidedAt || inv.refundedAt || inv.isReversal || !isValidReportDocumentStatus(inv.status)) continue;
    }
    if (p.saleId) {
      const sale = p.sale;
      if (!sale || sale.voidedAt || sale.refundedAt || sale.isReversal || !isCompletedReportStatus(sale.status)) continue;
    }
    const typeLC = (p.type || '').toLowerCase();
    if (capitalPaymentTypes.some(ct => typeLC.includes(ct))) continue;
    const amt = parseFloat(p.amount) || 0;
    cashFromCustomerPayments += amt;
    customerPaymentDetails.push({
      date: p.paymentDate,
      description: p.invoiceId ? `Invoice ${p.invoice?.invoiceNumber}` : `Sale ${p.sale?.saleNumber}`,
      reference: p.reference || (p.invoiceId ? p.invoice?.invoiceNumber : p.sale?.saleNumber),
      amount: amt,
      type: p.invoiceId ? 'customer_payment' : 'sale_payment',
      clientName: p.invoice?.client?.name || p.sale?.client?.name
    });
  }

  // 2. Other Cash Receipts: owner capital, refunds, asset sale, misc income "Cash received". Exclude sales.
  const otherReceiptPayments = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      amount: { gt: 0 },
      invoiceId: null,
      saleId: null,
      expenseId: null,
      ...branchFilter
    }
  });

  let otherCashReceipts = 0;
  const otherReceiptDetails = [];
  const allowedReceiptTypes = [
    'capital', 'owner contribution', 'investment', 'owner capital', 'capital injection',
    'income', 'other', 'refund', 'asset sale', 'miscellaneous', 'cash received'
  ];
  for (const p of otherReceiptPayments) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const typeStr = (p.type || '').toLowerCase();
    const notes = (p.notes || '').toLowerCase();
    // Only include recognised receipt types; skip loan receipts and unrecognised types
    const isAllowed = !typeStr || allowedReceiptTypes.some(t => typeStr.includes(t) || notes.includes(t));
    if (!isAllowed) continue;
    const amt = parseFloat(p.amount) || 0;
    otherCashReceipts += amt;
    otherReceiptDetails.push({
      date: p.paymentDate,
      description: p.notes || p.type || 'Other receipt',
      reference: p.reference || p.id,
      amount: amt,
      type: 'other_receipt'
    });
  }

  const opTotalCashInflows = cashFromCustomerPayments + otherCashReceipts;

  // —— CASH OUTFLOWS ——

  // 4. Payments to Suppliers: (a) SupplierPayment (bills) (b) Expense with category COGS or Supplier Expense, Paid, cash
  const supplierPaymentRecords = await prisma.supplierPayment.findMany({
    where: {
      tenantId,
      paymentDate: dateFilter,
      isReversal: false,
    },
    include: {
      supplier: { select: { supplierName: true } },
      allocations: { include: { bill: { select: { billNumber: true } } } }
    }
  });

  let paymentsToSuppliers = 0;
  const supplierPaymentDetails = [];
  for (const sp of supplierPaymentRecords) {
    if (!isCashPaymentMethod(sp.paymentMethod)) continue;
    const amt = parseFloat(sp.totalAmount) || 0;
    paymentsToSuppliers += amt;
    const billNumbers = sp.allocations?.map(a => a.bill?.billNumber).filter(Boolean).join(', ') || '—';
    supplierPaymentDetails.push({
      date: sp.paymentDate,
      description: `Bills ${billNumbers}`,
      reference: sp.referenceNumber || sp.paymentNumber,
      amount: amt,
      type: 'supplier_payment',
      supplierName: sp.supplier?.supplierName
    });
  }

  const expensePaymentsForSuppliers = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      expenseId: { not: null },
      ...branchFilter
    },
    include: {
      expense: {
        select: {
          category: true,
          description: true,
          paymentStatus: true,
          status: true,
          isDeleted: true,
          isReversal: true
        }
      }
    }
  });

  const cogsOrSupplierCategories = ['cost of goods sold', 'cogs', 'supplier expense', 'supplier', 'vendor'];
  const paidStatuses = ['paid', 'fully paid', 'settled'];
  for (const p of expensePaymentsForSuppliers) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const cat = (p.expense?.category || '').toLowerCase();
    if (p.expense?.isDeleted || p.expense?.isReversal) continue;
    if (!cogsOrSupplierCategories.some(c => cat.includes(c))) continue;
    const expStatus = (p.expense?.paymentStatus || '').toLowerCase();
    if (expStatus && !paidStatuses.some(s => expStatus.includes(s))) continue;
    const amt = parseFloat(p.amount) || 0;
    paymentsToSuppliers += amt;
    supplierPaymentDetails.push({
      date: p.paymentDate,
      description: p.expense?.description || 'Expense',
      reference: p.reference || p.id,
      amount: amt,
      type: 'expense_supplier'
    });
  }

  // 5. Salary Payments: expense payments with salary GL/category (payroll table skipped — GL/expense is authoritative)
  let salaryPayments = 0;
  const salaryDetails = [];
  const expensePaymentsForSalary = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      expenseId: { not: null },
      ...branchFilter
    },
    include: {
      expense: {
        select: { category: true, description: true, paymentStatus: true, isDeleted: true, isReversal: true }
      }
    }
  });
  const salaryCategories = ['salary', 'salaries', 'wage', 'wages', 'payroll'];
  for (const p of expensePaymentsForSalary) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const cat = (p.expense?.category || '').toLowerCase();
    if (p.expense?.isDeleted || p.expense?.isReversal) continue;
    if (!salaryCategories.some(c => cat.includes(c))) continue;
    const expStatus = (p.expense?.paymentStatus || '').toLowerCase();
    if (expStatus && !paidStatuses.some(s => expStatus.includes(s))) continue;
    const amt = parseFloat(p.amount) || 0;
    salaryPayments += amt;
    salaryDetails.push({
      date: p.paymentDate,
      description: p.expense?.description || 'Salary',
      reference: p.reference || p.id,
      amount: amt,
      type: 'expense_salary'
    });
  }

  // 6. Rent Payments
  let rentPayments = 0;
  const rentDetails = [];
  const rentExpensePayments = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      expenseId: { not: null },
      ...branchFilter
    },
    include: {
      expense: {
        select: { category: true, description: true, paymentStatus: true, isDeleted: true, isReversal: true }
      }
    }
  });
  for (const p of rentExpensePayments) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const cat = (p.expense?.category || '').toLowerCase();
    if (p.expense?.isDeleted || p.expense?.isReversal) continue;
    if (!cat.includes('rent')) continue;
    const expStatus = (p.expense?.paymentStatus || '').toLowerCase();
    if (expStatus && !paidStatuses.some(s => expStatus.includes(s))) continue;
    const amt = parseFloat(p.amount) || 0;
    rentPayments += amt;
    rentDetails.push({
      date: p.paymentDate,
      description: p.expense?.description || 'Rent',
      reference: p.reference || p.id,
      amount: amt,
      type: 'rent'
    });
  }

  // 7. Other Expense Payments: paid operating expenses not in supplier, salary, rent, asset
  let otherExpensePayments = 0;
  const otherExpenseDetails = [];
  const allExpensePayments = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      expenseId: { not: null },
      type: { notIn: ['Asset Purchase', 'Loan Payment', 'Loan Repayment', 'Loan Payment - Principal', 'Loan Payment - Interest'] },
      ...branchFilter
    },
    include: {
      expense: {
        select: { category: true, description: true, paymentStatus: true, isDeleted: true, isReversal: true }
      }
    }
  });
  for (const p of allExpensePayments) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const cat = (p.expense?.category || '').toLowerCase();
    if (p.expense?.isDeleted || p.expense?.isReversal) continue;
    const isSupplier = cogsOrSupplierCategories.some(c => cat.includes(c));
    const isSalary = salaryCategories.some(c => cat.includes(c));
    const isRent = cat.includes('rent');
    if (isSupplier || isSalary || isRent) continue;
    const expStatus = (p.expense?.paymentStatus || '').toLowerCase();
    if (expStatus && !paidStatuses.some(s => expStatus.includes(s))) continue;
    const amt = parseFloat(p.amount) || 0;
    otherExpensePayments += amt;
    otherExpenseDetails.push({
      date: p.paymentDate,
      description: p.expense?.description || p.expense?.category || 'Expense',
      reference: p.reference || p.id,
      amount: amt,
      category: p.expense?.category,
      type: 'other_expense'
    });
  }

  // 8. Asset Purchases: Payment type Asset Purchase + Asset module purchases in period
  let assetPurchases = 0;
  const assetPurchaseDetails = [];

  const assetPayments = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      type: 'Asset Purchase',
      ...branchFilter
    }
  });
  for (const p of assetPayments) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const amt = parseFloat(p.amount) || 0;
    assetPurchases += amt;
    assetPurchaseDetails.push({
      date: p.paymentDate,
      description: p.notes || p.description || 'Asset purchase',
      reference: p.reference || p.id,
      amount: amt,
      type: 'asset_payment'
    });
  }

  // Only add Asset-module purchases that don't already have a Payment record
  // (avoids double-counting when both an Asset row and an "Asset Purchase" Payment exist)
  const assetPaymentRefs = new Set(
    assetPayments.map(p => (p.notes || p.reference || '').toLowerCase())
  );
  const assetsPurchasedInPeriod = await prisma.asset.findMany({
    where: {
      tenantId,
      purchaseDate: dateFilter,
      isExistingAsset: { not: true }
    },
    select: { id: true, name: true, purchaseDate: true, originalCost: true }
  });
  for (const a of assetsPurchasedInPeriod) {
    const nameLC = (a.name || '').toLowerCase();
    const alreadyCaptured = assetPaymentRefs.has(nameLC) ||
      assetPurchaseDetails.some(d => d.description?.toLowerCase().includes(nameLC));
    if (alreadyCaptured) continue;
    const amt = parseFloat(a.originalCost) || 0;
    assetPurchases += amt;
    assetPurchaseDetails.push({
      date: a.purchaseDate,
      description: a.name || 'Asset',
      reference: a.id,
      amount: amt,
      type: 'asset_module'
    });
  }

  // 9. Loan Payments: Payment type Loan Payment / Loan Repayment / Loan Payment - Principal / Interest
  let loanPayments = 0;
  let loanPrincipal = 0;
  let loanInterest = 0;
  const loanPaymentDetails = [];

  const loanPaymentRecords = await prisma.payment.findMany({
    where: {
      tenantId,
      status: { equals: 'Completed', mode: 'insensitive' },
      isReversal: false,
      paymentDate: dateFilter,
      type: { in: ['Loan Payment', 'Loan Repayment', 'Loan Payment - Principal', 'Loan Payment - Interest'] },
      ...branchFilter
    },
    include: {
      expense: { select: { category: true } }
    }
  });
  for (const p of loanPaymentRecords) {
    if (!isCashPaymentMethod(p.paymentMethod)) continue;
    const amt = parseFloat(p.amount) || 0;
    loanPayments += amt;
    const isInterest = (p.type || '').toLowerCase().includes('interest') || (p.expense?.category || '').toLowerCase().includes('interest');
    if (isInterest) loanInterest += amt;
    else loanPrincipal += amt;
    loanPaymentDetails.push({
      date: p.paymentDate,
      description: p.notes || p.type || 'Loan payment',
      reference: p.reference || p.id,
      amount: amt,
      principalPaid: isInterest ? 0 : amt,
      interestPaid: isInterest ? amt : 0,
      type: 'loan_payment'
    });
  }

  const opTotalCashOutflows =
    paymentsToSuppliers +
    salaryPayments +
    rentPayments +
    otherExpensePayments +
    assetPurchases +
    loanPayments;

  const netCashFlowOperational = opTotalCashInflows - opTotalCashOutflows;

  // —— CASH BALANCES (CoA / Balance Sheet) ——
  const endDateStr = formatYmdInTimeZone(end);
  const previousPeriodEndStr = formatYmdInTimeZone(new Date(start.getTime() - 1));
  const openingCashBalance = await getCashBalanceAsOfDate(tenantId, previousPeriodEndStr, branchId);
  const closingCashBalance = await getCashBalanceAsOfDate(tenantId, endDateStr, branchId);

  /** Authoritative net = change in CoA cash per balance sheet (always reconciles opening → closing). */
  const netCashFlowFromBalances = subtractMoney(closingCashBalance, openingCashBalance);

  // —— GL classification (posted cash/bank CoA accounts) ——
  const glResult = await classifyCashFlowFromGl(tenantId, start, end, branchId);
  const cashAccountsMeta =
    glResult.cashAccounts.length > 0
      ? glResult.cashAccounts
      : (await resolveCashAndBankAccounts(tenantId)).map((a) => ({
          accountId: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
        }));

  const useGlBreakdown = glResult.transactionCount > 0;
  let classificationGap = 0;
  let dataSource = 'operational';
  let netCashFlow = netCashFlowFromBalances;
  let cashInflowsLineItems;
  let cashOutflowsLineItems;
  let totalCashInflows;
  let totalCashOutflows;

  let reportCustomerPayments = cashFromCustomerPayments;
  let reportOtherReceipts = otherCashReceipts;
  let reportSupplierPayments = paymentsToSuppliers;
  let reportSalaryPayments = salaryPayments;
  let reportRentPayments = rentPayments;
  let reportOtherExpensePayments = otherExpensePayments;
  let reportAssetPurchases = assetPurchases;
  let reportLoanPayments = loanPayments;
  let reportLoanPrincipal = loanPrincipal;
  let reportLoanInterest = loanInterest;
  let reportCustomerDetails = customerPaymentDetails;
  let reportOtherReceiptDetails = otherReceiptDetails;
  let reportSupplierDetails = supplierPaymentDetails;
  let reportSalaryDetails = salaryDetails;
  let reportRentDetails = rentDetails;
  let reportOtherExpenseDetails = otherExpenseDetails;
  let reportAssetDetails = assetPurchaseDetails;
  let reportLoanDetails = loanPaymentDetails;

  if (useGlBreakdown) {
    dataSource = 'gl';
    const { inflowItems, outflowItems } = bucketsToLineItems(glResult.buckets);
    const { inflows: glInflows, outflows: glOutflows } = sumBucketValues(glResult.buckets);
    classificationGap = subtractMoney(
      netCashFlowFromBalances,
      subtractMoney(glInflows, glOutflows)
    );

    if (Math.abs(classificationGap) >= 0.01) {
      const gapDetail = {
        date: end,
        description: 'Unclassified GL cash movement (counter-account mapping or internal transfer)',
        reference: 'CF-RECON',
        amount: Math.abs(classificationGap),
        type: 'reconciliation_gap',
      };
      if (classificationGap > 0) {
        inflowItems.push({
          key: 'unclassified-inflow',
          label: 'Other / Unclassified Cash Receipts',
          value: roundMoney(classificationGap),
          details: [gapDetail],
        });
      } else {
        outflowItems.push({
          key: 'unclassified-outflow',
          label: 'Other / Unclassified Cash Payments',
          value: roundMoney(Math.abs(classificationGap)),
          details: [gapDetail],
        });
      }
    }

    cashInflowsLineItems = inflowItems;
    cashOutflowsLineItems = outflowItems;
    totalCashInflows = inflowItems.reduce((s, i) => addMoney(s, i.value), 0);
    totalCashOutflows = outflowItems.reduce((s, i) => addMoney(s, i.value), 0);
    netCashFlow = netCashFlowFromBalances;

    reportCustomerPayments =
      inflowItems.find((i) => i.key === 'cash-from-customers')?.value ?? 0;
    reportOtherReceipts = inflowItems
      .filter((i) => i.key !== 'cash-from-customers')
      .reduce((s, i) => addMoney(s, i.value), 0);
    reportSupplierPayments =
      outflowItems.find((i) => i.key === 'payments-to-suppliers')?.value ?? 0;
    reportSalaryPayments =
      outflowItems.find((i) => i.key === 'salary-payments')?.value ?? 0;
    reportRentPayments = outflowItems.find((i) => i.key === 'rent-payments')?.value ?? 0;
    reportOtherExpensePayments =
      outflowItems.find((i) => i.key === 'other-expense-payments')?.value ?? 0;
    reportAssetPurchases =
      outflowItems.find((i) => i.key === 'asset-purchases')?.value ?? 0;
    const loanItem = outflowItems.find((i) => i.key === 'loan-payments');
    reportLoanPayments = loanItem?.value ?? 0;
    reportLoanPrincipal = loanItem?.principalPaid ?? 0;
    reportLoanInterest = loanItem?.interestPaid ?? 0;

    reportCustomerDetails =
      inflowItems.find((i) => i.key === 'cash-from-customers')?.details ?? [];
    reportOtherReceiptDetails = inflowItems
      .filter((i) => i.key !== 'cash-from-customers')
      .flatMap((i) => i.details || []);
    reportSupplierDetails =
      outflowItems.find((i) => i.key === 'payments-to-suppliers')?.details ?? [];
    reportSalaryDetails =
      outflowItems.find((i) => i.key === 'salary-payments')?.details ?? [];
    reportRentDetails = outflowItems.find((i) => i.key === 'rent-payments')?.details ?? [];
    reportOtherExpenseDetails = outflowItems
      .filter((i) =>
        ['other-expense-payments', 'unclassified-outflow'].includes(i.key)
      )
      .flatMap((i) => i.details || []);
    reportAssetDetails =
      outflowItems.find((i) => i.key === 'asset-purchases')?.details ?? [];
    reportLoanDetails =
      outflowItems.find((i) => i.key === 'loan-payments')?.details ?? [];
  } else {
    dataSource = 'operational';

    cashInflowsLineItems = [
      {
        key: 'cash-from-customers',
        label: 'Cash from Customer Payments',
        value: reportCustomerPayments,
        details: reportCustomerDetails,
      },
      {
        key: 'other-cash-receipts',
        label: 'Other Cash Receipts',
        value: reportOtherReceipts,
        details: reportOtherReceiptDetails,
      },
    ].filter((i) => (i.value || 0) > 0.000001);

    cashOutflowsLineItems = [
      {
        key: 'payments-to-suppliers',
        label: 'Payments to Suppliers',
        value: reportSupplierPayments,
        details: reportSupplierDetails,
      },
      {
        key: 'salary-payments',
        label: 'Salary Payments',
        value: reportSalaryPayments,
        details: reportSalaryDetails,
      },
      {
        key: 'rent-payments',
        label: 'Rent Payments',
        value: reportRentPayments,
        details: reportRentDetails,
      },
      {
        key: 'other-expense-payments',
        label: 'Other Expense Payments',
        value: reportOtherExpensePayments,
        details: reportOtherExpenseDetails,
      },
      {
        key: 'asset-purchases',
        label: 'Asset Purchases',
        value: reportAssetPurchases,
        details: reportAssetDetails,
      },
      {
        key: 'loan-payments',
        label: 'Loan Payments',
        value: reportLoanPayments,
        details: reportLoanDetails,
        principalPaid: reportLoanPrincipal,
        interestPaid: reportLoanInterest,
      },
    ].filter((i) => (i.value || 0) > 0.000001);

    totalCashInflows = opTotalCashInflows;
    totalCashOutflows = opTotalCashOutflows;

    const opGap = subtractMoney(netCashFlowFromBalances, netCashFlowOperational);
    if (Math.abs(opGap) >= 0.01) {
      classificationGap = opGap;
    }
  }

  const calculatedClosing = addMoney(openingCashBalance, netCashFlow);
  const difference = Math.abs(subtractMoney(calculatedClosing, closingCashBalance));
  const isReconciled = difference < 0.01;

  return {
    companyName,
    logoUrl,
    period: {
      startDate: formatYmdInTimeZone(start),
      endDate: endDateStr
    },
    reportType: 'Direct Method',
    cashInflows: {
      cashFromCustomerPayments: reportCustomerPayments,
      otherCashReceipts: reportOtherReceipts,
      total: totalCashInflows,
      lineItems: cashInflowsLineItems,
      details: [...reportCustomerDetails, ...reportOtherReceiptDetails],
    },
    cashOutflows: {
      paymentsToSuppliers: reportSupplierPayments,
      salaryPayments: reportSalaryPayments,
      rentPayments: reportRentPayments,
      otherExpensePayments: reportOtherExpensePayments,
      assetPurchases: reportAssetPurchases,
      loanPayments: reportLoanPayments,
      loanPrincipalPaid: reportLoanPrincipal,
      loanInterestPaid: reportLoanInterest,
      total: totalCashOutflows,
      lineItems: cashOutflowsLineItems,
      details: [
        ...reportSupplierDetails,
        ...reportSalaryDetails,
        ...reportRentDetails,
        ...reportOtherExpenseDetails,
        ...reportAssetDetails,
        ...reportLoanDetails,
      ],
    },
    netCashFlow,
    openingCashBalance,
    closingCashBalance,
    cashAccounts: cashAccountsMeta,
    cashBalances: {
      openingBalance: openingCashBalance,
      closingBalance: closingCashBalance,
      netIncreaseDecrease: netCashFlow,
      calculatedClosing: addMoney(openingCashBalance, netCashFlow),
      difference,
      isReconciled,
      glNetMovement: glResult.glNetMovement,
      classificationGap: roundMoney(classificationGap),
    },
    summary: {
      netIncreaseDecrease: netCashFlow,
      openingCashBalance,
      closingCashBalance,
    },
    reconciliationWarning: isReconciled
      ? Math.abs(classificationGap) >= 0.01
        ? `Period line items may not fully classify all GL cash movement (gap: ${roundMoney(Math.abs(classificationGap)).toFixed(2)}). Review counter-accounts on cash journals.`
        : null
      : `Cash flow closing (opening + net cash flow) differs from balance sheet cash and cash equivalents as of ${endDateStr} by ${difference.toFixed(2)}. Review cash account mapping in Chart of Accounts.`,
    metadata: {
      generatedAt: new Date().toISOString(),
      dataSource,
      glTransactionCount: glResult.transactionCount,
      cashAccountCount: cashAccountsMeta.length,
      balanceSource: 'balance_sheet_coa',
    },
  };
}
