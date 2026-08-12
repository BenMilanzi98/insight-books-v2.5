import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { withClientStatus } from '@/lib/clientStatus';

const VOID_STATUSES = new Set(['void', 'cancelled', 'draft', 'refunded']);

function isVoidStatus(status) {
  return VOID_STATUSES.has(String(status || '').toLowerCase());
}

/**
 * GET /api/clients/[id]/record
 * One ledger per client: invoices + POS sales + payments + credit notes/refunds.
 * Outstanding = unpaid invoice AR only (POS cash sales do not create AR).
 */
export async function GET(request, context) {
  try {
    const perm = await requireAnyPermission(request, [
      'clients.view',
      'sales.view',
      'sales.create',
    ]);
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: clientId } = await context.params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        additionalEmails: true,
        phone: true,
        address: true,
        contactPerson: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [invoices, sales, creditNotes] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId, tenantId: user.tenantId },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          total: true,
          status: true,
          totalPaid: true,
          remainingBalance: true,
          payments: {
            where: { status: { equals: 'Completed', mode: 'insensitive' }, isReversal: false },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true,
              reference: true,
              status: true,
            },
            orderBy: { paymentDate: 'desc' },
          },
        },
        orderBy: { issueDate: 'desc' },
      }),
      prisma.sale.findMany({
        where: { clientId, tenantId: user.tenantId },
        select: {
          id: true,
          saleNumber: true,
          saleDate: true,
          total: true,
          status: true,
          isReversal: true,
          voidedAt: true,
          refundedAt: true,
          payments: {
            where: { status: { equals: 'Completed', mode: 'insensitive' }, isReversal: false },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true,
              reference: true,
              status: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      }),
      prisma.creditNote.findMany({
        where: {
          clientId,
          tenantId: user.tenantId,
          status: { notIn: ['Draft', 'Void', 'Cancelled', 'void', 'cancelled'] },
        },
        select: {
          id: true,
          noteNumber: true,
          amount: true,
          noteDate: true,
          reason: true,
          status: true,
          invoiceId: true,
          saleId: true,
        },
        orderBy: { noteDate: 'desc' },
      }),
    ]);

    const activeInvoices = invoices.filter((inv) => !isVoidStatus(inv.status));
    const activeSales = sales.filter(
      (sale) =>
        !sale.isReversal &&
        !sale.voidedAt &&
        !sale.refundedAt &&
        !isVoidStatus(sale.status)
    );

    const creditByInvoice = new Map();
    for (const note of creditNotes) {
      if (!note.invoiceId) continue;
      creditByInvoice.set(
        note.invoiceId,
        addMoney(creditByInvoice.get(note.invoiceId) || 0, note.amount)
      );
    }

    const totalInvoiced = activeInvoices.reduce((s, inv) => addMoney(s, inv.total), 0);
    const totalPaidInvoices = activeInvoices.reduce((s, inv) => {
      const paid = (inv.payments || []).reduce((p, pay) => addMoney(p, pay.amount), 0);
      return addMoney(s, paid);
    }, 0);
    const totalPaidSales = activeSales.reduce((s, sale) => {
      const paid = (sale.payments || []).reduce((p, pay) => addMoney(p, pay.amount), 0);
      return addMoney(s, paid);
    }, 0);
    const totalCreditsOnInvoices = activeInvoices.reduce(
      (s, inv) => addMoney(s, creditByInvoice.get(inv.id) || 0),
      0
    );
    const outstanding = Math.max(
      0,
      subtractMoney(subtractMoney(totalInvoiced, totalPaidInvoices), totalCreditsOnInvoices)
    );
    const totalSales = activeSales.reduce((s, sale) => addMoney(s, sale.total), 0);

    const invoiceRows = invoices.map((inv) => {
      const paid = (inv.payments || []).reduce((p, pay) => addMoney(p, pay.amount), 0);
      const credits = creditByInvoice.get(inv.id) || 0;
      const computed = Math.max(0, subtractMoney(subtractMoney(inv.total, paid), credits));
      const balance = isVoidStatus(inv.status)
        ? 0
        : computed;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        total: parseMoney(inv.total),
        paid,
        credits,
        outstanding: balance,
        status: inv.status,
      };
    });

    const payments = [];
    for (const inv of invoices) {
      for (const p of inv.payments || []) {
        payments.push({
          id: p.id,
          amount: parseMoney(p.amount),
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          reference: p.reference,
          status: p.status || 'Completed',
          sourceType: 'Invoice',
          sourceNumber: inv.invoiceNumber,
          sourceId: inv.id,
        });
      }
    }
    for (const sale of sales) {
      for (const p of sale.payments || []) {
        payments.push({
          id: p.id,
          amount: parseMoney(p.amount),
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          reference: p.reference,
          status: p.status || 'Completed',
          sourceType: 'Sale',
          sourceNumber: sale.saleNumber || sale.reference || sale.id,
          sourceId: sale.id,
        });
      }
    }
    payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    const saleRows = sales.map((sale) => ({
      id: sale.id,
      reference: sale.saleNumber || sale.reference || sale.id,
      saleDate: sale.saleDate,
      total: parseMoney(sale.total),
      status: sale.status,
      paid: (sale.payments || []).reduce((p, pay) => addMoney(p, pay.amount), 0),
      outstanding: 0,
    }));

    const creditNoteRows = creditNotes.map((note) => ({
      id: note.id,
      noteNumber: note.noteNumber,
      noteDate: note.noteDate,
      amount: parseMoney(note.amount),
      reason: note.reason,
      status: note.status,
      invoiceId: note.invoiceId,
      saleId: note.saleId,
    }));

    return NextResponse.json({
      client: withClientStatus(client),
      totals: {
        totalPurchases: addMoney(totalInvoiced, totalSales),
        totalInvoiced,
        totalSales,
        totalPaid: addMoney(totalPaidInvoices, totalPaidSales),
        outstanding,
        invoiceCount: activeInvoices.length,
        paymentCount: payments.length,
        salesCount: activeSales.length,
        creditNoteCount: creditNotes.length,
      },
      invoices: invoiceRows,
      payments,
      sales: saleRows,
      creditNotes: creditNoteRows,
    });
  } catch (error) {
    console.error('Error fetching client record:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client record' },
      { status: 500 }
    );
  }
}
