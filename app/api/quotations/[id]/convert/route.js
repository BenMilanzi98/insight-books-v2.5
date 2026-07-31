// app/api/quotations/[id]/convert/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { bridgeSalesInvoiceAfterCommit } from '@/lib/mraEis/application/eligibility/finalizationIntegration.js';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { postInvoiceAccounting } from '@/lib/accountingV2/adapters';
import { findDefaultInvoiceRevenueAccount } from '@/lib/coaPostingCodes';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility';
import { resolveBranchId } from '@/lib/branchHelpers';
import { classifyApiError } from '@/lib/apiErrorUtils';
import {
  requireInvoiceItemAccountIdColumn,
  buildInvoiceItemCreateData,
} from '@/lib/ensureInvoiceItemAccountId';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';

// POST - Convert a quotation to an invoice
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: quotationId } = await params;

    const columnCheck = await requireInvoiceItemAccountIdColumn();
    if (!columnCheck.ok) return columnCheck.response;
    const invoiceItemHasAccountId = columnCheck.hasColumn;

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, tenantId: user.tenantId },
      include: { client: true, items: { include: { itemTaxes: true } } },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    if (quotation.status === 'Converted') {
      return NextResponse.json(
        { error: 'This quotation has already been converted to an invoice' },
        { status: 400 },
      );
    }

    if (quotation.status !== 'Approved') {
      return NextResponse.json(
        { error: 'Only approved quotations can be converted to invoices' },
        { status: 400 },
      );
    }

    let additionalData = {};
    try {
      additionalData = await request.json();
    } catch {
      /* optional body */
    }

    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: user.tenantId },
    });
    const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';
    const issueDate = new Date();

    let branchId = null;
    try {
      branchId = await resolveBranchId(user, additionalData.branchId, user.tenantId);
    } catch (branchErr) {
      return NextResponse.json(
        { error: branchErr.message || 'Invalid branch' },
        { status: 403 },
      );
    }

    const newInvoice = await prisma.$transaction(async (tx) => {
      const revenueAccount = await findDefaultInvoiceRevenueAccount(user.tenantId, tx);
      if (!revenueAccount) {
        throw new Error(
          'Default revenue account (4100 Product Sales) not found. Set up your Chart of Accounts before converting quotations.',
        );
      }
      const revBlock = accountBlocksDirectPosting(revenueAccount);
      if (revBlock.blocked) {
        throw new Error(
          `Cannot post invoice revenue to "${revenueAccount.accountName}". ${revBlock.reason}`,
        );
      }

      const seq = await allocateNextInvNumberReliable(tx, user.tenantId, {
        prefix: invoicePrefix,
        issueDate,
      });
      const invoiceNumber = formatDatedDocumentNumber(invoicePrefix, issueDate, seq);

      const calculations = calculateInvoiceTotals(
        quotation.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          productId: item.productId,
          taxes: item.itemTaxes?.length ? item.itemTaxes : undefined,
          taxRate: item.taxRate,
          accountId: revenueAccount.id,
        })),
        quotation.discount || 0
      );

      const processedItems = calculations.processedItems.map((item) => ({
        ...item,
        accountId: revenueAccount.id,
      }));

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId: quotation.clientId,
          createdById: user.id,
          issueDate,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          discount: calculations.globalDiscount,
          subtotal: calculations.subtotal,
          taxAmount: calculations.taxAmount,
          totalDiscountAmount: calculations.totalDiscountAmount || 0,
          total: calculations.total,
          status: 'Pending',
          notes: `${quotation.notes ? `${quotation.notes}\n\n` : ''}Generated from quotation ${quotation.quotationNumber}.`,
          tenantId: user.tenantId,
          branchId,
          items: {
            create: processedItems.map((item) =>
              buildInvoiceItemCreateData(item, invoiceItemHasAccountId),
            ),
          },
        },
        include: { client: true, items: { include: { itemTaxes: true } } },
      });

      await postInvoiceAccounting({
        db: tx,
        tenantId: user.tenantId,
        userId: user.id,
        invoiceId: inv.id,
      });

      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'Converted',
          invoiceId: inv.id,
          notes: `${quotation.notes ? `${quotation.notes} ` : ''}Converted to invoice ${invoiceNumber}.`,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'QUOTATION_CONVERTED',
          entityType: 'QUOTATION',
          entityId: quotationId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            quotationNumber: quotation.quotationNumber,
            invoiceNumber,
            clientId: quotation.clientId,
            total: quotation.total,
          }),
        },
      });

      return inv;
    }, { maxWait: 15000, timeout: 120000 });

    const formattedInvoice = {
      id: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      client: newInvoice.client.name,
      clientId: newInvoice.clientId,
      issueDate: newInvoice.issueDate.toISOString().split('T')[0],
      dueDate: newInvoice.dueDate.toISOString().split('T')[0],
      amount: newInvoice.total.toLocaleString(),
      discount: newInvoice.discount.toLocaleString(),
      subtotal: newInvoice.subtotal.toLocaleString(),
      taxAmount: newInvoice.taxAmount.toLocaleString(),
      status: newInvoice.status,
      notes: newInvoice.notes,
      items: newInvoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: item.amount,
        productId: item.productId,
      })),
    };

    // Phase 11: bridge issued invoice from quotation convert (no MRA API call)
    let eisResult = null;
    try {
      eisResult = await bridgeSalesInvoiceAfterCommit({
        tenantId: user.tenantId,
        invoice: newInvoice,
        actorContext: { userId: user.id },
      });
    } catch (eisErr) {
      console.error('⚠️ EIS Phase 11 quotation-convert bridge failed (invoice still saved):', eisErr.message);
      eisResult = { ok: false, recoveryRequired: true, message: eisErr.message };
    }

    return NextResponse.json({
      message: 'Quotation successfully converted to invoice',
      invoice: formattedInvoice,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      eis: eisResult
        ? {
            status: eisResult.eisStatus || eisResult.bridge?.status || null,
            bridgeId: eisResult.bridge?.id || null,
            message: eisResult.message || null,
            mraSubmitted: false,
            mraAccepted: false,
            fiscalNumber: null,
            qrPresent: false,
          }
        : null,
    });
  } catch (error) {
    console.error('Error converting quotation to invoice:', error);

    if (error.code === 'P2002' && String(error.meta?.target || '').includes('invoiceNumber')) {
      return NextResponse.json(
        { error: 'Invoice number already exists for this business.' },
        { status: 409 },
      );
    }

    const mapped = classifyApiError(error, {
      fallback: 'Failed to convert quotation to invoice. Please try again.',
    });

    return NextResponse.json({ error: mapped.error, code: error.code || undefined }, { status: mapped.status });
  }
}
