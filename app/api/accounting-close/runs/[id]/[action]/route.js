import { NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma.js';
import { guardCloseRoute, accountingErrorResponse } from '../../../../../../lib/accountingClose/api/routeGuard.js';
import { CLOSE_PERMISSIONS } from '../../../../../../lib/accountingClose/permissions.js';
import {
  runAutomaticChecklistTasks,
  completeManualTask,
  approveCloseRunForClosing,
} from '../../../../../../lib/accountingClose/application/closeRunService.js';
import {
  generateClosingBatchPreview,
  approveClosingBatch,
  postClosingBatch,
} from '../../../../../../lib/accountingClose/application/closingBatchService.js';
import {
  generatePostClosingTrialBalance,
  generateAnnualSnapshots,
  closeFinancialYear,
  buildNextYearOpeningReportingBalances,
} from '../../../../../../lib/accountingClose/application/postClosingService.js';
import {
  buildAnnualClosePack,
  exportAnnualClosePackExcel,
} from '../../../../../../lib/accountingClose/application/annualClosePackService.js';
import { reverseClosingJournals } from '../../../../../../lib/accountingClose/application/closingReversalService.js';
import {
  createCloseException,
  resolveCloseException,
  acceptCloseException,
} from '../../../../../../lib/accountingClose/application/exceptionService.js';

export async function GET(request, { params }) {
  try {
    const { id, action } = await params;
    if (action === 'close-pack') {
      const guard = await guardCloseRoute(request, [
        CLOSE_PERMISSIONS.EXPORT,
        CLOSE_PERMISSIONS.VIEW,
      ]);
      if (guard.response) return guard.response;
      const format = new URL(request.url).searchParams.get('format') || 'json';
      if (format === 'xlsx') {
        const exported = await exportAnnualClosePackExcel(prisma, guard.context, id);
        return new NextResponse(exported.buffer, {
          status: 200,
          headers: {
            'Content-Type': exported.contentType,
            'Content-Disposition': `attachment; filename="${exported.filename}"`,
          },
        });
      }
      const pack = await buildAnnualClosePack(prisma, guard.context, id);
      return NextResponse.json({ pack });
    }
    return NextResponse.json({ error: `Unknown GET action ${action}` }, { status: 400 });
  } catch (error) {
    return accountingErrorResponse(error, 'close run get action');
  }
}

export async function POST(request, { params }) {
  try {
    const { id, action } = await params;
    const body = await request.json().catch(() => ({}));

    const permMap = {
      'run-checklist': CLOSE_PERMISSIONS.RUN_READINESS,
      'complete-task': CLOSE_PERMISSIONS.COMPLETE_TASKS,
      'approve-closing': CLOSE_PERMISSIONS.APPROVE_YEAR_CLOSE,
      'generate-closing-preview': CLOSE_PERMISSIONS.GENERATE_CLOSING,
      'approve-closing-batch': CLOSE_PERMISSIONS.APPROVE_CLOSING,
      'post-closing-batch': CLOSE_PERMISSIONS.POST_CLOSING,
      'generate-pctb': CLOSE_PERMISSIONS.GENERATE_PCTB,
      'generate-snapshots': CLOSE_PERMISSIONS.GENERATE_SNAPSHOTS,
      'close-year': CLOSE_PERMISSIONS.CLOSE_YEAR,
      'opening-balances': CLOSE_PERMISSIONS.VIEW,
      'close-pack': CLOSE_PERMISSIONS.EXPORT,
      'reverse-closing': CLOSE_PERMISSIONS.REVERSE_CLOSING,
      'create-exception': CLOSE_PERMISSIONS.MANAGE_EXCEPTIONS,
      'resolve-exception': CLOSE_PERMISSIONS.MANAGE_EXCEPTIONS,
      'accept-exception': CLOSE_PERMISSIONS.ACCEPT_CRITICAL_EXCEPTION,
    };

    const guard = await guardCloseRoute(request, permMap[action] || CLOSE_PERMISSIONS.VIEW);
    if (guard.response) return guard.response;

    switch (action) {
      case 'run-checklist': {
        const run = await runAutomaticChecklistTasks(prisma, guard.context, id);
        return NextResponse.json({ run });
      }
      case 'complete-task': {
        const run = await completeManualTask(prisma, guard.context, id, body.taskKey, body);
        return NextResponse.json({ run });
      }
      case 'approve-closing': {
        const run = await approveCloseRunForClosing(prisma, guard.context, id);
        return NextResponse.json({ run });
      }
      case 'generate-closing-preview': {
        const result = await generateClosingBatchPreview(prisma, guard.context, id, body);
        return NextResponse.json(result);
      }
      case 'approve-closing-batch': {
        const batch = await approveClosingBatch(prisma, guard.context, body.batchId);
        return NextResponse.json({ batch });
      }
      case 'post-closing-batch': {
        const result = await postClosingBatch(prisma, guard.context, body.batchId, {
          hasPermission: guard.can,
        });
        return NextResponse.json(result);
      }
      case 'generate-pctb': {
        const pctb = await generatePostClosingTrialBalance(prisma, guard.context, id);
        return NextResponse.json({ pctb });
      }
      case 'generate-snapshots': {
        const snapshots = await generateAnnualSnapshots(prisma, guard.context, id);
        return NextResponse.json({ snapshots });
      }
      case 'close-year': {
        const result = await closeFinancialYear(prisma, guard.context, id, body);
        return NextResponse.json(result);
      }
      case 'opening-balances': {
        const run = await prisma.closeV2YearEndCloseRun.findFirst({
          where: { id, tenantId: guard.context.businessId },
        });
        const balances = await buildNextYearOpeningReportingBalances(
          prisma,
          guard.context,
          run.financialYearId
        );
        return NextResponse.json({ balances });
      }
      case 'close-pack': {
        const pack = await buildAnnualClosePack(prisma, guard.context, id);
        return NextResponse.json({ pack });
      }
      case 'reverse-closing': {
        const result = await reverseClosingJournals(prisma, guard.context, id, {
          reason: body.reason,
          postingDate: body.postingDate,
          hasPermission: guard.can,
        });
        return NextResponse.json(result);
      }
      case 'create-exception': {
        const exception = await createCloseException(prisma, guard.context, id, body);
        return NextResponse.json({ exception }, { status: 201 });
      }
      case 'resolve-exception': {
        const exception = await resolveCloseException(prisma, guard.context, body.exceptionId, body);
        return NextResponse.json({ exception });
      }
      case 'accept-exception': {
        const exception = await acceptCloseException(prisma, guard.context, body.exceptionId, body);
        return NextResponse.json({ exception });
      }
      default:
        return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
    }
  } catch (error) {
    return accountingErrorResponse(error, 'close run action');
  }
}
