import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

const DEFAULT_ALL_FAILED_LIMIT = 25;
const MAX_ALL_FAILED_LIMIT = 100;

async function isSuppressed(email) {
  if (!email) return false;
  const suppressed = await prisma.platformEmailSuppression.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      active: true,
    },
  });
  return Boolean(suppressed);
}

/**
 * Re-queue an existing EmailLog only — never create duplicate business records.
 */
async function requeueEmailLog(log) {
  if (log.status === 'pending') {
    return { log, idempotentReplay: true, skipped: false };
  }

  if (await isSuppressed(log.recipientEmail)) {
    return {
      log,
      idempotentReplay: false,
      skipped: true,
      reason: 'suppressed',
    };
  }

  const updated = await prisma.emailLog.update({
    where: { id: log.id },
    data: {
      status: 'pending',
      errorMessage: null,
      updatedAt: new Date(),
    },
  });
  return { log: updated, idempotentReplay: false, skipped: false };
}

/**
 * POST /api/admin/system-health/retry
 * Body: { jobType: 'email', jobId } OR { jobType: 'email', allFailed?: true, limit?: number }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.health.retryJobs)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const jobType = String(body.jobType || '').trim().toLowerCase();
    if (jobType !== 'email') {
      return NextResponse.json(
        { success: false, error: "Unsupported jobType. Use 'email'." },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Single job by id
    if (body.jobId || body.emailLogId) {
      const jobId = String(body.jobId || body.emailLogId);
      const log = await prisma.emailLog.findUnique({ where: { id: jobId } });
      if (!log) {
        return NextResponse.json({ success: false, error: 'Email log not found' }, { status: 404 });
      }

      const result = await requeueEmailLog(log);
      if (result.skipped && result.reason === 'suppressed') {
        return NextResponse.json(
          {
            success: false,
            error: 'Recipient is on the suppression list',
            suppressed: true,
            jobId: log.id,
          },
          { status: 409 }
        );
      }

      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'HEALTH_JOB_RETRY',
          entityType: 'EMAIL_LOG',
          entityId: log.id,
          details: JSON.stringify({
            jobType: 'email',
            jobId: log.id,
            idempotentReplay: result.idempotentReplay,
            note: 'Retry only — no duplicate business side-effect',
          }),
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({
        success: true,
        jobType: 'email',
        jobId: result.log.id,
        status: result.log.status,
        idempotentReplay: result.idempotentReplay,
        message: result.idempotentReplay
          ? 'Email already pending — idempotent replay.'
          : 'Email queued for retry. No business record was duplicated.',
      });
    }

    // Bulk failed
    if (body.allFailed) {
      const limit = Math.min(
        Math.max(Number(body.limit) || DEFAULT_ALL_FAILED_LIMIT, 1),
        MAX_ALL_FAILED_LIMIT
      );

      const failedLogs = await prisma.emailLog.findMany({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      const results = {
        attempted: failedLogs.length,
        requeued: 0,
        idempotent: 0,
        suppressed: 0,
        jobIds: [],
      };

      for (const log of failedLogs) {
        const result = await requeueEmailLog(log);
        if (result.skipped && result.reason === 'suppressed') {
          results.suppressed += 1;
          continue;
        }
        if (result.idempotentReplay) {
          results.idempotent += 1;
        } else {
          results.requeued += 1;
        }
        results.jobIds.push(result.log.id);
      }

      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'HEALTH_JOB_RETRY_BULK',
          entityType: 'EMAIL_LOG',
          entityId: 'BULK',
          details: JSON.stringify({
            jobType: 'email',
            allFailed: true,
            limit,
            ...results,
            note: 'Retry only — no duplicate business side-effect',
          }),
          ipAddress,
          userAgent,
        },
      });

      return NextResponse.json({
        success: true,
        jobType: 'email',
        allFailed: true,
        limit,
        ...results,
        message: `Requeued ${results.requeued} failed email(s); ${results.suppressed} suppressed skipped.`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Provide jobId or allFailed: true for email job retries.',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('system-health retry error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry job' },
      { status: 500 }
    );
  }
}
