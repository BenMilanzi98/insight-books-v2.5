// app/api/employees/[id]/suspend/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { sendEmail } from '@/lib/emailService';

/**
 * POST - Suspend an employee
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
    const { suspendedFrom, suspendedTo, suspensionReason, sendEmail: shouldSendEmail } = body;

    if (!suspendedFrom) {
      return NextResponse.json(
        { error: 'Suspension start date is required' },
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

    // Suspend employee
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        status: 'Suspended',
        isActive: false,
        suspendedFrom: new Date(suspendedFrom),
        suspendedTo: suspendedTo ? new Date(suspendedTo) : null,
        suspensionReason: suspensionReason || null
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
        action: 'EMPLOYEE_SUSPENDED',
        entityType: 'EMPLOYEE',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: employee.name,
          suspendedFrom,
          suspendedTo,
          suspensionReason
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
        const formattedStartDate = new Date(suspendedFrom).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
        const formattedEndDate = suspendedTo 
          ? new Date(suspendedTo).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })
          : null;

        const emailContent = `
          <p>Dear ${employee.name},</p>
          <p>This email is to formally notify you that your employment with ${tenant?.name || 'our company'} has been suspended, effective ${formattedStartDate}.</p>
          ${formattedEndDate ? `<p><strong>Suspension Period:</strong> ${formattedStartDate} to ${formattedEndDate}</p>` : '<p><strong>Suspension Period:</strong> Indefinite (until further notice)</p>'}
          ${suspensionReason ? `<p><strong>Reason:</strong> ${suspensionReason}</p>` : ''}
          <p>During this suspension period, you are not required to report to work. We will contact you regarding the status of your employment.</p>
          <p>If you have any questions or need to discuss this matter further, please contact the HR department.</p>
          <p>Best regards,<br>Human Resources Department<br>${tenant?.name || 'InsightBooks'}</p>
        `;

        await sendEmail({
          to: employee.email,
          subject: `Employment Suspension Notice - ${tenant?.name || 'InsightBooks'}`,
          template: 'rich-email',
          data: {
            companyName: tenant?.name || 'InsightBooks',
            tenantName: tenant?.name || 'InsightBooks',
            tenantLogoUrl: tenant?.logoUrl || null,
            htmlContent: emailContent,
            baseUrl: baseUrl,
            priority: 'high',
            showPriority: false
          }
        });

        // Log email sent
        await prisma.auditLog.create({
          data: {
            action: 'EMPLOYEE_SUSPENSION_EMAIL_SENT',
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
        console.error('Error sending suspension email:', emailError);
        // Don't fail the suspension if email fails
      }
    }

    return NextResponse.json({ 
      success: true,
      employee: updated 
    });

  } catch (error) {
    console.error('Error suspending employee:', error);
    return NextResponse.json(
      { error: 'Failed to suspend employee', details: error.message },
      { status: 500 }
    );
  }
}

