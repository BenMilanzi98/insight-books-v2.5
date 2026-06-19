// app/api/quotations/[id]/convert/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';
import { allocateNextInvNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { createInvoiceJournalEntry } from '@/lib/transactionJournalHelpers';
import { findDefaultInvoiceRevenueAccount } from '@/lib/coaPostingCodes';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility';
import { resolveBranchId } from '@/lib/branchHelpers';
import { parseMoney } from '@/lib/money';
import { classifyApiError } from '@/lib/apiErrorUtils';

// POST - Convert a quotation to an invoice
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: quotationId } = await params;

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, tenantId: user.tenantId },
      include: { client: true, items: true },
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

      const processedItems = quotation.items.map((item) => {
        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        const taxRate = Number(item.taxRate || 0);
        const discountAmount = Number(item.discountAmount || 0);
        const lineAmount = Number(item.amount);
        const netAmount =
          item.netAmount != null && item.netAmount !== ''
            ? Number(item.netAmount)
            : Math.max(0, lineAmount / (1 + taxRate / 100) || lineAmount - discountAmount);
        const taxAmount = Math.max(0, lineAmount - netAmount);
        return {
          description: item.description,
          quantity: qty,
          unitPrice,
          taxRate,
          discountAmount,
          amount: lineAmount,
          netAmount,
          taxAmount,
          productId: item.productId,
          accountId: revenueAccount.id,
        };
      });

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId: quotation.clientId,
          createdById: user.id,
          issueDate,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          discount: quotation.discount,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          totalDiscountAmount: quotation.totalDiscountAmount || 0,
          total: quotation.total,
          status: 'Pending',
          notes: `${quotation.notes ? `${quotation.notes}\n\n` : ''}Generated from quotation ${quotation.quotationNumber}.`,
          tenantId: user.tenantId,
          branchId,
          items: {
            create: processedItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              discountAmount: item.discountAmount,
              discountRate: 0,
              netAmount: Math.max(0, item.amount - item.discountAmount),
              amount: item.amount,
              productId: item.productId,
              accountId: item.accountId,
            })),
          },
        },
        include: { client: true, items: true },
      });

      await createInvoiceJournalEntry({
        tenantId: user.tenantId,
        userId: user.id,
        invoiceId: inv.id,
        invoiceNumber,
        issueDate,
        totalAmount: parseMoney(inv.total),
        items: processedItems,
        hasServices: true,
        cogsAmount: 0,
        taxAmount: 0,
        taxTypeId: null,
        tx,
      });

      const taxAmount = parseMoney(inv.taxAmount);
      if (taxAmount > 0) {
        const { autoPostTaxEntry } = await import('@/lib/taxCalculationService');
        const activeTaxTypes = await tx.taxType.findMany({
          where: { tenantId: user.tenantId, status: 'Active' },
        });
        const nonPayeTypes = activeTaxTypes.filter((t) => Number(t.taxRate) > 0);
        const primaryRate =
          processedItems.map((i) => i.taxRate).find((r) => r > 0) || 0;
        let taxTypeId = null;
        if (primaryRate > 0) {
          taxTypeId =
            nonPayeTypes.find((t) => Math.abs(Number(t.taxRate) - primaryRate) < 0.01)?.id ||
            nonPayeTypes[0]?.id ||
            null;
        } else {
          taxTypeId = nonPayeTypes[0]?.id || null;
        }
        if (taxTypeId) {
          try {
            await autoPostTaxEntry({
              tenantId: user.tenantId,
              userId: user.id,
              taxTypeId,
              taxAmount,
              transactionDate: issueDate,
              sourceType: 'Invoice',
              sourceId: inv.id,
              description: `Tax for invoice ${invoiceNumber} (from quotation)`,
              tx,
            });
          } catch (taxErr) {
            console.warn('Quotation convert: tax posting skipped:', taxErr?.message);
          }
        }
      }

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

    let eisResult = null;
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { eisEnabled: true },
      });
      if (tenant?.eisEnabled) {
        const eisAccess = await hasEISAccess(user.tenantId);
        if (eisAccess) {
          eisResult = await eisService.submitInvoice(
            user.tenantId,
            {
              invoiceNumber: newInvoice.invoiceNumber,
              invoiceDate: newInvoice.issueDate,
              customerName: newInvoice.client?.name || quotation.client?.name || '',
              customerTPIN: '',
              items: (newInvoice.items || []).map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate || 0,
              })),
              subtotal: Number(newInvoice.subtotal),
              taxTotal: Number(newInvoice.taxAmount || 0),
              total: Number(newInvoice.total),
              paymentMethod: 'Bank Transfer',
            },
            'quotation-convert',
            newInvoice.id,
          );
        }
      }
    } catch (eisErr) {
      console.error('⚠️ EIS quotation-convert submission failed (invoice still saved):', eisErr.message);
    }

    return NextResponse.json({
      message: 'Quotation successfully converted to invoice',
      invoice: formattedInvoice,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      eis: eisResult ? { submissionId: eisResult.submissionId, status: eisResult.status } : null,
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
