// app/api/employees/[id]/terminate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sendEmail } from '@/lib/emailService';

/**
 * POST - Terminate an employee
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { terminationDate, terminationReason, sendEmail: shouldSendEmail } = body;

    if (!terminationDate) {
      return NextResponse.json(
        { error: 'Termination date is required' },
        { status: 400 }
      );
    }

    // Verify employee belongs to tenant and get full details
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        tenantId: true,
        status: true
      }
    });

    if (!employee || employee.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Terminate employee
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        status: 'Terminated',
        isActive: false,
        terminationDate: new Date(terminationDate),
        terminationReason: terminationReason || null,
        suspendedFrom: null,
        suspendedTo: null,
        suspensionReason: null
      },
      include: {
        departmentRef: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'EMPLOYEE_TERMINATED',
        entityType: 'EMPLOYEE',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: employee.name,
          terminationDate,
          terminationReason
        })
      }
    });

    // Send email notification if requested
    if (shouldSendEmail && employee.email) {
      try {
        // Get tenant info for email template
        const tenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true
          }
        });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const formattedDate = new Date(terminationDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });

        const emailContent = `
          <p>Dear ${employee.name},</p>
          <p>This email is to formally notify you that your employment with ${tenant?.name || 'our company'} has been terminated, effective ${formattedDate}.</p>
          ${terminationReason ? `<p><strong>Reason:</strong> ${terminationReason}</p>` : ''}
          <p>We thank you for your service and wish you the best in your future endeavors.</p>
          <p>If you have any questions or need to discuss this matter further, please contact the HR department.</p>
          <p>Best regards,<br>Human Resources Department<br>${tenant?.name || 'InsightBooks'}</p>
        `;

        await sendEmail({
          to: employee.email,
          subject: `Employment Termination Notice - ${tenant?.name || 'InsightBooks'}`,
          template: 'rich-email',
          data: {
            companyName: tenant?.name || 'InsightBooks',
            tenantName: tenant?.name || 'InsightBooks',
            htmlContent: emailContent,
            baseUrl: baseUrl,
            priority: 'high',
            showPriority: false
          }
        });

        // Log email sent
        await prisma.auditLog.create({
          data: {
            action: 'EMPLOYEE_TERMINATION_EMAIL_SENT',
            entityType: 'EMPLOYEE',
            entityId: id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              employeeName: employee.name,
              email: employee.email
            })
          }
        });
      } catch (emailError) {
        console.error('Error sending termination email:', emailError);
        // Don't fail the termination if email fails
      }
    }

    return NextResponse.json({ 
      success: true,
      employee: updated 
    });

  } catch (error) {
    console.error('Error terminating employee:', error);
    return NextResponse.json(
      { error: 'Failed to terminate employee', details: error.message },
      { status: 500 }
    );
  }
}

