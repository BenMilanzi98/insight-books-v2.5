// app/api/users/reset-password/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { getPublicAppBaseUrlForEmail } from '@/lib/publicAppUrl';
import { generateSixCharAlphanumericPassword } from '@/lib/generateTemporaryPassword';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// POST - Reset password for a specific user
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'users.update');
    if (perm) return perm;

    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, newPassword, sendEmail = false } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!sendEmail && !newPassword) {
      return NextResponse.json(
        { error: 'New password is required when sendEmail is false' },
        { status: 400 }
      );
    }

    const plainPassword = sendEmail ? generateSixCharAlphanumericPassword() : String(newPassword);

    // Get the target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId // Ensure tenant isolation
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let smtpMeta = null;

    if (sendEmail) {
      try {
        const { sendEmail: sendEmailSvc } = await import('@/lib/emailService');
        const loginBase = getPublicAppBaseUrlForEmail({
          forwardedProto: request.headers.get('x-forwarded-proto'),
          forwardedHost: request.headers.get('x-forwarded-host'),
        });
        const loginUrl = `${loginBase}/auth/login`;
        const plainName = targetUser.name || 'there';
        const displayName = escapeHtml(plainName);
        const displayPw = escapeHtml(plainPassword);
        const textBody = [
          `Hello ${plainName},`,
          '',
          'An administrator reset your InsightBooks password. Use the temporary password below to sign in.',
          '',
          `Temporary password: ${plainPassword}`,
          '',
          `Sign in: ${loginUrl}`,
          '',
          'If you did not expect this email, contact your business administrator.',
        ].join('\n');
        const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1f2937;">Password reset</h2>
  <p style="color: #4b5563;">Hello ${displayName},</p>
  <p style="color: #4b5563;">An administrator reset your InsightBooks password. Use the temporary password below to sign in, then change your password from your account settings if you wish.</p>
  <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Temporary password</strong></p>
    <p style="margin: 0; font-size: 18px; font-family: monospace; letter-spacing: 2px; color: #111827;">${displayPw}</p>
  </div>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600;">Sign in</a>
  </p>
  <p style="color: #6b7280; font-size: 13px;">If you did not expect this email, contact your business administrator.</p>
</div>`;
        const sendResult = await sendEmailSvc({
          to: targetUser.email,
          subject: 'Your InsightBooks password was reset',
          htmlContent: html,
          text: textBody,
        });
        smtpMeta = {
          messageId: sendResult?.messageId ?? null,
          accepted: sendResult?.accepted ?? null,
          response: sendResult?.response ?? null,
        };
      } catch (emailErr) {
        console.error('Admin password reset email failed:', emailErr);
        return NextResponse.json(
          {
            error:
              'Could not send email. Password was not changed. Check EMAIL_* SMTP settings and logs.',
            detail: emailErr?.message || String(emailErr),
          },
          { status: 502 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          resetBy: user.email,
          targetUser: targetUser.email,
          emailSent: !!sendEmail,
          ...(smtpMeta && { smtp: smtpMeta }),
        }),
      },
    });

    return NextResponse.json({
      message: sendEmail
        ? 'Password updated and email sent to the user.'
        : 'Password reset successfully',
      user: {
        id: targetUser.id,
        email: targetUser.email,
      },
      ...(smtpMeta && { smtp: smtpMeta }),
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
} 