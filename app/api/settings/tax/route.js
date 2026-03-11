// app/api/settings/tax/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { ensureDefaultTaxAccountsForTenant } from '@/lib/taxAccountsInitialization';

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

    // Ensure default tax inflow/outflow GL accounts exist and set as tenant defaults if not already set
    try {
      await ensureDefaultTaxAccountsForTenant(user.tenantId, prisma, true);
    } catch (initErr) {
      console.warn('Tax accounts initialization (non-fatal):', initErr?.message || initErr);
    }
    
    // Fetch tenant settings (may now have default tax account IDs set)
    const tenantSettings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId }
    });
    
    if (!tenantSettings) {
      // Return default settings if no settings found
      return NextResponse.json({
        taxEnabled: true,
        defaultTaxRate: 16.5, // Default VAT rate in Malawi
        currencyCode: 'MWK',
        taxInflowAccountId: null,
        taxOutflowAccountId: null,
        defaultTaxInflowAccount: null,
        defaultTaxOutflowAccount: null
      });
    }

    // Resolve default account details for display (e.g. on /tax-accounts)
    let defaultTaxInflowAccount = null;
    let defaultTaxOutflowAccount = null;
    if (tenantSettings.taxInflowAccountId) {
      const acc = await prisma.account.findFirst({
        where: { id: tenantSettings.taxInflowAccountId, tenantId: user.tenantId, isActive: true },
        select: { id: true, accountCode: true, accountName: true }
      });
      if (acc) defaultTaxInflowAccount = { id: acc.id, accountCode: acc.accountCode, accountName: acc.accountName };
    }
    if (tenantSettings.taxOutflowAccountId) {
      const acc = await prisma.account.findFirst({
        where: { id: tenantSettings.taxOutflowAccountId, tenantId: user.tenantId, isActive: true },
        select: { id: true, accountCode: true, accountName: true }
      });
      if (acc) defaultTaxOutflowAccount = { id: acc.id, accountCode: acc.accountCode, accountName: acc.accountName };
    }
    
    // Return tax-related settings including default tax flow accounts
    return NextResponse.json({
      taxEnabled: tenantSettings.taxEnabled,
      defaultTaxRate: tenantSettings.defaultTaxRate,
      currencyCode: tenantSettings.currencyCode,
      taxInflowAccountId: tenantSettings.taxInflowAccountId ?? null,
      taxOutflowAccountId: tenantSettings.taxOutflowAccountId ?? null,
      defaultTaxInflowAccount,
      defaultTaxOutflowAccount
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
    
    const updateData = {
      taxEnabled: body.taxEnabled !== undefined ? body.taxEnabled : true,
      defaultTaxRate: body.defaultTaxRate !== undefined ? body.defaultTaxRate : 16.5,
      currencyCode: body.currencyCode || 'MWK',
    };
    if (body.taxInflowAccountId !== undefined) {
      updateData.taxInflowAccountId = body.taxInflowAccountId || null;
    }
    if (body.taxOutflowAccountId !== undefined) {
      updateData.taxOutflowAccountId = body.taxOutflowAccountId || null;
    }

    // Update or create settings
    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      update: updateData,
      create: {
        tenantId: user.tenantId,
        ...updateData,
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
          currencyCode: settings.currencyCode,
          taxInflowAccountId: settings.taxInflowAccountId ?? null,
          taxOutflowAccountId: settings.taxOutflowAccountId ?? null
        })
      }
    });
    
    return NextResponse.json({
      message: 'Tax settings updated successfully',
      settings: {
        taxEnabled: settings.taxEnabled,
        defaultTaxRate: settings.defaultTaxRate,
        currencyCode: settings.currencyCode,
        taxInflowAccountId: settings.taxInflowAccountId ?? null,
        taxOutflowAccountId: settings.taxOutflowAccountId ?? null
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