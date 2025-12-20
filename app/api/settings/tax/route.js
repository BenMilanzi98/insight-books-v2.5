// app/api/settings/tax/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch tax settings for the tenant
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Fetch tenant settings
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId }
    });
    
    if (!tenantSettings) {
      // Return default settings if no settings found
      return NextResponse.json({
        taxEnabled: true,
        defaultTaxRate: 16.5, // Default VAT rate in Malawi
        currencyCode: 'MWK'
      });
    }
    
    // Return tax-related settings
    return NextResponse.json({
      taxEnabled: tenantSettings.taxEnabled,
      defaultTaxRate: tenantSettings.defaultTaxRate,
      currencyCode: tenantSettings.currencyCode
    });
  } catch (error) {
    console.error('Error fetching tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax settings. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update tax settings
export async function PUT(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if user has permission to update settings
    if (user.role !== 'ADMIN' && user.role !== 'TENANT_ADMIN') {
      return NextResponse.json(
        { error: 'You do not have permission to update tax settings' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    
    // Validate inputs
    if (body.defaultTaxRate < 0 || body.defaultTaxRate > 100) {
      return NextResponse.json(
        { error: 'Tax rate must be between 0 and 100' },
        { status: 400 }
      );
    }
    
    // Update or create settings
    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      update: {
        taxEnabled: body.taxEnabled !== undefined ? body.taxEnabled : true,
        defaultTaxRate: body.defaultTaxRate !== undefined ? body.defaultTaxRate : 16.5,
        currencyCode: body.currencyCode || 'MWK'
      },
      create: {
        tenantId: user.tenantId,
        taxEnabled: body.taxEnabled !== undefined ? body.taxEnabled : true,
        defaultTaxRate: body.defaultTaxRate !== undefined ? body.defaultTaxRate : 16.5,
        currencyCode: body.currencyCode || 'MWK'
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'TAX_SETTINGS_UPDATED',
        entityType: 'TENANT_SETTINGS',
        entityId: settings.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          taxEnabled: settings.taxEnabled,
          defaultTaxRate: settings.defaultTaxRate,
          currencyCode: settings.currencyCode
        })
      }
    });
    
    return NextResponse.json({
      message: 'Tax settings updated successfully',
      settings: {
        taxEnabled: settings.taxEnabled,
        defaultTaxRate: settings.defaultTaxRate,
        currencyCode: settings.currencyCode
      }
    });
  } catch (error) {
    console.error('Error updating tax settings:', error);
    return NextResponse.json(
      { error: 'Failed to update tax settings. Please try again.' },
      { status: 500 }
    );
  }
}