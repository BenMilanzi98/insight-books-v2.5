/**
 * /api/accounting-v2/reports/runs/[id] — review / approve / snapshot a run.
 *
 * POST { action: 'review'|'approve'|'snapshot', comment?, reason? }
 * Approval never alters accounting data; UNVERIFIED/BLOCKED runs cannot be
 * approved. Snapshot regenerates canonically and verifies the result checksum
 * still matches the run before persisting the immutable payload.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  reviewReportRun,
  approveReportRun,
  snapshotReport,
} from '@/lib/accountingV2/reporting/reportRunService.js';
import { generateReport } from '@/lib/accountingV2/reporting/financialReportService.js';
import { recordAccountingAudit } from '@/lib/accountingV2/infrastructure/auditTrail.js';

export const dynamic = 'force-dynamic';

const ACTION_PERMISSIONS = {
  review: [ACCOUNTING_PERMISSIONS.REPORTS_REVIEW],
  approve: [ACCOUNTING_PERMISSIONS.REPORTS_APPROVE],
  snapshot: [ACCOUNTING_PERMISSIONS.REPORTS_SNAPSHOT],
};

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');
  if (!ACTION_PERMISSIONS[action]) {
    return NextResponse.json({ error: 'Unknown action; supported: review, approve, snapshot' }, { status: 400 });
  }
  const guard = await guardAccountingRoute(request, ACTION_PERMISSIONS[action]);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    let result;
    if (action === 'review') {
      result = await reviewReportRun(prisma, guard.context, id, { comment: body.comment ?? null });
    } else if (action === 'approve') {
      result = await approveReportRun(prisma, guard.context, id, { comment: body.comment ?? null });
    } else {
      const run = await prisma.acctV2ReportRun.findFirst({
        where: { id, tenantId: guard.context.businessId },
      });
      if (!run) return NextResponse.json({ error: 'Report run not found' }, { status: 404 });
      const filters = run.filters ?? {};
      const { envelope } = await generateReport(prisma, guard.context, run.reportType, filters, {
        recordRun: false,
      });
      result = await snapshotReport(prisma, guard.context, id, envelope, { reason: body.reason ?? null });
    }
    await recordAccountingAudit(
      {
        action: `acctv2.report.${action}`,
        entityType: 'AcctV2ReportRun',
        entityId: id,
        userId: guard.context.userId,
        tenantId: guard.context.businessId,
        newValues: { action, comment: body.comment ?? null, reason: body.reason ?? null },
        requestId: guard.context.requestId,
        correlationId: guard.context.correlationId,
      },
      prisma
    );
    return NextResponse.json({ [action]: result });
  } catch (error) {
    return accountingErrorResponse(error, `report run ${action}`);
  }
}
