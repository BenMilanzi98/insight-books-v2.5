import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { withClientStatus } from '@/lib/clientStatus';

/**
 * GET /api/clients/[id]/record
 * Full client record: profile, totals, invoices, payments, sales.
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

    const [invoices, sales] = await Promise.all([
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
            where: { status: 'Completed' },
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
          reference: true,
          saleDate: true,
          total: true,
          status: true,
          payments: {
            where: { status: 'Completed' },
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
    ]);

    const totalInvoiced = invoices.reduce((s, inv) => addMoney(s, inv.total), 0);
    const totalPaidInvoices = invoices.reduce((s, inv) => {
      const paid = (inv.payments || []).reduce((p, pay) => addMoney(p, pay.amount), 0);
      return addMoney(s, paid);
    }, 0);
    const outstanding = Math.max(0, subtractMoney(totalInvoiced, totalPaidInvoices));
    const totalSales = sales.reduce((s, sale) => addMoney(s, sale.total), 0);

    const invoiceRows = invoices.map((inv) => {
      const paid = (inv.payments || []).reduce((p, pay) => addMoney(p, pay.amount), 0);
      const balance =
        inv.remainingBalance != null
          ? parseMoney(inv.remainingBalance)
          : Math.max(0, subtractMoney(inv.total, paid));
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        total: parseMoney(inv.total),
        paid,
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
          sourceNumber: sale.reference || sale.id,
          sourceId: sale.id,
        });
      }
    }
    payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    const saleRows = sales.map((sale) => ({
      id: sale.id,
      reference: sale.reference || sale.id,
      saleDate: sale.saleDate,
      total: parseMoney(sale.total),
      status: sale.status,
    }));

    return NextResponse.json({
      client: withClientStatus(client),
      totals: {
        totalPurchases: addMoney(totalInvoiced, totalSales),
        totalInvoiced,
        totalSales,
        totalPaid: totalPaidInvoices,
        outstanding,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
        salesCount: sales.length,
      },
      invoices: invoiceRows,
      payments,
      sales: saleRows,
    });
  } catch (error) {
    console.error('Error fetching client record:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client record' },
      { status: 500 }
    );
  }
}
