import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { resolveHiddenPrimaryBranchId } from '@/lib/hiddenPrimaryBranch';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(request) {
  // Check for standard access (trial or paid subscription)
  const accessError = await requireStandardAccess(request);
  if (accessError) {
    return accessError;
  }

  const userItem = await getUserFromSession(request);
  if (!userItem) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userItem.id },
    include: {
      tenant: {
        include: { settings: true }
      }
    }
  });

  if (!user || !user.tenant) {
    return NextResponse.json({ message: 'Tenant not found' }, { status: 404 });
  }

  const t = user.tenant;
  
  console.log('Account API GET - Tenant data:', {
    id: t.id,
    name: t.name,
    logoUrl: t.logoUrl,
    faviconUrl: t.faviconUrl,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor
  });
  
  const response = {
    name: t.name,
    subdomain: t.subdomain,
    subscriptionPlan: t.subscriptionPlan,
    logoUrl: t.logoUrl,
    faviconUrl: t.faviconUrl,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    emailFooter: t.settings?.emailFooter || '',
    customDomain: t.settings?.customDomain || '',
    emailNotifications: t.settings?.emailNotifications || false,
    smsNotifications: t.settings?.smsNotifications || false,
    inAppNotifications: t.settings?.inAppNotifications || false
  };
  
  console.log('Account API GET - Response data:', response);
  
  return NextResponse.json(response);
}

export async function POST(request) {
  const userItem = await getUserFromSession(request);
  if (!userItem) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const name = formData.get("name");
    const emailFooter = formData.get("emailFooter");
    const logoFile = formData.get("logoUrl");
    const faviconFile = formData.get("faviconUrl");

    console.log('Account API - Received data:', {
      name,
      hasLogoFile: !!logoFile,
      hasFaviconFile: !!faviconFile,
      logoFileName: logoFile?.name,
      faviconFileName: faviconFile?.name
    });

    const tenantId = userItem.tenantId;

    // Save files manually (this is a simplified example)
    const uploadDir = path.join(process.cwd(), "public", "uploads", "tenants", tenantId);
    console.log('Account API - Upload directory:', uploadDir);
    
    await fs.mkdir(uploadDir, { recursive: true });
    console.log('Account API - Upload directory created/verified');

    const primaryBranchId = await resolveHiddenPrimaryBranchId(tenantId);
    let updateData = {
      name,
      primaryColor: formData.get("primaryColor"),
      secondaryColor: formData.get("secondaryColor"),
      ...(primaryBranchId ? { defaultBranchId: primaryBranchId } : {}),
    };

    const timestamp = Date.now(); // Milliseconds since epoch

    // Process logo
    if (logoFile && logoFile.size > 0) {
      console.log('Account API - Processing logo file:', logoFile.name, logoFile.size);
      
      const ext = path.extname(logoFile.name);
      const baseName = path.basename(logoFile.name, ext);
      const uniqueName = `${baseName}-${timestamp}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      console.log('Account API - Logo file path:', filePath);

      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);

      updateData.logoUrl = `/uploads/tenants/${tenantId}/${uniqueName}`;
      console.log('Account API - Logo URL set to:', updateData.logoUrl);
    }

    // Process favicon
    if (faviconFile && faviconFile.size > 0) {
      console.log('Account API - Processing favicon file:', faviconFile.name, faviconFile.size);
      
      const ext = path.extname(faviconFile.name);
      const baseName = path.basename(faviconFile.name, ext);
      const uniqueName = `${baseName}-${timestamp}${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      console.log('Account API - Favicon file path:', filePath);

      const arrayBuffer = await faviconFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);

      updateData.faviconUrl = `/uploads/tenants/${tenantId}/${uniqueName}`;
      console.log('Account API - Favicon URL set to:', updateData.faviconUrl);
    }

    console.log('Account API - Updating tenant with data:', updateData);

    // Check current tenant state before update
    const currentTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logoUrl: true, faviconUrl: true }
    });
    
    console.log('Account API - Current tenant before update:', currentTenant);

    // Update tenant in a separate transaction
    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: { id: true, name: true, logoUrl: true, faviconUrl: true }
    });

    console.log('Account API - Tenant updated successfully:', updatedTenant);
    console.log('Account API - Update comparison - Before:', currentTenant?.logoUrl, 'After:', updatedTenant.logoUrl);

    // Verify the tenant update was successful
    const verifyTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { logoUrl: true, faviconUrl: true }
    });

    console.log('Account API - Verification - logo URL in database:', verifyTenant?.logoUrl);
    console.log('Account API - Verification - favicon URL in database:', verifyTenant?.faviconUrl);

    // Update tenant settings synchronously to avoid transaction issues
    try {
      await prisma.tenantSettings.upsert({
        where: { tenantId },
        update: {
          emailFooter,
          customDomain: formData.get("customDomain"),
          emailNotifications: formData.get("emailNotifications") === "true",
          smsNotifications: formData.get("smsNotifications") === "true",
          inAppNotifications: formData.get("inAppNotifications") === "true"
        },
        create: {
          tenantId,
          emailFooter,
          customDomain: formData.get("customDomain"),
          emailNotifications: formData.get("emailNotifications") === "true",
          smsNotifications: formData.get("smsNotifications") === "true",
          inAppNotifications: formData.get("inAppNotifications") === "true"
        }
      });

      console.log('Account API - Settings updated successfully');
    } catch (settingsError) {
      console.error('Account API - Settings update failed:', settingsError);
      // Don't fail the entire request if settings update fails
    }

    // Return success immediately after tenant update
    const response = {
      message: "Account updated successfully",
      logoUrl: updatedTenant.logoUrl,
      faviconUrl: updatedTenant.faviconUrl,
      verifiedLogoUrl: verifyTenant?.logoUrl,
      verifiedFaviconUrl: verifyTenant?.faviconUrl
    };

    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Account API - Error:', error);
    return NextResponse.json({ 
      error: 'Failed to update account',
      details: error.message 
    }, { status: 500 });
  }
}
