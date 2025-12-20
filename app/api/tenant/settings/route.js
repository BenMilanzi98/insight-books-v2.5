// app/api/tenant/settings/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    
    // Fetch the tenant and its settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        settings: true
      }
    });
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
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
      emailFooter: tenant.settings?.emailFooter,
      customDomain: tenant.settings?.customDomain,
      
      // Business Address Information for receipts
      businessAddress: tenant.settings?.businessAddress,
      businessCity: tenant.settings?.businessCity,
      businessPhone: tenant.settings?.businessPhone,
      businessEmail: tenant.settings?.businessEmail,
      buildingName: tenant.settings?.buildingName,
      receiptFooter: tenant.settings?.receiptFooter,
      
      // Notification settings
      emailNotifications: tenant.settings?.emailNotifications,
      smsNotifications: tenant.settings?.smsNotifications,
      inAppNotifications: tenant.settings?.inAppNotifications,
      dailyReports: tenant.settings?.dailyReports,
      weeklyReports: tenant.settings?.weeklyReports,
      monthlyReports: tenant.settings?.monthlyReports,
      invoiceReminders: tenant.settings?.invoiceReminders,
      lowStockAlerts: tenant.settings?.lowStockAlerts,
      paymentReceipts: tenant.settings?.paymentReceipts,
      
      // Additional settings 
      taxEnabled: tenant.settings?.taxEnabled,
      defaultTaxRate: tenant.settings?.defaultTaxRate,
      currencyCode: tenant.settings?.currencyCode,
      invoicePrefix: tenant.settings?.invoicePrefix,
      enabledModules: tenant.settings?.enabledModules,
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
    
    // Split into tenant fields and settings fields
    const tenantFields = {
      name: body.name,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      logoUrl: body.logoUrl,
      faviconUrl: body.faviconUrl,
    };
    
    const settingsFields = {
      emailFooter: body.emailFooter,
      customDomain: body.customDomain,
      
      // Business Address Information for receipts
      businessAddress: body.businessAddress,
      businessCity: body.businessCity,
      businessPhone: body.businessPhone,
      businessEmail: body.businessEmail,
      buildingName: body.buildingName,
      receiptFooter: body.receiptFooter,
      
      // Notification settings
      emailNotifications: body.emailNotifications,
      smsNotifications: body.smsNotifications,
      inAppNotifications: body.inAppNotifications,
      dailyReports: body.dailyReports,
      weeklyReports: body.weeklyReports,
      monthlyReports: body.monthlyReports,
      invoiceReminders: body.invoiceReminders,
      lowStockAlerts: body.lowStockAlerts,
      paymentReceipts: body.paymentReceipts,
    };
    
    // Update the tenant record
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: tenantFields
    });
    
    // Update or create the settings record
    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      update: settingsFields,
      create: {
        ...settingsFields,
        tenantId: user.tenantId,
        // Set defaults for required fields
        taxEnabled: true,
        defaultTaxRate: 0,
        currencyCode: 'MWK',
        invoicePrefix: 'INV',
        invoiceTemplate: 'default',
        enabledModules: ['invoicing', 'clients', 'expenses']
      }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'TENANT_SETTINGS_UPDATED',
        entityType: 'TENANT',
        entityId: user.tenantId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          updatedFields: {
            ...tenantFields,
            ...settingsFields
          }
        })
      }
    });
    
    return NextResponse.json({
      message: 'Settings updated successfully',
      tenantId: user.tenantId
    });
  } catch (error) {
    console.error('Error updating tenant settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings. Please try again.' },
      { status: 500 }
    );
  }
}