// app/api/clients/balance-reminder-template/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getBalanceReminderTemplate } from '@/lib/balanceReminderService';

/**
 * GET - Get balance reminder template for tenant
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const template = await getBalanceReminderTemplate(user.tenantId);

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching balance reminder template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

/**
 * POST/PUT - Update balance reminder template for tenant
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subject, body: templateBody } = body;

    if (!subject || !templateBody) {
      return NextResponse.json(
        { error: 'Subject and body are required' },
        { status: 400 }
      );
    }

    // Update tenant settings with custom template
    // Note: We'll need to add these fields to TenantSettings if they don't exist
    // For now, we'll store them in a JSON field or extend the schema
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { settings: true }
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Update or create settings
    if (tenant.settings) {
      await prisma.tenantSettings.update({
        where: { id: tenant.settings.id },
        data: {
          balanceReminderSubject: subject,
          balanceReminderBody: templateBody
        }
      });
    } else {
      await prisma.tenantSettings.create({
        data: {
          tenantId: user.tenantId,
          balanceReminderSubject: subject,
          balanceReminderBody: templateBody
        }
      });
    }

    return NextResponse.json({
      message: 'Template updated successfully',
      template: { subject, body: templateBody }
    });
  } catch (error) {
    console.error('Error updating balance reminder template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}
