// app/api/tenant/settings/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { ensureDefaultTaxAccountsForTenant } from '@/lib/taxAccountsInitialization';

// GET - Fetch tenant settings
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
    
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with this user' },
        { status: 400 }
      );
    }

    // Ensure default tax inflow/outflow GL accounts exist and set as tenant defaults if not already set
    try {
      await ensureDefaultTaxAccountsForTenant(user.tenantId, prisma, true);
    } catch (initErr) {
      console.warn('Tax accounts initialization (non-fatal):', initErr?.message || initErr);
    }
    
    // Fetch the tenant (without settings to avoid 500 if TenantSettings table/schema has issues)
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId }
    });
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Fetch settings separately so missing/wrong TenantSettings does not break the API
    let settings = null;
    try {
      settings = await prisma.tenantSettings.findUnique({
        where: { tenantId: user.tenantId }
      });
    } catch (settingsErr) {
      console.warn('Tenant settings GET: could not load TenantSettings:', settingsErr?.message || settingsErr);
    }
    
    // Combine tenant and settings data for the response
    const response = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      tpin: tenant.tpin ?? '',
      eisEnabled: tenant.eisEnabled ?? false,
      emailFooter: settings?.emailFooter,
      customDomain: settings?.customDomain,
      
      // Business Address Information for receipts
      businessAddress: settings?.businessAddress,
      businessCity: settings?.businessCity,
      businessPhone: settings?.businessPhone,
      businessEmail: settings?.businessEmail,
      buildingName: settings?.buildingName,
      receiptFooter: settings?.receiptFooter,
      defaultBankDetails: settings?.defaultBankDetails,
      taxInflowAccountId: settings?.taxInflowAccountId ?? null,
      taxOutflowAccountId: settings?.taxOutflowAccountId ?? null,
      
      // Notification settings
      emailNotifications: settings?.emailNotifications,
      smsNotifications: settings?.smsNotifications,
      inAppNotifications: settings?.inAppNotifications,
      dailyReports: settings?.dailyReports,
      weeklyReports: settings?.weeklyReports,
      monthlyReports: settings?.monthlyReports,
      invoiceReminders: settings?.invoiceReminders,
      lowStockAlerts: settings?.lowStockAlerts,
      paymentReceipts: settings?.paymentReceipts,
      expiryWarnDaysEarly: settings?.expiryWarnDaysEarly ?? 60,
      expiryWarnDaysUrgent: settings?.expiryWarnDaysUrgent ?? 7,
      
      // Additional settings 
      taxEnabled: settings?.taxEnabled,
      defaultTaxRate: settings?.defaultTaxRate,
      currencyCode: settings?.currencyCode,
      invoicePrefix: settings?.invoicePrefix,
      enabledModules: settings?.enabledModules,
    };
    
    console.log('Tenant Settings API GET - Tenant data from database:', {
      id: tenant.id,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl
    });
    
    console.log('Tenant Settings API GET - Response data:', response);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching tenant settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update tenant settings
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
    
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with this user' },
        { status: 400 }
      );
    }
    
    // Parse the request body
    const body = await request.json();

    // Only include defined values so Prisma doesn't receive undefined
    const omitUndefined = (obj) =>
      Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

    const tenantFields = omitUndefined({
      name: body.name,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      logoUrl: body.logoUrl,
      faviconUrl: body.faviconUrl,
      tpin: body.tpin !== undefined ? (body.tpin || null) : undefined,
    });

    const normalizePositiveInt = (value, fallbackUndefined = true) => {
      if (value === undefined) return fallbackUndefined ? undefined : null;
      if (value === null || value === '') return null;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
      return Math.min(365, Math.round(parsed));
    };

    const expiryWarnDaysEarly = normalizePositiveInt(body.expiryWarnDaysEarly);
    const expiryWarnDaysUrgent = normalizePositiveInt(body.expiryWarnDaysUrgent);

    const settingsFields = omitUndefined({
      emailFooter: body.emailFooter,
      customDomain: body.customDomain,
      businessAddress: body.businessAddress,
      businessCity: body.businessCity,
      businessPhone: body.businessPhone,
      businessEmail: body.businessEmail,
      buildingName: body.buildingName,
      receiptFooter: body.receiptFooter,
      defaultBankDetails: body.defaultBankDetails,
      taxInflowAccountId: body.taxInflowAccountId === '' ? null : body.taxInflowAccountId,
      taxOutflowAccountId: body.taxOutflowAccountId === '' ? null : body.taxOutflowAccountId,
      emailNotifications: body.emailNotifications,
      smsNotifications: body.smsNotifications,
      inAppNotifications: body.inAppNotifications,
      dailyReports: body.dailyReports,
      weeklyReports: body.weeklyReports,
      monthlyReports: body.monthlyReports,
      invoiceReminders: body.invoiceReminders,
      lowStockAlerts: body.lowStockAlerts,
      paymentReceipts: body.paymentReceipts,
      expiryWarnDaysEarly,
      expiryWarnDaysUrgent:
        expiryWarnDaysEarly != null &&
        expiryWarnDaysUrgent != null &&
        expiryWarnDaysUrgent > expiryWarnDaysEarly
          ? Math.max(1, Math.min(7, expiryWarnDaysEarly))
          : expiryWarnDaysUrgent,
    });

    if (Object.keys(tenantFields).length > 0) {
      await prisma.tenant.update({
        where: { id: user.tenantId },
        data: tenantFields
      });
    }

    const createPayload = {
      tenantId: user.tenantId,
      taxEnabled: true,
      defaultTaxRate: 0,
      currencyCode: 'MWK',
      invoicePrefix: 'INV',
      invoiceTemplate: 'default',
      enabledModules: ['invoicing', 'clients', 'expenses']
    };
    Object.assign(createPayload, settingsFields);

    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      update: settingsFields,
      create: createPayload
    });

    await prisma.auditLog.create({
      data: {
        action: 'TENANT_SETTINGS_UPDATED',
        entityType: 'TENANT',
        entityId: user.tenantId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          updatedFields: { ...tenantFields, ...settingsFields }
        })
      }
    });
    
    return NextResponse.json({
      message: 'Settings updated successfully',
      tenantId: user.tenantId
    });
  } catch (error) {
    console.error('Error updating tenant settings:', error);
    const message = process.env.NODE_ENV === 'development'
      ? (error?.message || String(error))
      : 'Failed to update settings. Please try again.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}