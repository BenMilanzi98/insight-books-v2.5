import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId || !body.tenantId || !body.businessName || !body.personalPhone) {
      return NextResponse.json(
        { error: 'User ID, Tenant ID, Business Name, and Personal Phone Number are required' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(body.personalPhone.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 }
      );
    }

    // Verify user and tenant exist
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      include: { tenant: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.tenantId !== body.tenantId) {
      return NextResponse.json(
        { error: 'Invalid tenant association' },
        { status: 403 }
      );
    }

    // Update user with personal phone number
    await prisma.user.update({
      where: { id: body.userId },
      data: {
        phone: body.personalPhone
      }
    });

    // Update tenant with business information
    const updatedTenant = await prisma.tenant.update({
      where: { id: body.tenantId },
      data: {
        name: body.businessName,
        // Update settings with business information
        settings: {
          update: {
            businessEmail: body.businessEmail || null,
            businessPhone: body.businessPhone || null,
            businessAddress: body.businessAddress || null,
            businessCity: body.businessCity || null,
            // Store additional business info in settings
            customDomain: body.website || null,
            // Add business info to email footer
            emailFooter: body.description ? `\n\n${body.description}` : null
          }
        }
      },
      include: {
        settings: true
      }
    });

    // Create audit log for business setup
    await prisma.auditLog.create({
      data: {
        action: 'BUSINESS_SETUP',
        entityType: 'TENANT',
        entityId: body.tenantId,
        userId: body.userId,
        details: JSON.stringify({
          businessName: body.businessName,
          businessEmail: body.businessEmail,
          businessPhone: body.businessPhone,
          businessAddress: body.businessAddress,
          businessCity: body.businessCity,
          website: body.website,
          industry: body.industry,
          description: body.description
        }),
        tenantId: body.tenantId
      }
    });

    // If business email is provided, update user's email if it's different
    if (body.businessEmail && body.businessEmail !== user.email) {
      // Check if the business email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: body.businessEmail }
      });

      if (!existingUser) {
        await prisma.user.update({
          where: { id: body.userId },
          data: { email: body.businessEmail }
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Business setup completed successfully',
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain
      }
    });

  } catch (error) {
    console.error('Business setup error:', error);
    return NextResponse.json(
      { error: 'Failed to complete business setup. Please try again.' },
      { status: 500 }
    );
  }
} 