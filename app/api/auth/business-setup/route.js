import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { ensurePrimaryBranchForTenant } from '@/lib/tenantStockAccess';

function normalizePhone(value) {
  if (value == null) return '';
  return String(value).replace(/[\s\-().]/g, '');
}

function isValidPhone(value) {
  const digits = normalizePhone(value).replace(/^\+/, '');
  return /^\d{7,15}$/.test(digits);
}

export async function POST(request) {
  try {
    const body = await request.json();

    const sessionUser = await getUserFromSession(request);
    const userId = body.userId || sessionUser?.id;
    const tenantId = body.tenantId || sessionUser?.tenantId;

    if (!userId || !tenantId || !body.businessName?.trim() || !body.personalPhone?.trim()) {
      return NextResponse.json(
        { error: 'Business name and personal phone number are required. Please sign in and try again.' },
        { status: 400 }
      );
    }

    if (sessionUser && sessionUser.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!isValidPhone(body.personalPhone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number (7–15 digits)' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Invalid tenant association' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { phone: body.personalPhone.trim() },
    });

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { name: body.businessName.trim() },
    });

    await prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        businessEmail: body.businessEmail?.trim() || null,
        businessPhone: body.businessPhone?.trim() || null,
        businessAddress: body.businessAddress?.trim() || null,
        businessCity: body.businessCity?.trim() || null,
        customDomain: body.website?.trim() || null,
        emailFooter: body.description?.trim() ? `\n\n${body.description.trim()}` : null,
      },
      update: {
        businessEmail: body.businessEmail?.trim() || null,
        businessPhone: body.businessPhone?.trim() || null,
        businessAddress: body.businessAddress?.trim() || null,
        businessCity: body.businessCity?.trim() || null,
        customDomain: body.website?.trim() || null,
        emailFooter: body.description?.trim() ? `\n\n${body.description.trim()}` : null,
      },
    });

    const primaryBranchId = await ensurePrimaryBranchForTenant(tenantId);
    if (primaryBranchId) {
      await prisma.user.update({
        where: { id: userId },
        data: { defaultBranchId: primaryBranchId },
      });
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: 'BUSINESS_SETUP',
          entityType: 'TENANT',
          entityId: tenantId,
          userId,
          details: JSON.stringify({
            businessName: body.businessName,
            businessEmail: body.businessEmail,
            businessPhone: body.businessPhone,
            businessAddress: body.businessAddress,
            businessCity: body.businessCity,
            website: body.website,
            industry: body.industry,
            description: body.description,
          }),
          tenantId,
        },
      });
    } catch (auditErr) {
      console.warn('Business setup audit log skipped:', auditErr?.message || auditErr);
    }

    if (body.businessEmail?.trim() && body.businessEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      const taken = await prisma.user.findFirst({
        where: {
          email: { equals: body.businessEmail.trim(), mode: 'insensitive' },
          tenantId,
          id: { not: userId },
        },
      });

      if (!taken) {
        await prisma.user.update({
          where: { id: userId },
          data: { email: body.businessEmail.trim().toLowerCase() },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Business setup completed successfully',
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain,
      },
    });
  } catch (error) {
    console.error('Business setup error:', error);
    return NextResponse.json(
      { error: 'Failed to complete business setup. Please try again.' },
      { status: 500 }
    );
  }
}
