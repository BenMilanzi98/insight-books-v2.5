import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { shouldResendOnly } from '@/lib/admin/emailSafety';

/**
 * POST /api/admin/email/retry
 * Body: { emailLogId } — resend existing log only; does not recreate business records.
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.retry)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const emailLogId = body.emailLogId || body.communicationId;

    if (!shouldResendOnly(emailLogId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'emailLogId is required. Retry must target an existing communication — do not recreate from payload.',
        },
        { status: 400 }
      );
    }

    const log = await prisma.emailLog.findUnique({ where: { id: String(emailLogId) } });
    if (!log) {
      return NextResponse.json({ success: false, error: 'Email log not found' }, { status: 404 });
    }

    const suppressed = await prisma.platformEmailSuppression.findFirst({
      where: {
        email: { equals: log.recipientEmail, mode: 'insensitive' },
        active: true,
      },
    });
    if (suppressed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Recipient is on the suppression list',
          suppressed: true,
        },
        { status: 409 }
      );
    }

    // Mark for retry — do not create a second business transaction.
    const updated = await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'pending',
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'EMAIL_RETRY',
        entityType: 'EMAIL_LOG',
        entityId: log.id,
        details: JSON.stringify({
          recipientEmail: log.recipientEmail,
          template: log.template,
          note: 'Retry only — no duplicate business side-effect',
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      emailLog: {
        id: updated.id,
        status: updated.status,
        recipientEmail: updated.recipientEmail,
        template: updated.template,
        subject: updated.subject,
      },
      message: 'Email queued for retry. No business record was duplicated.',
    });
  } catch (error) {
    console.error('email retry error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry email' },
      { status: 500 }
    );
  }
}
