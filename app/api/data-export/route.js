import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { buildCsv } from '@/lib/csvExport';

const datasets = [
  {
    key: 'clients',
    fileName: 'clients.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'address', header: 'Address' },
      { key: 'contactPerson', header: 'Contact Person' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.client.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          contactPerson: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'asc' }
      })
  },
  {
    key: 'products',
    fileName: 'products.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'description', header: 'Description' },
      { key: 'sku', header: 'SKU' },
      { key: 'price', header: 'Price' },
      { key: 'cost', header: 'Cost' },
      { key: 'stockLevel', header: 'Stock Level' },
      { key: 'averageCost', header: 'Average Cost' },
      { key: 'totalStockValue', header: 'Total Stock Value' },
      { key: 'isService', header: 'Is Service' },
      { key: 'taxRate', header: 'Tax Rate' },
      { key: 'category', header: 'Category' },
      { key: 'location', header: 'Location' },
      { key: 'reorderLevel', header: 'Reorder Level' },
      { key: 'reorderQuantity', header: 'Reorder Quantity' },
      { key: 'leadTimeDays', header: 'Lead Time Days' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.product.findMany({
        where: { tenantId, isDeleted: false },
        select: {
          id: true,
          name: true,
          description: true,
          sku: true,
          price: true,
          cost: true,
          stockLevel: true,
          averageCost: true,
          totalStockValue: true,
          isService: true,
          taxRate: true,
          category: true,
          location: true,
          reorderLevel: true,
          reorderQuantity: true,
          leadTimeDays: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'asc' }
      })
  },
  {
    key: 'inventoryTransactions',
    fileName: 'inventory-transactions.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'type', header: 'Type' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'notes', header: 'Notes' },
      { key: 'productId', header: 'Product ID' },
      { key: 'userId', header: 'User ID' },
      { key: 'createdAt', header: 'Created At' }
    ],
    fetch: (tenantId) =>
      prisma.inventoryTransaction.findMany({
        where: { tenantId },
        select: {
          id: true,
          type: true,
          quantity: true,
          notes: true,
          productId: true,
          userId: true,
          createdAt: true
        },
        orderBy: { createdAt: 'asc' }
      })
  },
  {
    key: 'sales',
    fileName: 'sales.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'saleNumber', header: 'Sale Number' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'saleDate', header: 'Sale Date' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'taxAmount', header: 'Tax Amount' },
      { key: 'total', header: 'Total' },
      { key: 'status', header: 'Status' },
      { key: 'paymentMethod', header: 'Payment Method' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.sale.findMany({
        where: { tenantId },
        select: {
          id: true,
          saleNumber: true,
          clientId: true,
          saleDate: true,
          subtotal: true,
          taxAmount: true,
          total: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { saleDate: 'asc' }
      })
  },
  {
    key: 'saleItems',
    fileName: 'sale-items.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'saleId', header: 'Sale ID' },
      { key: 'productId', header: 'Product ID' },
      { key: 'description', header: 'Description' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'unitPrice', header: 'Selling Price' },
      { key: 'amount', header: 'Amount' },
      { key: 'discountAmount', header: 'Discount Amount' },
      { key: 'taxAmount', header: 'Tax Amount' },
      { key: 'taxRate', header: 'Tax Rate' },
      { key: 'isCustom', header: 'Is Custom' }
    ],
    fetch: (tenantId) =>
      prisma.saleItem.findMany({
        where: { sale: { tenantId } },
        select: {
          id: true,
          saleId: true,
          productId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          discountAmount: true,
          taxAmount: true,
          taxRate: true,
          isCustom: true
        },
        orderBy: { saleId: 'asc' }
      })
  },
  {
    key: 'invoices',
    fileName: 'invoices.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'invoiceNumber', header: 'Invoice Number' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'issueDate', header: 'Issue Date' },
      { key: 'dueDate', header: 'Due Date' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'taxAmount', header: 'Tax Amount' },
      { key: 'total', header: 'Total' },
      { key: 'status', header: 'Status' },
      { key: 'totalPaid', header: 'Total Paid' },
      { key: 'remainingBalance', header: 'Remaining Balance' },
      { key: 'lastPaymentDate', header: 'Last Payment Date' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.invoice.findMany({
        where: { tenantId },
        select: {
          id: true,
          invoiceNumber: true,
          clientId: true,
          issueDate: true,
          dueDate: true,
          subtotal: true,
          taxAmount: true,
          total: true,
          status: true,
          totalPaid: true,
          remainingBalance: true,
          lastPaymentDate: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { issueDate: 'asc' }
      })
  },
  {
    key: 'invoiceItems',
    fileName: 'invoice-items.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'invoiceId', header: 'Invoice ID' },
      { key: 'productId', header: 'Product ID' },
      { key: 'description', header: 'Description' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'unitPrice', header: 'Selling Price' },
      { key: 'amount', header: 'Amount' },
      { key: 'taxRate', header: 'Tax Rate' },
      { key: 'discountAmount', header: 'Discount Amount' },
      { key: 'netAmount', header: 'Net Amount' }
    ],
    fetch: (tenantId) =>
      prisma.invoiceItem.findMany({
        where: { invoice: { tenantId } },
        select: {
          id: true,
          invoiceId: true,
          productId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          taxRate: true,
          discountAmount: true,
          netAmount: true
        },
        orderBy: { invoiceId: 'asc' }
      })
  },
  {
    key: 'expenses',
    fileName: 'expenses.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'description', header: 'Description' },
      { key: 'amount', header: 'Amount' },
      { key: 'date', header: 'Date' },
      { key: 'category', header: 'Category' },
      { key: 'paymentMethod', header: 'Payment Method' },
      { key: 'status', header: 'Status' },
      { key: 'merchant', header: 'Merchant' },
      { key: 'paymentStatus', header: 'Payment Status' },
      { key: 'paidAmount', header: 'Paid Amount' },
      { key: 'notes', header: 'Notes' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.expense.findMany({
        where: { tenantId, isDeleted: false },
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          category: true,
          paymentMethod: true,
          status: true,
          merchant: true,
          paymentStatus: true,
          paidAmount: true,
          notes: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { date: 'asc' }
      })
  },
  {
    key: 'payments',
    fileName: 'payments.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'type', header: 'Type' },
      { key: 'invoiceId', header: 'Invoice ID' },
      { key: 'saleId', header: 'Sale ID' },
      { key: 'expenseId', header: 'Expense ID' },
      { key: 'amount', header: 'Amount' },
      { key: 'paymentDate', header: 'Payment Date' },
      { key: 'paymentMethod', header: 'Payment Method' },
      { key: 'sourceAccount', header: 'Source Account' },
      { key: 'destinationAccount', header: 'Destination Account' },
      { key: 'reference', header: 'Reference' },
      { key: 'notes', header: 'Notes' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.payment.findMany({
        where: { tenantId },
        select: {
          id: true,
          type: true,
          invoiceId: true,
          saleId: true,
          expenseId: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          sourceAccount: true,
          destinationAccount: true,
          reference: true,
          notes: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { paymentDate: 'asc' }
      })
  },
  {
    key: 'assets',
    fileName: 'assets.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'description', header: 'Description' },
      { key: 'categoryId', header: 'Category ID' },
      { key: 'purchaseDate', header: 'Purchase Date' },
      { key: 'originalCost', header: 'Original Cost' },
      { key: 'usefulLifeYears', header: 'Useful Life (Years)' },
      { key: 'depreciationMethod', header: 'Depreciation Method' },
      { key: 'status', header: 'Status' },
      { key: 'location', header: 'Location' },
      { key: 'serialNumber', header: 'Serial Number' },
      { key: 'supplier', header: 'Supplier' },
      { key: 'warrantyExpiry', header: 'Warranty Expiry' },
      { key: 'notes', header: 'Notes' },
      { key: 'isExistingAsset', header: 'Existing Asset' },
      { key: 'accumulatedDepreciation', header: 'Accumulated Depreciation' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.asset.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          description: true,
          categoryId: true,
          purchaseDate: true,
          originalCost: true,
          usefulLifeYears: true,
          depreciationMethod: true,
          status: true,
          location: true,
          serialNumber: true,
          supplier: true,
          warrantyExpiry: true,
          notes: true,
          isExistingAsset: true,
          accumulatedDepreciation: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { purchaseDate: 'asc' }
      })
  },
  {
    key: 'liabilities',
    fileName: 'liabilities.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'name', header: 'Name' },
      { key: 'description', header: 'Description' },
      { key: 'categoryId', header: 'Category ID' },
      { key: 'liabilityType', header: 'Liability Type' },
      { key: 'principalAmount', header: 'Principal Amount' },
      { key: 'interestRate', header: 'Interest Rate' },
      { key: 'interestType', header: 'Interest Type' },
      { key: 'oneTimeInterestAmount', header: 'One-time Interest Amount' },
      { key: 'startDate', header: 'Start Date' },
      { key: 'maturityDate', header: 'Maturity Date' },
      { key: 'termMonths', header: 'Term Months' },
      { key: 'paymentFrequency', header: 'Payment Frequency' },
      { key: 'status', header: 'Status' },
      { key: 'lender', header: 'Lender' },
      { key: 'accountNumber', header: 'Account Number' },
      { key: 'notes', header: 'Notes' },
      { key: 'currentBalance', header: 'Current Balance' },
      { key: 'totalPaid', header: 'Total Paid' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.liability.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          description: true,
          categoryId: true,
          liabilityType: true,
          principalAmount: true,
          interestRate: true,
          interestType: true,
          oneTimeInterestAmount: true,
          startDate: true,
          maturityDate: true,
          termMonths: true,
          paymentFrequency: true,
          status: true,
          lender: true,
          accountNumber: true,
          notes: true,
          currentBalance: true,
          totalPaid: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { startDate: 'asc' }
      })
  },
  {
    key: 'liabilityPayments',
    fileName: 'liability-payments.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'liabilityId', header: 'Liability ID' },
      { key: 'amount', header: 'Amount' },
      { key: 'paymentDate', header: 'Payment Date' },
      { key: 'paymentType', header: 'Payment Type' },
      { key: 'principalPaid', header: 'Principal Paid' },
      { key: 'interestPaid', header: 'Interest Paid' },
      { key: 'reference', header: 'Reference' },
      { key: 'notes', header: 'Notes' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.liabilityPayment.findMany({
        where: { liability: { tenantId } },
        select: {
          id: true,
          liabilityId: true,
          amount: true,
          paymentDate: true,
          paymentType: true,
          principalPaid: true,
          interestPaid: true,
          reference: true,
          notes: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { paymentDate: 'asc' }
      })
  },
  {
    key: 'bankAccounts',
    fileName: 'bank-accounts.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'accountName', header: 'Account Name' },
      { key: 'accountNumber', header: 'Account Number' },
      { key: 'bankName', header: 'Bank Name' },
      { key: 'bankBranch', header: 'Bank Branch' },
      { key: 'accountType', header: 'Account Type' },
      { key: 'currency', header: 'Currency' },
      { key: 'openingBalance', header: 'Opening Balance' },
      { key: 'currentBalance', header: 'Current Balance' },
      { key: 'isActive', header: 'Is Active' },
      { key: 'notes', header: 'Notes' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.bankAccount.findMany({
        where: { tenantId },
        select: {
          id: true,
          accountName: true,
          accountNumber: true,
          bankName: true,
          bankBranch: true,
          accountType: true,
          currency: true,
          openingBalance: true,
          currentBalance: true,
          isActive: true,
          notes: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { accountName: 'asc' }
      })
  },
  {
    key: 'equityAccounts',
    fileName: 'equity-accounts.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'accountName', header: 'Account Name' },
      { key: 'accountType', header: 'Account Type' },
      { key: 'openingBalance', header: 'Opening Balance' },
      { key: 'currentBalance', header: 'Current Balance' },
      { key: 'ownerShareholder', header: 'Owner/Shareholder' },
      { key: 'ownershipPercentage', header: 'Ownership %' },
      { key: 'isActive', header: 'Is Active' },
      { key: 'notes', header: 'Notes' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.equityAccount.findMany({
        where: { tenantId },
        select: {
          id: true,
          accountName: true,
          accountType: true,
          openingBalance: true,
          currentBalance: true,
          ownerShareholder: true,
          ownershipPercentage: true,
          isActive: true,
          notes: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { accountName: 'asc' }
      })
  },
  {
    key: 'accounts',
    fileName: 'accounts.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'accountCode', header: 'Account Code' },
      { key: 'accountName', header: 'Account Name' },
      { key: 'accountType', header: 'Account Type' },
      { key: 'accountSubtype', header: 'Account Subtype' },
      { key: 'normalBalance', header: 'Normal Balance' },
      { key: 'isActive', header: 'Is Active' },
      { key: 'balance', header: 'Balance' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.account.findMany({
        where: { tenantId },
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          accountSubtype: true,
          normalBalance: true,
          isActive: true,
          balance: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { accountCode: 'asc' }
      })
  },
  {
    key: 'accountBalances',
    fileName: 'account-balances.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'account', header: 'Account' },
      { key: 'balance', header: 'Balance' },
      { key: 'updatedAt', header: 'Updated At' },
      { key: 'createdAt', header: 'Created At' }
    ],
    fetch: (tenantId) =>
      prisma.accountBalance.findMany({
        where: { tenantId },
        select: {
          id: true,
          account: true,
          balance: true,
          updatedAt: true,
          createdAt: true
        },
        orderBy: { account: 'asc' }
      })
  },
  {
    key: 'journalEntries',
    fileName: 'journal-entries.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'entryDate', header: 'Entry Date' },
      { key: 'description', header: 'Description' },
      { key: 'entryType', header: 'Entry Type' },
      { key: 'status', header: 'Status' },
      { key: 'sourceType', header: 'Source Type' },
      { key: 'sourceId', header: 'Source ID' },
      { key: 'createdById', header: 'Created By' },
      { key: 'postedById', header: 'Posted By' },
      { key: 'postedDate', header: 'Posted Date' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.journalEntry.findMany({
        where: { tenantId },
        select: {
          id: true,
          entryDate: true,
          description: true,
          entryType: true,
          status: true,
          sourceType: true,
          sourceId: true,
          createdById: true,
          postedById: true,
          postedDate: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { entryDate: 'asc' }
      })
  },
  {
    key: 'journalEntryLines',
    fileName: 'journal-entry-lines.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'journalEntryId', header: 'Journal Entry ID' },
      { key: 'lineNumber', header: 'Line Number' },
      { key: 'accountId', header: 'Account ID' },
      { key: 'debitAmount', header: 'Debit Amount' },
      { key: 'creditAmount', header: 'Credit Amount' },
      { key: 'description', header: 'Description' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.journalEntryLine.findMany({
        where: {
          journalEntry: {
            tenantId
          }
        },
        select: {
          id: true,
          journalEntryId: true,
          lineNumber: true,
          accountId: true,
          debitAmount: true,
          creditAmount: true,
          description: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { journalEntryId: 'asc' }
      })
  },
  {
    key: 'transactions',
    fileName: 'transactions.csv',
    columns: [
      { key: 'id', header: 'ID' },
      { key: 'date', header: 'Date' },
      { key: 'description', header: 'Description' },
      { key: 'reference', header: 'Reference' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'updatedAt', header: 'Updated At' }
    ],
    fetch: (tenantId) =>
      prisma.transaction.findMany({
        where: { tenantId },
        select: {
          id: true,
          date: true,
          description: true,
          reference: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { date: 'asc' }
      })
  }
];

export async function GET(request) {
  const accessError = await requireStandardAccess(request);
  if (accessError) {
    return accessError;
  }

  const user = await getUserFromSession(request);
  if (!user || !user.tenantId) {
    return NextResponse.json(
      { error: 'Authentication required or no tenant associated' },
      { status: 401 }
    );
  }

  try {
    const zip = new JSZip();
    for (const dataset of datasets) {
      const records = await dataset.fetch(user.tenantId);
      const csv = buildCsv(dataset.columns, records);
      zip.file(dataset.fileName, csv);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const timestamp = new Date().toISOString().split('T')[0];

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="insight-data-export-${timestamp}.zip"`
      }
    });
  } catch (error) {
    console.error('Error generating data export:', error);
    return NextResponse.json(
      { error: 'Failed to generate data export. Please try again.' },
      { status: 500 }
    );
  }
}

