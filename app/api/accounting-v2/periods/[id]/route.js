/**
 * /api/accounting-v2/periods/[id]
 *
 * GET  — period detail: status, close runs + tasks, exceptions, reopen
 *        requests and the immutable status history.
 * POST — {action} dispatch for the controlled period workflows. There is NO
 *        generic status-update endpoint: every action runs an approved
 *        server-side workflow with its own permission.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getPeriodForBusiness, getPeriodStatusHistory, setPeriodLockDate } from '@/lib/accountingV2/periods/periodLifecycleService.js';
import {
  beginPeriodClose,
  cancelPeriodClose,
  runAutomatedCloseChecks,
  updateManualCloseTask,
  waiveCloseTask,
  addCloseException,
  acceptExceptionForClose,
  resolveCloseException,
  submitCloseForReview,
  approveCloseRun,
  closePeriod,
  getCloseRun,
  getActiveCloseRun,
} from '@/lib/accountingV2/periods/periodCloseService.js';
import {
  computeReopenImpact,
  requestReopen,
  approveReopen,
  rejectReopen,
  listReopenRequests,
} from '@/lib/accountingV2/periods/periodReopenService.js';

export const dynamic = 'force-dynamic';

const P = ACCOUNTING_PERMISSIONS;

const ACTION_PERMISSIONS = {
  'begin-close': [P.PERIODS_BEGIN_CLOSE, P.PERIODS_CLOSE],
  'cancel-close': [P.PERIODS_BEGIN_CLOSE, P.PERIODS_CLOSE],
  'run-checks': [P.PERIODS_COMPLETE_TASKS, P.PERIODS_BEGIN_CLOSE, P.PERIODS_CLOSE],
  'update-task': [P.PERIODS_COMPLETE_TASKS],
  'waive-task': [P.PERIODS_COMPLETE_TASKS, P.PERIODS_OVERRIDE_MATERIALITY],
  'add-exception': [P.PERIODS_MANAGE_EXCEPTIONS, P.PERIODS_COMPLETE_TASKS],
  'accept-exception': [P.PERIODS_MANAGE_EXCEPTIONS],
  'resolve-exception': [P.PERIODS_MANAGE_EXCEPTIONS],
  'submit-review': [P.PERIODS_SUBMIT_CLOSE, P.PERIODS_CLOSE],
  'approve-close': [P.PERIODS_APPROVE_CLOSE],
  close: [P.PERIODS_EXECUTE_CLOSE, P.PERIODS_CLOSE],
  'request-reopen': [P.PERIODS_REQUEST_REOPEN, P.PERIODS_REOPEN],
  'approve-reopen': [P.PERIODS_APPROVE_REOPEN],
  'reject-reopen': [P.PERIODS_APPROVE_REOPEN],
  impact: [P.PERIODS_VIEW, P.PERIODS_REQUEST_REOPEN],
  'set-lock-date': [P.PERIODS_SET_LOCK_DATE],
};

export async function GET(request, { params }) {
  const guard = await guardAccountingRoute(request, [P.PERIODS_VIEW, P.VIEW]);
  if (guard.response) return guard.response;
  try {
    const resolvedParams = typeof params?.then === 'function' ? await params : params;
    const periodId = resolvedParams?.id;
    const period = await getPeriodForBusiness(prisma, guard.context, periodId);
    const [history, activeRun, closeRuns, exceptions, reopenRequests] = await Promise.all([
      getPeriodStatusHistory(prisma, guard.context, period.id),
      getActiveCloseRun(prisma, guard.context, period.id),
      prisma.acctV2PeriodCloseRun.findMany({
        where: { tenantId: guard.context.businessId, accountingPeriodId: period.id },
        orderBy: { closeNumber: 'desc' },
      }),
      prisma.acctV2PeriodCloseException.findMany({
        where: { tenantId: guard.context.businessId, accountingPeriodId: period.id },
        orderBy: { createdAt: 'desc' },
      }),
      listReopenRequests(prisma, guard.context, period.id),
    ]);
    let activeRunDetail = null;
    if (activeRun) {
      activeRunDetail = await getCloseRun(prisma, guard.context, activeRun.id);
    }
    return NextResponse.json({
      period,
      statusHistory: history,
      activeCloseRun: activeRunDetail,
      closeRuns,
      exceptions: exceptions.map((e) => ({ ...e, amountMinor: e.amountMinor != null ? String(e.amountMinor) : null })),
      reopenRequests,
    });
  } catch (error) {
    return accountingErrorResponse(error, 'load period detail');
  }
}

export async function POST(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const permissions = ACTION_PERMISSIONS[action];
  if (!permissions) {
    return NextResponse.json({ error: `Unknown period action: ${action}` }, { status: 400 });
  }
  const guard = await guardAccountingRoute(request, permissions);
  if (guard.response) return guard.response;
  const { context, can } = guard;
  try {
    const resolvedParams = typeof params?.then === 'function' ? await params : params;
    const periodId = resolvedParams?.id;

    switch (action) {
      case 'begin-close':
        return NextResponse.json({ closeRun: await beginPeriodClose(prisma, context, periodId, { reason: body.reason ?? null }) }, { status: 201 });
      case 'cancel-close':
        return NextResponse.json({ closeRun: await cancelPeriodClose(prisma, context, String(body.closeRunId), { reason: body.reason ?? null }) });
      case 'run-checks':
        return NextResponse.json(await runAutomatedCloseChecks(prisma, context, String(body.closeRunId)));
      case 'update-task':
        return NextResponse.json({
          task: await updateManualCloseTask(prisma, context, String(body.closeRunId), String(body.taskKey), {
            status: body.status,
            comment: body.comment ?? null,
            evidence: body.evidence ?? null,
          }),
        });
      case 'waive-task':
        return NextResponse.json({
          task: await waiveCloseTask(prisma, context, String(body.closeRunId), String(body.taskKey), { reason: body.reason, can }),
        });
      case 'add-exception':
        return NextResponse.json({ exception: await addCloseException(prisma, context, periodId, body) }, { status: 201 });
      case 'accept-exception':
        return NextResponse.json({ exception: await acceptExceptionForClose(prisma, context, String(body.exceptionId), { reason: body.reason, can }) });
      case 'resolve-exception':
        return NextResponse.json({ exception: await resolveCloseException(prisma, context, String(body.exceptionId), { resolutionTarget: body.resolutionTarget ?? null }) });
      case 'submit-review':
        return NextResponse.json({ closeRun: await submitCloseForReview(prisma, context, String(body.closeRunId)) });
      case 'approve-close':
        return NextResponse.json({ closeRun: await approveCloseRun(prisma, context, String(body.closeRunId), { comment: body.comment ?? null }) });
      case 'close':
        return NextResponse.json(await closePeriod(prisma, context, String(body.closeRunId), { reason: body.reason ?? null }));
      case 'request-reopen':
        return NextResponse.json(await requestReopen(prisma, context, periodId, {
          reason: body.reason,
          expectedCorrections: body.expectedCorrections ?? null,
        }), { status: 201 });
      case 'approve-reopen':
        return NextResponse.json(await approveReopen(prisma, context, String(body.reopenRequestId), {
          correctionScope: body.correctionScope ?? null,
          comment: body.comment ?? null,
        }));
      case 'reject-reopen':
        return NextResponse.json({ request: await rejectReopen(prisma, context, String(body.reopenRequestId), { rejectionReason: body.rejectionReason }) });
      case 'impact':
        return NextResponse.json({ impact: await computeReopenImpact(prisma, context, periodId) });
      case 'set-lock-date':
        return NextResponse.json({ period: await setPeriodLockDate(prisma, context, periodId, body.lockDate ?? null, body.reason) });
      default:
        return NextResponse.json({ error: `Unknown period action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return accountingErrorResponse(error, `period ${action}`);
  }
}
