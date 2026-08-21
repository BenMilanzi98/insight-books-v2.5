// lib/invoices/createInvoice.js
// Extracted from the POST body of app/api/invoices/route.js so the route and the
// desktop outbox create invoices through one revenue/COGS posting path.
import prisma from '@/lib/prisma';
import { ensureInvoiceSalesAccounting } from '@/lib/ensureInvoiceSalesAccounting';
import { resolveBranchId } from '@/lib/branchHelpers';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { prismaWhereCoaIncomeAccounts } from '@/lib/coaIncomeAccounts';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';
import { parseMoney } from '@/lib/money';
import { emitSalesInvoicePosted } from '@/lib/admin/productAnalytics/producers';
import {
  requireInvoiceItemAccountIdColumn,
  buildInvoiceItemCreateData,
} from '@/lib/ensureInvoiceItemAccountId';
import {
  assertActiveTaxTypeIds,
  collectTaxTypeIdsFromItems,
} from '@/lib/taxManagement/assertActiveTaxTypes';
import { serviceError } from '@/lib/serviceErrors';

/**
 * Create an invoice with items, revenue/COGS recognition and audit trail.
 *
 * @param {object} args
 * @param {object} args.user Authenticated session user.
 * @param {object} args.body Invoice payload (the former request JSON).
 * @param {string} [args.invoiceNumber] Offline-allocated number; skips cloud allocation.
 * @returns {Promise<object>} API-shaped invoice (contains `id`).
 */
export async function createInvoice({ user, body, invoiceNumber: providedInvoiceNumber = null }) {
  if (!user?.tenantId) {
    throw serviceError('Tenant context required', { status: 400 });
  }

  const columnCheck = await requireInvoiceItemAccountIdColumn();
  if (!columnCheck.ok) {
    throw serviceError(
      'Invoice items are missing the accountId column. Run the pending migration.',
      { status: 503, code: 'P2022' }
    );
  }
  const invoiceItemHasAccountId = columnCheck.hasColumn;

  // Validate required fields
  if (!body.clientId || !body.items || body.items.length === 0) {
    throw serviceError('Client and at least one item are required', { status: 400 });
  }

  // Auto-assign revenue GL: services → 4150, products → 4100 (no tenant picker).
  const { applyAutomaticSaleRevenueAccounts } = await import('@/lib/coaIncomeAccounts');
  await applyAutomaticSaleRevenueAccounts(prisma, user.tenantId, body.items);

  // Enhanced validation for each item
  for (const item of body.items) {
    if (!item.description || item.quantity <= 0 || item.unitPrice < 0) {
      throw serviceError('All items must have valid description, quantity, and Selling Price', {
        status: 400,
      });
    }

    if (!item.accountId) {
      throw serviceError(
        'Could not resolve income accounts. Ensure Chart of Accounts has 4100 Product Sales and 4150 Service Revenue.',
        { status: 400 }
      );
    }

    // Validate per-item discount amount (should be non-negative and not exceed Selling Price)
    if (item.discountAmount && item.discountAmount < 0) {
      throw serviceError('Discount amount must be positive', { status: 400 });
    }

    if (item.discountAmount && item.discountAmount > item.unitPrice) {
      throw serviceError('Per-item discount cannot exceed Selling Price', { status: 400 });
    }

    // Validate tax rate
    if (item.taxRate && (item.taxRate < 0 || item.taxRate > 100)) {
      throw serviceError('Tax rate must be between 0 and 100%', { status: 400 });
    }
  }

  try {
    await assertActiveTaxTypeIds(
      prisma,
      user.tenantId,
      collectTaxTypeIdsFromItems(body.items)
    );
  } catch (e) {
    if (e?.status === 400 || e?.code === 'INACTIVE_TAX' || e?.code === 'UNKNOWN_TAX') {
      throw serviceError(e.message, { status: 400, code: e.code });
    }
    throw e;
  }

  const incomeAccountIds = body.items.map(item => item.accountId).filter(Boolean);
  const incomeAccounts = await prisma.account.findMany({
    where: prismaWhereCoaIncomeAccounts(user.tenantId, {
      id: { in: incomeAccountIds },
    }),
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      acceptsNewTransactions: true,
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
  });

  if (incomeAccounts.length !== new Set(incomeAccountIds).size) {
    throw serviceError('Invoice items must reference active income accounts.', { status: 400 });
  }

  for (const acc of incomeAccounts) {
    const block = accountBlocksDirectPosting(acc);
    if (block.blocked) {
      const label = acc.accountName || acc.accountCode || acc.id;
      throw serviceError(
        `Cannot post invoice revenue to "${label}". ${block.reason} Use a detail account such as 4100 Product Sales.`,
        { status: 400 }
      );
    }
  }

  if (typeof providedInvoiceNumber === 'string' && providedInvoiceNumber.trim() !== '') {
    const offlineInvoiceNumber = providedInvoiceNumber.trim();
    const duplicate = await prisma.invoice.findFirst({
      where: { tenantId: user.tenantId, invoiceNumber: offlineInvoiceNumber },
      select: { id: true },
    });
    if (duplicate) {
      throw serviceError(`Invoice number ${offlineInvoiceNumber} already exists`, { status: 409 });
    }
  }

  // Enhanced calculation using the new function
  const calculations = calculateInvoiceTotals(body.items, body.discount || 0);

  // Get tenant settings for invoice prefix (optional; avoid 500 if TenantSettings has missing columns e.g. after restore)
  let tenantSettings = null;
  try {
    tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: user.tenantId }
    });
  } catch (_) {
    // use default prefix below
  }
  const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';

  const invoiceStatus = body.status || 'Draft';
  const issueDate = new Date(body.issueDate || new Date());
  const dueDate =
    body.dueDate != null && body.dueDate !== ''
      ? new Date(body.dueDate)
      : (() => {
          const d = new Date(issueDate);
          d.setDate(d.getDate() + 30);
          return d;
        })();

  let branchId;
  try {
    branchId = await resolveBranchId(user, body.branchId, user.tenantId);
  } catch (branchErr) {
    throw serviceError(branchErr.message || 'Invalid branch', { status: 403 });
  }

  // Create the invoice with items in a transaction (extended timeout for COGS + GL posting)
  const result = await prisma.$transaction(async (tx) => {
    let invoiceNumber;
    if (typeof providedInvoiceNumber === 'string' && providedInvoiceNumber.trim() !== '') {
      // Offline till already reserved this number in its own prefix range.
      invoiceNumber = providedInvoiceNumber.trim();
    } else {
      const seq = await allocateNextInvNumberReliable(tx, user.tenantId, {
        prefix: invoicePrefix,
        issueDate,
      });
      invoiceNumber = formatDatedDocumentNumber(invoicePrefix, issueDate, seq);
    }

    // Check products to determine if invoice has services
    let productNameById = {};
    if (calculations.processedItems.some(item => item.productId)) {
      const productIds = calculations.processedItems
        .filter(item => item.productId)
        .map(item => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId: user.tenantId },
        select: { id: true, isService: true, name: true }
      });
      productNameById = Object.fromEntries(products.map(p => [p.id, p.name]));
    }

    // Ensure every line has a clear title (item/service description)
    const itemsWithTitles = calculations.processedItems.map(item => {
      const desc = (item.description && String(item.description).trim()) || productNameById[item.productId] || 'Item';
      return { ...item, description: desc };
    });

    // Create the invoice with items
    const newInvoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        title: body.title || null,
        orderNumber: body.orderNumber || null,
        clientId: body.clientId,
        createdById: user.id,
        issueDate,
        dueDate,
        discount: body.discount || 0, // Legacy global discount
        subtotal: calculations.subtotal,
        taxAmount: calculations.taxAmount,
        totalDiscountAmount: calculations.totalDiscountAmount, // Enhanced: Total of all line item discounts
        total: calculations.total,
        // Cash-basis: unpaid until payments land (schema defaults remainingBalance to 0).
        totalPaid: 0,
        remainingBalance: calculations.total,
        status: invoiceStatus,
        notes: body.notes,
        tenantId: user.tenantId,
        branchId: branchId,
        footerPhoneOverride: body.footerPhoneOverride || null,
        footerBankDetailsOverride: body.footerBankDetailsOverride || null,
        templateId: body.templateId || null,
        items: {
          create: itemsWithTitles.map((item) =>
            buildInvoiceItemCreateData(item, invoiceItemHasAccountId),
          ),
        },
      },
      include: {
        client: true,
        createdBy: { // Include user info for "Prepared By"
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: { include: { itemTaxes: true } },
      }
    });

    // Recognize revenue + COGS when invoice is not a draft
    if (invoiceStatus !== 'Draft' && String(invoiceStatus).toUpperCase() !== 'PROFORMA') {
      try {
        await ensureInvoiceSalesAccounting({
          db: tx,
          tenantId: user.tenantId,
          userId: user.id,
          invoiceId: newInvoice.id,
        });
      } catch (journalError) {
        console.error('Error creating journal entry for invoice:', journalError);
        throw journalError;
      }
    }

    // Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'INVOICE_CREATED',
        entityType: 'INVOICE',
        entityId: newInvoice.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          invoiceNumber,
          client: newInvoice.client.name,
          amount: newInvoice.total
        })
      }
    });

    return newInvoice;
  }, { maxWait: 15000, timeout: 120000 });

  const newInvoice = result;

  // Format the response
  const formattedInvoice = {
    id: newInvoice.id,
    invoiceNumber: newInvoice.invoiceNumber,
    clientId: newInvoice.clientId,
    client: newInvoice.client,
    preparedBy: newInvoice.createdBy?.name || 'N/A', // Include prepared by info
    preparedById: newInvoice.createdBy?.id || null,
    createdBy: newInvoice.createdBy, // Include full createdBy object
    createdAt: newInvoice.createdAt, // Include creation timestamp
    issueDate: newInvoice.issueDate,
    dueDate: newInvoice.dueDate,
    discount: newInvoice.discount,
    subtotal: newInvoice.subtotal,
    taxAmount: newInvoice.taxAmount,
    totalDiscountAmount: newInvoice.totalDiscountAmount,
    total: newInvoice.total,
    status: newInvoice.status,
    notes: newInvoice.notes,
    items: newInvoice.items,
    updatedAt: newInvoice.updatedAt
  };

  // Product Analytics (Phase 9): posted invoice meaningful action (fire-and-forget)
  if (
    newInvoice.status !== 'Draft' &&
    String(newInvoice.status).toUpperCase() !== 'PROFORMA'
  ) {
    try {
      await emitSalesInvoicePosted(prisma, {
        tenantId: user.tenantId,
        invoiceId: newInvoice.id,
        actorId: user.id,
        status: newInvoice.status,
        occurredAt: newInvoice.createdAt || new Date(),
        branchId: newInvoice.branchId || null,
      });
    } catch (analyticsErr) {
      console.warn('[productAnalytics] invoice posted emit failed:', analyticsErr?.message);
    }
  }

  // MRA EIS: auto-submit invoice to MRA for EIS-enabled tenants (fire-and-forget)
  let eisResult = null;
  if (newInvoice.status !== 'Draft') {
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { eisEnabled: true } });
      if (tenant?.eisEnabled) {
        const eisAccess = await hasEISAccess(user.tenantId);
        if (eisAccess) {
          eisResult = await eisService.submitInvoice(user.tenantId, {
            invoiceNumber: newInvoice.invoiceNumber,
            invoiceDate: newInvoice.issueDate,
            customerName: newInvoice.client?.name || '',
            customerTPIN: '',
            items: (newInvoice.items || []).map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0
            })),
            subtotal: parseMoney(newInvoice.subtotal),
            taxTotal: parseMoney(newInvoice.taxAmount),
            total: parseMoney(newInvoice.total),
            paymentMethod: 'Bank Transfer'
          }, 'invoice', newInvoice.id);
        }
      }
    } catch (eisErr) {
      console.error('⚠️ EIS invoice submission failed (invoice still saved):', eisErr.message);
    }
  }

  formattedInvoice.eis = eisResult
    ? { submissionId: eisResult.submissionId, status: eisResult.status }
    : null;

  return formattedInvoice;
}
