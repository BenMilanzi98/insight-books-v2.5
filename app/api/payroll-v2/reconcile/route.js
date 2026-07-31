import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { parseMoney, addMoney, roundMoney } from '@/lib/money';

/**
 * Reconciliation centre: compare PayrollRun totals vs linked journals / results.
 */
export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'payroll.view',
      'hr.view',
      'reports.view',
    ]);
    if (perm) return perm;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    const runs = await prisma.payrollRun.findMany({
      where: {
        tenantId: user.tenantId,
        ...(runId ? { id: runId } : {}),
        status: { in: ['POSTED', 'PAID', 'APPROVED', 'CALCULATED'] },
      },
      include: { results: true, paymentBatches: true },
      orderBy: { periodEnd: 'desc' },
      take: runId ? 1 : 25,
    });

    const items = runs.map((run) => {
      const resultGross = roundMoney(
        run.results.reduce((s, r) => addMoney(s, parseMoney(r.grossPay)), 0)
      );
      const resultNet = roundMoney(
        run.results.reduce((s, r) => addMoney(s, parseMoney(r.netPay)), 0)
      );
      const totalsGross = parseMoney(run.totals?.grossPay);
      const totalsNet = parseMoney(run.totals?.netPay);
      const paid = run.paymentBatches
        .filter((b) => b.status === 'POSTED')
        .reduce((s, b) => addMoney(s, parseMoney(b.totalAmount)), 0);

      const issues = [];
      if (Math.abs(resultGross - totalsGross) > 0.01) {
        issues.push('GROSS_MISMATCH');
      }
      if (Math.abs(resultNet - totalsNet) > 0.01) {
        issues.push('NET_MISMATCH');
      }
      if (run.status === 'PAID' && Math.abs(paid - totalsNet) > 0.01) {
        issues.push('PAYMENT_MISMATCH');
      }
      if (run.status === 'POSTED' && !run.recognitionJournalId) {
        issues.push('MISSING_RECOGNITION_JOURNAL');
      }
      if (!run.results.length && ['CALCULATED', 'POSTED', 'PAID'].includes(run.status)) {
        issues.push('MISSING_RESULTS');
      }

      return {
        runId: run.id,
        runNumber: run.runNumber,
        status: run.status,
        periodEnd: run.periodEnd,
        recognitionJournalId: run.recognitionJournalId,
        totals: run.totals,
        resultGross,
        resultNet,
        paid,
        issues,
        balanced: issues.length === 0,
      };
    });

    return NextResponse.json({
      items,
      summary: {
        runs: items.length,
        unbalanced: items.filter((i) => !i.balanced).length,
      },
    });
  } catch (e) {
    console.error('payroll reconcile', e);
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
  }
}
