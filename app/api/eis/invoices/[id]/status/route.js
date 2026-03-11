import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import eisService from '@/lib/eisService';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const invoice = await prisma.eISInvoice.findFirst({
      where: {
        OR: [{ id }, { submissionId: id }],
        tenantId: user.tenantId
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'EIS invoice not found' }, { status: 404 });
    }

    if (invoice.submissionId && ['Pending', 'Submitted'].includes(invoice.status)) {
      try {
        const mraStatus = await eisService.checkStatus(user.tenantId, invoice.submissionId);
        if (mraStatus.status && mraStatus.status !== invoice.status) {
          await prisma.eISInvoice.update({
            where: { id: invoice.id },
            data: {
              status: mraStatus.status,
              mraInvoiceId: mraStatus.mraInvoiceId || invoice.mraInvoiceId,
              responseData: mraStatus
            }
          });

          if (mraStatus.status === 'Approved' || mraStatus.status === 'Rejected') {
            await eisService.updateUsageStats(user.tenantId, mraStatus.status, 0);
          }

          return NextResponse.json({
            success: true,
            data: { ...invoice, status: mraStatus.status, currentStatus: mraStatus }
          });
        }
      } catch (statusErr) {
        console.warn('MRA status check failed:', statusErr.message);
      }
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('GET /api/eis/invoices/[id]/status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
