// lib/sales/createSale.js
// Extracted verbatim from the POST body of app/api/sales/route.js so the POS route
// and the desktop outbox share one implementation. The only behaviour difference:
// a caller-supplied `saleNumber` (allocated offline by a bound till) is persisted
// instead of allocating a new one from the cloud sequence.
import prisma from '@/lib/prisma';
import { assertPosTillOpenForSale, posBusinessDateToday } from '@/lib/posCashDayService';
import { resolveBranchId } from '@/lib/branchHelpers';
import { consumeFifoForSale } from '@/lib/fifoCosting';
import { postPosSaleAccounting, postCostOfSalesAccounting } from '@/lib/accountingV2/adapters';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';
import { prismaWhereCoaIncomeAccounts } from '@/lib/coaIncomeAccounts';
import { allocateNextSaleNumberReliable } from '@/lib/documentSequences';
import {
  resolveSaleItemBaseQuantity,
  resolveSaleLineAmount,
} from '@/lib/saleItemBaseQuantity';
import {
  addMoney,
  multiplyMoney,
  percentOfMoney,
  parseMoney,
  roundMoney,
  subtractMoney,
  sumMoney,
} from '@/lib/money';
import { emitPosTransactionCompleted } from '@/lib/admin/productAnalytics/producers';
import {
  assertActiveTaxTypeIds,
  collectTaxTypeIdsFromItems,
} from '@/lib/taxManagement/assertActiveTaxTypes';
import { serviceError } from '@/lib/serviceErrors';

/** Local calendar YYYYMMDD for sale number prefix (matches business sale date). */
function saleNumberDatePrefixFromDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Helper function to format currency (display strings)
const formatCurrency = (amount) => {
  return `MK ${typeof amount === 'number'
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount}`;
};

/** Coerce Prisma Decimal / string / number for JSON API responses */
export function toSaleNumber(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function serializePaymentsForClient(payments) {
  if (!Array.isArray(payments)) return [];
  return payments.map((p) => ({
    ...p,
    amount: toSaleNumber(p.amount),
    allocations: Array.isArray(p.allocations)
      ? p.allocations.map((a) => ({
          ...a,
          amount: toSaleNumber(a.amount),
        }))
      : [],
  }));
}

/** Prefer postable leaf income accounts (4100, etc.) — never section header 4000. */
async function getDefaultIncomeAccountIdForTenant(tenantId) {
  const { resolveDefaultPostableRevenueAccountId } = await import('@/lib/coaIncomeAccounts');
  return resolveDefaultPostableRevenueAccountId(prisma, tenantId);
}

/**
 * Create a sale (POS / historical) with stock, payment, FIFO COGS and GL postings.
 *
 * @param {object} args
 * @param {object} args.user Authenticated session user (id, tenantId, ...).
 * @param {object} args.body Sale payload (the former request JSON).
 * @param {string} [args.saleNumber] Offline-allocated sale number; skips cloud allocation.
 * @returns {Promise<object>} The API-shaped sale object (contains `id`).
 * @throws {import('@/lib/serviceErrors').ServiceHttpError} for client-visible validation failures.
 */
export async function createSale({ user, body, saleNumber: providedSaleNumber = null }) {
  const data = body;

  // Validate required fields
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw serviceError('Sale must include at least one item', { status: 400 });
  }

  if (!user?.tenantId) {
    throw serviceError('Tenant context required', { status: 400 });
  }

  // Hard-gate: live POS sales require an open till for the Blantyre business date
  if (!data.isHistorical) {
    try {
      await assertPosTillOpenForSale(user.tenantId, {
        businessDate: posBusinessDateToday(),
        isHistorical: false,
      });
    } catch (tillErr) {
      if (tillErr?.code === 'TILL_NOT_OPEN') {
        throw serviceError(tillErr.message, {
          status: 403,
          code: 'TILL_NOT_OPEN',
          body: {
            error: tillErr.message,
            code: 'TILL_NOT_OPEN',
            businessDate: tillErr.businessDate,
          },
        });
      }
      throw tillErr;
    }
  }

  // Auto-assign revenue GL: services → 4150, products → 4100 (no tenant picker).
  if (Array.isArray(data.items) && data.items.length) {
    const { applyAutomaticSaleRevenueAccounts } = await import('@/lib/coaIncomeAccounts');
    await applyAutomaticSaleRevenueAccounts(prisma, user.tenantId, data.items);
  }

  // Apply default income account for any line still missing accountId
  const needsIncomeDefault = data.items.some((item) => {
    const a = item.accountId;
    return a == null || (typeof a === 'string' && a.trim() === '');
  });
  if (needsIncomeDefault) {
    const defaultIncomeId = await getDefaultIncomeAccountIdForTenant(user.tenantId);
    if (!defaultIncomeId) {
      throw serviceError(
        'Income account is required. Please go to Chart of Accounts and create Income accounts 4100 Product Sales and 4150 Service Revenue before creating sales.',
        { status: 400 }
      );
    }
    for (const item of data.items) {
      const a = item.accountId;
      if (a == null || (typeof a === 'string' && a.trim() === '')) {
        item.accountId = defaultIncomeId;
      }
    }
  }

  // Relief supply validation (TC-RS-015, TC-RS-016)
  if (data.isReliefSupply) {
    if (!data.vat5CertificateNumber || typeof data.vat5CertificateNumber !== 'string' || data.vat5CertificateNumber.trim().length === 0) {
      throw serviceError('VAT 5 Certificate Number is required for relief supply transactions', {
        status: 400,
      });
    }
    // Zero out VAT on standard-rated items for relief supply
    for (const item of data.items) {
      if (Number(item.taxRate) > 0) {
        item.taxRate = 0;
        item.taxAmount = 0;
        if (item.taxBreakdown) {
          item.taxBreakdown = [];
        }
      }
    }
  }

  // Enhanced validation: Check that all items have required fields
  // Now supports custom products (productId can be null)
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];

    if (item.description == null || String(item.description).trim() === '') {
      throw serviceError(`Item ${i + 1}: description is required`, { status: 400 });
    }
    if (item.unitPrice === undefined || item.unitPrice === null) {
      throw serviceError(`Item ${i + 1}: unitPrice is required`, { status: 400 });
    }
    const hasPositiveUnitQty =
      item.unitQuantities &&
      typeof item.unitQuantities === 'object' &&
      Object.values(item.unitQuantities).some((v) => Number(v) > 0);
    const qNum = Number(item.quantity);
    if (!hasPositiveUnitQty && (!Number.isFinite(qNum) || qNum <= 0)) {
      throw serviceError(
        `Item ${i + 1}: enter a quantity (or unit amounts for flexible-unit products)`,
        { status: 400 }
      );
    }

    if (!item.accountId) {
      throw serviceError(`Item ${i + 1}: income account is required`, {
        status: 400,
        details: `Missing accountId in item: ${JSON.stringify(item)}`,
      });
    }

    // For non-custom products, validate productId exists
    if (!item.isCustom && item.productId) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stockLevel: true, name: true }
        });

        if (!product) {
          throw serviceError(`Product with ID ${item.productId} not found`, { status: 400 });
        }
      } catch (productError) {
        if (productError?.name === 'ServiceHttpError') throw productError;
        console.error('Error validating product:', productError);
        throw serviceError(`Invalid product ID: ${item.productId}`, { status: 400 });
      }
    }
  }

  try {
    await assertActiveTaxTypeIds(
      prisma,
      user.tenantId,
      collectTaxTypeIdsFromItems(data.items)
    );
  } catch (e) {
    if (e?.status === 400 || e?.code === 'INACTIVE_TAX' || e?.code === 'UNKNOWN_TAX') {
      throw serviceError(e.message, { status: 400, code: e.code });
    }
    throw e;
  }

  // Line subtotals: flexible-unit products use per-unit sell prices × unitQuantities (not cart quantity × one price)
  const productIdsForSubtotal = [
    ...new Set(data.items.filter((i) => i.productId && !i.isCustom).map((i) => i.productId)),
  ];
  let productMapForSubtotal = {};
  if (productIdsForSubtotal.length > 0) {
    const rows = await prisma.product.findMany({
      where: { id: { in: productIdsForSubtotal }, tenantId: user.tenantId },
      include: { productUnits: { include: { unit: true } } },
    });
    productMapForSubtotal = Object.fromEntries(rows.map((p) => [p.id, p]));
  }

  const lineSubtotals = [];
  const lineTaxes = [];
  const lineDiscounts = [];
  const computedLineAmounts = [];

  data.items.forEach((item, index) => {
    let itemSubtotal = multiplyMoney(item.quantity, item.unitPrice);
    if (!item.isCustom && item.productId && productMapForSubtotal[item.productId]) {
      const p = productMapForSubtotal[item.productId];
      try {
        const baseQ = resolveSaleItemBaseQuantity(item, p);
        itemSubtotal = roundMoney(resolveSaleLineAmount(item, p, baseQ));
      } catch {
        itemSubtotal = multiplyMoney(item.quantity, item.unitPrice);
      }
    }
    const lineDiscount = roundMoney(item.discountAmount || 0);
    const taxableAmount = subtractMoney(itemSubtotal, lineDiscount);
    let lineTax = roundMoney(item.taxAmount || 0);
    if (lineTax === 0 && parseMoney(item.taxRate) > 0) {
      lineTax = percentOfMoney(taxableAmount, item.taxRate);
    }
    lineSubtotals.push(itemSubtotal);
    lineTaxes.push(lineTax);
    lineDiscounts.push(lineDiscount);
    computedLineAmounts[index] = {
      subtotal: itemSubtotal,
      discountAmount: lineDiscount,
      taxableAmount,
      taxAmount: lineTax,
    };
  });

  const subtotal = roundMoney(sumMoney(lineSubtotals));
  const totalTaxAmount = roundMoney(sumMoney(lineTaxes));
  const totalDiscountAmount = roundMoney(sumMoney(lineDiscounts));
  const globalDiscount = roundMoney(data.globalDiscount || 0);

  const total = subtractMoney(
    addMoney(subtotal, totalTaxAmount),
    addMoney(totalDiscountAmount, globalDiscount)
  );

  const legacyTaxRate = data.taxRate || 0;
  const legacyTaxAmount = percentOfMoney(subtotal, legacyTaxRate);

  const finalTaxAmount =
    totalTaxAmount > 0 ? totalTaxAmount : roundMoney(legacyTaxAmount);
  const finalTotal =
    totalTaxAmount > 0
      ? total
      : subtractMoney(
          addMoney(subtotal, finalTaxAmount),
          addMoney(totalDiscountAmount, globalDiscount)
        );

  try {
    // Process payment method/allocations first to get paymentMethodInput
    let paymentAllocations = [];
    let paymentMethodInput = 'cash';

    if (data.paymentAllocations && Array.isArray(data.paymentAllocations) && data.paymentAllocations.length > 0) {
      // New format: split payments across multiple accounts
      paymentAllocations = data.paymentAllocations;

      // Validate allocations sum equals total
      const allocationsSum = paymentAllocations.reduce((sum, alloc) => addMoney(sum, alloc.amount), 0);
      if (Math.abs(allocationsSum - finalTotal) > 0.01) {
        throw serviceError(
          `Payment allocations sum (${allocationsSum}) does not match sale total (${finalTotal})`,
          { status: 400 }
        );
      }

      // Validate all payment accounts exist and are active
      for (const alloc of paymentAllocations) {
        if (!alloc.paymentAccountId || !alloc.amount) {
          throw serviceError('Each payment allocation must have paymentAccountId and amount', {
            status: 400,
          });
        }

        const account = await prisma.paymentAccount.findFirst({
          where: {
            id: alloc.paymentAccountId,
            tenantId: user.tenantId,
            isActive: true
          }
        });

        if (!account) {
          throw serviceError(`Payment account ${alloc.paymentAccountId} not found or inactive`, {
            status: 400,
          });
        }
      }

      // Get account name(s) from allocations for backward compatibility
      // For split payments, show all account names
      if (paymentAllocations.length > 1) {
        // Multiple allocations - get all account names
        const accountNames = await Promise.all(
          paymentAllocations.map(alloc =>
            prisma.paymentAccount.findUnique({
              where: { id: alloc.paymentAccountId },
              select: { name: true }
            })
          )
        );
        paymentMethodInput = accountNames
          .filter(acc => acc)
          .map((acc, idx) => `${acc.name} (${formatCurrency(paymentAllocations[idx].amount)})`)
          .join(', ') || 'Split Payment';
      } else {
        // Single allocation - use account name
        const firstAllocationAccount = await prisma.paymentAccount.findUnique({
          where: { id: paymentAllocations[0].paymentAccountId }
        });
        paymentMethodInput = firstAllocationAccount?.name || 'Cash';
      }
    } else {
      // Legacy format: single paymentMethod string (could be account ID or name)
      paymentMethodInput = data.paymentMethod;

      // Try to resolve payment account by ID first, then by name
      let paymentAccount = null;
      if (paymentMethodInput) {
        // First try as account ID (if it looks like an ID - long alphanumeric string)
        if (paymentMethodInput.length > 20 && /^[a-z0-9-]+$/i.test(paymentMethodInput)) {
          paymentAccount = await prisma.paymentAccount.findFirst({
            where: {
              id: paymentMethodInput,
              tenantId: user.tenantId,
              isActive: true
            }
          });
        }

        // If not found as ID, try as name
        if (!paymentAccount) {
          paymentAccount = await prisma.paymentAccount.findFirst({
            where: {
              name: { equals: paymentMethodInput, mode: 'insensitive' },
              tenantId: user.tenantId,
              isActive: true
            }
          });
        }
      }

      // If account found, create allocation with it
      if (paymentAccount) {
        paymentAllocations = [{ paymentAccountId: paymentAccount.id, amount: finalTotal }];
        paymentMethodInput = paymentAccount.name; // Use account name for backward compatibility
      } else {
        // No account found - fallback to Cash account
        const cashAccount = await prisma.paymentAccount.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true,
            accountType: 'Cash'
          }
        });

        if (cashAccount) {
          paymentAllocations = [{ paymentAccountId: cashAccount.id, amount: finalTotal }];
          paymentMethodInput = cashAccount.name;
        } else {
          // Last resort: get first active account
          const firstAccount = await prisma.paymentAccount.findFirst({
            where: {
              tenantId: user.tenantId,
              isActive: true
            },
            orderBy: {
              isSystem: 'desc'
            }
          });

          if (firstAccount) {
            paymentAllocations = [{ paymentAccountId: firstAccount.id, amount: finalTotal }];
            paymentMethodInput = firstAccount.name;
          } else {
            throw serviceError(
              'No payment accounts configured. Please create a payment account first.',
              { status: 400 }
            );
          }
        }
      }
    }

    const incomeAccountIds = data.items.map(item => item.accountId).filter(Boolean);
    if (incomeAccountIds.length !== data.items.length) {
      throw serviceError('Each sale item must reference a valid income account.', { status: 400 });
    }

    const incomeAccounts = await prisma.account.findMany({
      where: prismaWhereCoaIncomeAccounts(user.tenantId, {
        id: { in: incomeAccountIds },
      }),
      select: { id: true, accountType: true, type: true, accountName: true }
    });

    if (incomeAccounts.length !== new Set(incomeAccountIds).size) {
      const foundAccountIds = new Set(incomeAccounts.map(acc => acc.id));
      const missingAccountIds = incomeAccountIds.filter(id => !foundAccountIds.has(id));
      throw serviceError('Sale items must reference active income accounts.', {
        status: 400,
        details: `Missing or invalid account IDs: ${missingAccountIds.join(', ')}. Accounts must be active and of type Income or Revenue.`,
      });
    }

    // Pre-fetch payment accounts to avoid queries inside transaction
    const paymentAccountIds = paymentAllocations.map(alloc => alloc.paymentAccountId);
    const paymentAccountsMap = new Map();
    if (paymentAccountIds.length > 0) {
      const paymentAccounts = await prisma.paymentAccount.findMany({
        where: {
          id: { in: paymentAccountIds },
          tenantId: user.tenantId,
          isActive: true
        },
        select: { id: true, name: true }
      });
      paymentAccounts.forEach(acc => paymentAccountsMap.set(acc.id, acc));
    }

    // Pre-fetch Chart of Accounts account(s) for payment to avoid queries inside transaction
    let paymentCoAAccount = null;
    let paymentDebitLines = null; // For split payments: [{ accountId, amount }]
    const { getAccountForPaymentMethod } = await import('@/lib/paymentMethodAccountMapping');
    if (paymentAllocations.length > 1) {
      // Split payments: resolve each allocation to CoA account
      try {
        paymentDebitLines = await Promise.all(
          paymentAllocations.map(async (alloc) => {
            const coaAccount = await getAccountForPaymentMethod(user.tenantId, alloc.paymentAccountId);
            return { accountId: coaAccount.id, amount: Number(alloc.amount) };
          })
        );
      } catch (error) {
        console.warn('⚠️ Could not pre-fetch payment debit lines for split payments:', error.message);
      }
    } else if (paymentMethodInput) {
      try {
        paymentCoAAccount = await getAccountForPaymentMethod(user.tenantId, paymentMethodInput);
      } catch (error) {
        console.warn('⚠️ Could not pre-fetch payment CoA account, will try inside transaction:', error.message);
      }
    }

    // Pre-fetch standard accounts to avoid queries inside transaction
    const { getStandardAccounts } = await import('@/lib/transactionJournalHelpers');
    let standardAccounts = null;
    try {
      standardAccounts = await getStandardAccounts(user.tenantId, prisma);
    } catch (error) {
      console.warn('⚠️ Could not pre-fetch standard accounts, will try inside transaction:', error.message);
      // Continue - will try inside transaction as fallback
    }

    // Pre-generate reference numbers to avoid queries inside transaction
    const { generateReferenceNumber } = await import('@/lib/journalService');
    const paymentDate = data.historicalDate ? new Date(data.historicalDate) : (data.saleDate ? new Date(data.saleDate) : new Date());

    // Check accounting period lock BEFORE starting transaction (fail fast)
    const { assertPeriodOpen } = await import('@/lib/accountingPeriodService');
    try {
      await assertPeriodOpen(user.tenantId, paymentDate, prisma);
    } catch (error) {
      if (error.code === 'PERIOD_LOCKED') {
        throw serviceError(error.message || 'Cannot create sale in a locked accounting period.', {
          status: 400,
        });
      }
      // For other errors, log but continue (period check might not be configured)
      console.warn('⚠️ Period check failed, continuing:', error.message);
    }

    let referenceNumber = null;
    let cogsReferenceNumber = null;
    try {
      referenceNumber = await generateReferenceNumber(prisma, user.tenantId, paymentDate);
      // Pre-generate COGS reference number with a small delay to ensure uniqueness
      await new Promise(resolve => setTimeout(resolve, 10));
      cogsReferenceNumber = await generateReferenceNumber(prisma, user.tenantId, paymentDate);
    } catch (error) {
      console.warn('⚠️ Could not pre-generate reference numbers, will try inside transaction:', error.message);
      // Continue - will try inside transaction as fallback
    }

    let saleBranchId = null;
    try {
      saleBranchId = await resolveBranchId(user, data.branchId ?? null, user.tenantId);
    } catch (branchErr) {
      throw serviceError(branchErr.message || 'Branch not allowed', {
        status: 403,
        code: 'BRANCH_ACCESS_DENIED',
      });
    }

    // Create the sale in a transaction with increased timeout (30 seconds)
    const result = await prisma.$transaction(async (tx) => {
      // Determine the actual status (default to 'completed' if not specified)
      const saleStatus = data.status || 'completed';

      // First, check inventory if sale is being completed
      if (saleStatus === 'completed') {
        // Check if all non-custom products have sufficient stock
        for (const item of data.items) {
          // Skip custom products
          if (item.isCustom || !item.productId) {
            continue;
          }

          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: { productUnits: { include: { unit: true } } },
          });

          if (!product) {
            throw new Error(`Product with ID ${item.productId} not found`);
          }

          if (product.isService) {
            continue;
          }

          const baseQtyRequested = resolveSaleItemBaseQuantity(item, product);

          // Skip check if stockLevel is null (unlimited)
          if (product.stockLevel !== null && Number(product.stockLevel) < baseQtyRequested) {
            throw new Error(
              `Insufficient stock for "${product.name}". Available: ${product.stockLevel}, Requested (base qty): ${baseQtyRequested}`
            );
          }
        }
      }

      const branchId = saleBranchId;

      // Resolve the effective sale date: historical transactions use their
      // business date; regular sales use saleDate from payload or now.
      const effectiveSaleDate = (data.isHistorical && data.historicalDate)
        ? new Date(data.historicalDate)
        : (data.saleDate ? new Date(data.saleDate) : new Date());

      const dateStrForSaleNumber = saleNumberDatePrefixFromDate(effectiveSaleDate);
      let saleNumber;
      if (typeof providedSaleNumber === 'string' && providedSaleNumber.trim() !== '') {
        // Offline till already reserved this number in its own prefix range.
        saleNumber = providedSaleNumber.trim();
        const snDup = await tx.sale.findFirst({
          where: { tenantId: user.tenantId, saleNumber },
          select: { id: true },
        });
        if (snDup) {
          throw new Error(`Sale number ${saleNumber} already exists`);
        }
      } else {
        let saleNumberOk = false;
        for (let snAttempt = 0; snAttempt < 50; snAttempt += 1) {
          const seq = await allocateNextSaleNumberReliable(tx, user.tenantId);
          saleNumber = `SALE-${dateStrForSaleNumber}-${String(seq).padStart(3, '0')}`;
          const snDup = await tx.sale.findFirst({
            where: { tenantId: user.tenantId, saleNumber },
            select: { id: true },
          });
          if (!snDup) {
            saleNumberOk = true;
            break;
          }
        }
        if (!saleNumberOk) {
          throw new Error('Could not allocate a unique sale number');
        }
      }

      const posTenderedNum =
        data.posAmountTendered != null &&
        data.posAmountTendered !== '' &&
        !Number.isNaN(Number(data.posAmountTendered))
          ? roundMoney(data.posAmountTendered)
          : null;
      const posChangeNum =
        data.posChangeGiven != null &&
        data.posChangeGiven !== '' &&
        !Number.isNaN(Number(data.posChangeGiven))
          ? roundMoney(data.posChangeGiven)
          : null;
      // Only pass POS tender fields when set — omitting avoids "Unknown argument"
      // if deploy has not run migration `20260405140000_sale_pos_tender_change` + prisma generate.
      const posTenderPayload =
        posTenderedNum != null || posChangeNum != null
          ? {
              ...(posTenderedNum != null ? { posAmountTendered: posTenderedNum } : {}),
              ...(posChangeNum != null ? { posChangeGiven: posChangeNum } : {}),
            }
          : {};

      // Create the sale with enhanced fields
      const sale = await tx.sale.create({
        data: {
          saleNumber,
          title: data.title || null,
          orderNumber: data.orderNumber || null,
          saleDate: effectiveSaleDate,
          subtotal,
          // Enhanced: Store individual tax amounts
          totalTaxAmount: finalTaxAmount,
          totalDiscountAmount: addMoney(totalDiscountAmount, globalDiscount),
          total: finalTotal,
          status: saleStatus,
          paymentMethod: paymentMethodInput,
          notes: data.notes,
          ...posTenderPayload,
          // Backward compatibility: keep legacy taxRate and taxAmount
          taxRate: legacyTaxRate,
          taxAmount: finalTaxAmount,
          // Historical transaction fields
          isHistorical: data.isHistorical || false,
          historicalDate: data.isHistorical && data.historicalDate ? new Date(data.historicalDate) : null,
          migrationBatch: data.migrationBatch || null,
          originalReference: data.originalReference || null,
          // Connect to branch if provided
          ...(branchId ? {
            branch: {
              connect: { id: branchId }
            }
          } : {}),
          // Connect to client if provided
          ...(data.clientId ? {
            client: {
              connect: { id: data.clientId }
            }
          } : {}),
          // Connect to user & tenant
          createdBy: {
            connect: { id: user.id }
          },
          tenant: {
            connect: { id: user.tenantId }
          }
        }
      });

      // Create sale items with enhanced fields
      const items = await Promise.all(
        data.items.map(async (item, index) => {
          let saleQuantity = Number(item.quantity) || 0;
          let saleUnitPrice = Number(item.unitPrice) || 0;
          let amount = computedLineAmounts[index]?.subtotal ?? multiplyMoney(saleQuantity, saleUnitPrice);

          if (!item.isCustom && item.productId) {
            const productForLine = await tx.product.findUnique({
              where: { id: item.productId },
              include: { productUnits: { include: { unit: true } } },
            });
            if (!productForLine) {
              throw new Error(`Product with ID ${item.productId} not found`);
            }
            saleQuantity = resolveSaleItemBaseQuantity(item, productForLine);
            const grossLine = resolveSaleLineAmount(item, productForLine, saleQuantity);
            amount = roundMoney(grossLine);
            if (saleQuantity > 0) {
              saleUnitPrice = roundMoney(amount / saleQuantity);
            }
          }
          const computedTaxAmount = computedLineAmounts[index]?.taxAmount ?? roundMoney(item.taxAmount || 0);
          const computedDiscountAmount = computedLineAmounts[index]?.discountAmount ?? roundMoney(item.discountAmount || 0);

          // Base fields for sale item (no account yet - try both shapes for Prisma client compatibility)
          const baseSaleItemData = {
            sale: { connect: { id: sale.id } },
            description: item.description,
            quantity: saleQuantity,
            unitPrice: saleUnitPrice,
            amount: amount,
            taxRate: roundMoney(item.taxRate || 0),
            taxAmount: computedTaxAmount,
            taxDescription: item.taxDescription || null,
            discount: roundMoney(item.discount || 0),
            discountAmount: computedDiscountAmount,
            isCustom: item.isCustom || false,
            customProductData: item.customProductData || null
          };
          if (!item.isCustom && item.productId) {
            baseSaleItemData.product = { connect: { id: item.productId } };
          }

          // Try accountId first (some Prisma clients only accept scalar); then account connect (others only relation)
          let saleItem;
          const withAccountId = { ...baseSaleItemData, accountId: item.accountId || null };
          const withAccountConnect = item.accountId
            ? { ...baseSaleItemData, account: { connect: { id: item.accountId } } }
            : baseSaleItemData;

          try {
            saleItem = await tx.saleItem.create({ data: withAccountId });
          } catch (firstError) {
            const msg = firstError?.message || '';
            if (msg.includes('Unknown argument `accountId`') || msg.includes('Unknown column') || firstError?.code === 'P2009') {
              try {
                saleItem = await tx.saleItem.create({ data: withAccountConnect });
              } catch (secondError) {
                console.error('❌ SaleItem creation failed (both accountId and account connect):', secondError?.message);
                throw new Error(
                  'Account validation failed. Please ensure all sale items have valid income accounts from Chart of Accounts. ' +
                  'If the error persists, run: node scripts/run-accountid-migration.js then npx prisma generate and restart the app.'
                );
              }
            } else if (firstError?.code === 'P2003') {
              throw new Error(
                `Invalid accountId: ${item.accountId}. The account does not exist in Chart of Accounts. Please ensure the account exists and is active.`
              );
            } else {
              console.error('❌ SaleItem creation failed:', firstError?.message);
              throw firstError;
            }
          }

          // Create individual tax records from taxBreakdown, or fallback from item taxAmount
          const itemTaxAmount = computedTaxAmount;
          const itemTaxRate = roundMoney(item.taxRate || 0);
          try {
            if (item.taxBreakdown && Array.isArray(item.taxBreakdown) && item.taxBreakdown.length > 0) {
              const creates = [];
              for (const tax of item.taxBreakdown) {
                const taxTypeId = (tax.taxTypeId || tax.id || '').toString().trim();
                const taxAmt = roundMoney(tax.taxAmount);
                if (!taxTypeId || !(taxAmt > 0)) continue;
                const taxCode = (tax.taxCode != null && String(tax.taxCode).trim() !== '') ? String(tax.taxCode) : '';
                creates.push(
                  tx.saleItemTax.create({
                    data: {
                      saleItemId: saleItem.id,
                      taxTypeId,
                      taxName: tax.taxName || 'Tax',
                      taxCode,
                      taxRate: roundMoney(tax.taxRate || 0),
                      taxAmount: taxAmt
                    }
                  })
                );
              }
              if (creates.length > 0) await Promise.all(creates);
            } else if (itemTaxAmount > 0) {
              // Fallback: item has tax but no taxBreakdown — match tax type by rate when possible
              const activeTaxTypes = await tx.taxType.findMany({
                where: { tenantId: user.tenantId, status: 'Active' },
                orderBy: { taxRate: 'desc' }
              });
              let chosenTaxType = null;
              if (itemTaxRate > 0 && activeTaxTypes.length > 0) {
                chosenTaxType = activeTaxTypes.find(t => Math.abs(Number(t.taxRate) - itemTaxRate) < 0.01) || activeTaxTypes[0];
              } else if (activeTaxTypes.length > 0) {
                chosenTaxType = activeTaxTypes[0];
              }
              if (chosenTaxType) {
                const taxCode = (chosenTaxType.taxCode != null && String(chosenTaxType.taxCode).trim() !== '') ? String(chosenTaxType.taxCode) : '';
                await tx.saleItemTax.create({
                  data: {
                    saleItemId: saleItem.id,
                    taxTypeId: chosenTaxType.id,
                    taxName: chosenTaxType.taxName,
                    taxCode,
                    taxRate: roundMoney(chosenTaxType.taxRate || 0),
                    taxAmount: itemTaxAmount
                  }
                });
              }
            }
          } catch (error) {
            // If table doesn't exist, log warning but don't fail the sale
            if (error.message?.includes('does not exist') || error.message?.includes('Unknown model')) {
              console.warn('SaleItemTax table does not exist. Run migration to enable detailed tax tracking.');
            } else {
              throw error;
            }
          }

          return saleItem;
        })
      );

      // Update inventory if status is completed
      if (saleStatus === 'completed') {
        await Promise.all(
          data.items
            .filter(item => !item.isCustom && item.productId) // Only non-custom products
            .map(async (item) => {
              const productForStock = await tx.product.findUnique({
                where: { id: item.productId },
                include: { productUnits: { include: { unit: true } } },
              });
              if (!productForStock) {
                throw new Error(`Product with ID ${item.productId} not found`);
              }
              if (productForStock.isService) {
                return null;
              }
              const baseQty = resolveSaleItemBaseQuantity(item, productForStock);

              await tx.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  type: 'sale',
                  quantity: -baseQty,
                  notes: `Sale ${saleNumber}`,
                  userId: user.id,
                  tenantId: user.tenantId
                }
              });

              return tx.product.update({
                where: { id: item.productId },
                data: {
                  stockLevel: { decrement: baseQty }
                }
              });
            })
        );

        // 🔐 Create payment record for completed sale
        // Use sale date for paymentDate (historicalDate if set, otherwise saleDate)
        // This ensures historical sales are recorded with their actual sale date
        const paymentDate = sale.historicalDate || sale.saleDate;

        // paymentAllocations and paymentMethodInput are already set before the transaction
        // Just use them here to create the payment record

        let newPayment;
        try {
          newPayment = await tx.payment.create({
            data: {
              saleId: sale.id,
              amount: finalTotal,
              paymentDate: paymentDate,
              paymentMethod: paymentMethodInput, // Keep for backward compatibility
              reference: `Sale ${saleNumber}`,
              notes: data.notes || `Payment for sale ${saleNumber}`,
              status: 'Completed',
              tenantId: user.tenantId,
              type: 'sale',
              sourceAccount: paymentMethodInput,
              allocations: {
                create: paymentAllocations.map(alloc => ({
                  paymentAccountId: alloc.paymentAccountId,
                  amount: alloc.amount
                }))
              }
            }
          });
        } catch (paymentError) {
          console.error('❌ Payment creation failed:', {
            message: paymentError.message,
            code: paymentError.code,
            meta: paymentError.meta,
            saleId: sale.id,
            paymentAllocations: paymentAllocations
          });
          // Check if transaction is aborted
          if (paymentError.message?.includes('transaction is aborted') ||
              paymentError.message?.includes('25P02') ||
              paymentError.code === 'P2034') {
            throw new Error(
              'Transaction was aborted. This usually means an error occurred earlier in the sale creation process. ' +
              `Payment creation error: ${paymentError.message}`
            );
          }
          throw paymentError;
        }

        // Create journal entries for sale (Revenue + COGS)
        // Account balances are updated automatically via postGlEntry
        try {
          // Calculate total COGS for all inventory items
          // Use the created 'items' array (with database IDs) instead of 'data.items'
          let totalCOGS = 0;

          // Match data.items with created items by index (they should be in the same order)
          for (let i = 0; i < data.items.length; i++) {
            const dataItem = data.items[i];
            const saleItem = items[i];

            if (!saleItem) {
              console.warn(`SaleItem not found at index ${i}`);
              continue;
            }

            if (dataItem.productId && !dataItem.isCustom) {
              try {
                // Check if product is a service (services don't have COGS)
                const product = await tx.product.findUnique({
                  where: { id: dataItem.productId },
                  select: {
                    id: true,
                    isService: true,
                    name: true,
                    stockLevel: true,
                    branchId: true
                  }
                });

                // Only calculate COGS for non-service products
                if (product && !product.isService) {
                  const productWithUnitsForFifo = await tx.product.findUnique({
                    where: { id: dataItem.productId },
                    include: { productUnits: { include: { unit: true } } },
                  });
                  const qtyForFifo = resolveSaleItemBaseQuantity(dataItem, productWithUnitsForFifo);

                  // Get product cost at time of sale (to store for fallback if FIFO fails)
                  const productAtSaleTime = await tx.product.findUnique({
                    where: { id: dataItem.productId },
                    select: { cost: true }
                  });
                  const productCostAtSale = productAtSaleTime?.cost ? Number(productAtSaleTime.cost) : 0;

                  // Try FIFO consumption - it will handle branch fallback internally
                  let itemCOGS = 0;
                  try {
                    const fifo = await consumeFifoForSale({
                      tenantId: user.tenantId,
                      // IMPORTANT: batches are created with the product's branchId (when branch-scoped),
                      // so prefer product.branchId for FIFO matching. Using sale.branchId first can cause
                      // "no batches found" and silently fall back to productCostAtSale.
                      branchId: product.branchId || sale.branchId || null,
                      productId: dataItem.productId,
                      quantitySold: qtyForFifo,
                      saleId: sale.id,
                      saleItemId: saleItem.id, // Use the actual database ID from created sale item
                      tx,
                    });

                    // Persist read-only COGS details on the SaleItem payload (system-only)
                    // Uses existing JSON field to avoid schema changes on SaleItem.
                    // Ensure cogsAmount is stored as a plain number (not Decimal)
                    const cogsAmountValue = typeof fifo.cogsAmount === 'object' && fifo.cogsAmount?.toNumber
                      ? fifo.cogsAmount.toNumber()
                      : Number(fifo.cogsAmount);

                    itemCOGS = cogsAmountValue;

                    await tx.saleItem.update({
                      where: { id: saleItem.id },
                      data: {
                        customProductData: {
                          ...(saleItem.customProductData || {}),
                          fifoCogs: {
                            cogsAmount: cogsAmountValue,
                            allocations: fifo.allocations.map(alloc => ({
                              batchId: alloc.batchId,
                              quantity: typeof alloc.quantity === 'object' && alloc.quantity?.toNumber
                                ? alloc.quantity.toNumber()
                                : Number(alloc.quantity),
                              unitCost: typeof alloc.unitCost === 'object' && alloc.unitCost?.toNumber
                                ? alloc.unitCost.toNumber()
                                : Number(alloc.unitCost),
                              cogsAmount: typeof alloc.cogsAmount === 'object' && alloc.cogsAmount?.toNumber
                                ? alloc.cogsAmount.toNumber()
                                : Number(alloc.cogsAmount),
                            })),
                          },
                          // Store product cost at time of sale for fallback
                          productCostAtSale: productCostAtSale,
                        },
                      },
                    });
                  } catch (fifoError) {
                    if (
                      fifoError?.message &&
                      (fifoError.message.includes('Expired stock') ||
                        fifoError.message.includes('write off before issuing'))
                    ) {
                      throw fifoError;
                    }
                    console.error(`[FIFO Sale] ❌ Error calculating FIFO COGS for product ${dataItem.productId}:`, fifoError);

                    // FIFO failed - use product cost at sale time as fallback
                    itemCOGS = qtyForFifo * productCostAtSale;
                    console.warn(`[FIFO Sale] ⚠️ Using product cost at sale time as fallback: ${productCostAtSale} × ${qtyForFifo} = ${itemCOGS}`);

                    // Store product cost at sale time for fallback calculation
                    await tx.saleItem.update({
                      where: { id: saleItem.id },
                      data: {
                        customProductData: {
                          ...(saleItem.customProductData || {}),
                          productCostAtSale: productCostAtSale,
                        },
                      },
                    });
                  }

                  // Add to total COGS (either from FIFO or fallback)
                  totalCOGS = addMoney(totalCOGS, itemCOGS);
                }
              } catch (cogsError) {
                console.error(`❌ Error in COGS calculation block for product ${dataItem.productId}:`, cogsError);
                // Continue with other items
              }
            } else if (dataItem.isCustom) {
              // Do not trust client-supplied cost/orderPrice for COGS — that lets a POS
              // client inflate inventory credits. Custom/service lines have no stock cost.
            }
          }

          // V2 accounting: revenue (+ tax via taxAmount) and COGS via adapters — fail closed
          try {
            await postPosSaleAccounting({
              db: tx,
              tenantId: user.tenantId,
              userId: user.id,
              saleId: sale.id,
              saleNumber,
              saleDate: paymentDate,
              totalAmount: finalTotal,
              paymentMethod: paymentMethodInput,
              // Resolve cash CoA from PaymentAccount.id (name strings break leaf linking).
              paymentAccountId: paymentAllocations?.[0]?.paymentAccountId || null,
              taxAmount: finalTaxAmount,
              branchId: branchId || null,
            });
            if (totalCOGS > 0) {
              await postCostOfSalesAccounting({
                db: tx,
                tenantId: user.tenantId,
                userId: user.id,
                documentKind: 'Sale',
                documentId: sale.id,
                documentNumber: saleNumber,
                documentDate: paymentDate,
                cogsAmount: totalCOGS,
                branchId: branchId || null,
              });
            }
          } catch (journalError) {
            if (journalError.message?.includes('transaction is aborted') ||
                journalError.message?.includes('25P02') ||
                journalError.code === 'P2034') {
              console.error('❌ Transaction was aborted before journal entry creation. Original error may be above.');
              throw new Error(
                'Transaction failed. This usually means an error occurred earlier in the sale creation process. ' +
                'Please check the server logs for the original error. ' +
                `Journal entry error: ${journalError.message}`
              );
            }
            throw journalError;
          }
        } catch (journalError) {
          console.error('❌ Error creating journal entries for sale:', journalError);
          throw journalError;
        }
      }

      // Create sale state history record
      try {
        await tx.saleStateHistory.create({
          data: {
            saleId: sale.id,
            fromStatus: 'draft',
            toStatus: saleStatus,
            reason: saleStatus === 'draft' ? 'Sale saved as draft' : 'Sale completed',
            changedById: user.id
          }
        });
      } catch (historyError) {
        console.log('SaleStateHistory table not available, skipping history record');
        // Continue without failing the transaction
      }

      // Create audit log with historical transaction details
      await tx.auditLog.create({
        data: {
          action: data.isHistorical ? 'HISTORICAL_SALE_CREATED' : 'SALE_CREATED',
          entityType: 'SALE',
          entityId: sale.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            saleNumber: sale.saleNumber,
            total: sale.total,
            status: sale.status,
            items: data.items.length,
            customItems: data.items.filter(item => item.isCustom).length,
            isHistorical: data.isHistorical || false,
            historicalDate: data.historicalDate || null,
            migrationBatch: data.migrationBatch || null,
            originalReference: data.originalReference || null
          })
        }
      });

      return { sale, items };
    }, {
      maxWait: 30000, // Maximum time to wait for a transaction slot (30 seconds)
      timeout: 30000, // Maximum time the transaction can run (30 seconds)
    });

    // Fetch the sale with payments and allocations for the response
    const saleWithPayments = await prisma.sale.findUnique({
      where: { id: result.sale.id },
      include: {
        payments: {
          include: {
            allocations: {
              include: {
                paymentAccount: {
                  select: {
                    id: true,
                    name: true,
                    accountType: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    // Product Analytics (Phase 9): POS completed meaningful action (fire-and-forget)
    if (String(result.sale.status).toLowerCase() === 'completed') {
      try {
        await emitPosTransactionCompleted(prisma, {
          tenantId: user.tenantId,
          saleId: result.sale.id,
          actorId: user.id,
          status: result.sale.status,
          occurredAt: result.sale.createdAt || new Date(),
          branchId: result.sale.branchId || null,
        });
      } catch (analyticsErr) {
        console.warn('[productAnalytics] POS completed emit failed:', analyticsErr?.message);
      }
    }

    // MRA EIS: auto-submit sale to MRA for EIS-enabled tenants (fire-and-forget)
    let eisResult = null;
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { eisEnabled: true } });
      if (tenant?.eisEnabled) {
        const eisAccess = await hasEISAccess(user.tenantId);
        if (eisAccess) {
          eisResult = await eisService.submitInvoice(user.tenantId, {
            invoiceNumber: result.sale.saleNumber,
            invoiceDate: result.sale.saleDate,
            customerName: data.clientName || 'Walk-in Customer',
            customerTPIN: data.customerTPIN || '',
            items: result.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0
            })),
            subtotal: Number(result.sale.subtotal),
            taxTotal: Number(result.sale.totalTaxAmount || result.sale.taxAmount || 0),
            total: Number(result.sale.total),
            paymentMethod: paymentMethodInput || 'Cash',
            isReliefSupply: data.isReliefSupply || false,
            vat5CertificateNumber: data.vat5CertificateNumber || null,
          }, 'sale', result.sale.id);
        }
      }
    } catch (eisErr) {
      console.error('⚠️ EIS submission failed (sale still saved):', eisErr.message);
    }

    return {
      id: result.sale.id,
      saleNumber: result.sale.saleNumber,
      date: result.sale.saleDate.toISOString().split('T')[0],
      // Numeric amounts for clients (POS modal, print, etc.); avoid formatted "MK …" here — Number() would be NaN
      subtotal: toSaleNumber(result.sale.subtotal),
      totalTaxAmount: toSaleNumber(result.sale.totalTaxAmount || 0),
      totalDiscountAmount: toSaleNumber(result.sale.totalDiscountAmount || 0),
      tax: toSaleNumber(result.sale.totalTaxAmount || result.sale.taxAmount),
      total: toSaleNumber(result.sale.total),
      status: result.sale.status,
      paymentMethod: paymentMethodInput, // Use paymentMethodInput set before transaction
      payments: serializePaymentsForClient(saleWithPayments?.payments || []),
      itemCount: result.items.length,
      customItemCount: data.items.filter(item => item.isCustom).length,
      eis: eisResult ? { submissionId: eisResult.submissionId, status: eisResult.status } : null,
      posAmountTendered:
        result.sale.posAmountTendered != null && result.sale.posAmountTendered !== ''
          ? toSaleNumber(result.sale.posAmountTendered)
          : null,
      posChangeGiven:
        result.sale.posChangeGiven != null && result.sale.posChangeGiven !== ''
          ? toSaleNumber(result.sale.posChangeGiven)
          : null,
    };
  } catch (error) {
    if (error?.name === 'ServiceHttpError') throw error;
    // Handle inventory or database errors
    if (error.message?.includes('Insufficient stock')) {
      throw serviceError(error.message, { status: 400 });
    }
    if (error.message?.includes('not found')) {
      throw serviceError(error.message, { status: 400 });
    }
    console.error('Transaction error:', error);
    throw error; // Re-throw for general error handling
  }
}
