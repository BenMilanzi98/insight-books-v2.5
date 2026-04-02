import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { generateFullPermissions } from '@/lib/permissionsMap';
import { initializeTenantTrial } from '@/lib/subscriptionService';
import { seedDefaultRolesForTenant } from '@/lib/seedTenantRoles';
import { fetchUserBranchAccessContext, computeAllowedBranchIds } from '@/lib/branchAccess';
import { getSessionCookieOptions } from '@/lib/sessionCookie';

// Ensure environment variables are loaded
import 'dotenv/config';

export async function POST(request) {
  try {
    const body = await request.json();
   
    // Basic validation
    if (
      !body.businessName ||
      !body.fullName ||
      !body.email ||
      !body.phone ||
      !body.password
    ) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(body.phone.replace(/\s/g, ''))) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
        { status: 400 }
      );
    }

    // Handle referral code if present
    const referralCode = body.referralCode;
    let affiliate = null;
    if (referralCode) {
      affiliate = await prisma.affiliate.findUnique({
        where: { referralCode: referralCode.toUpperCase() }
      });
      
      if (!affiliate || affiliate.status !== 'active') {
        return NextResponse.json(
          { error: 'Invalid or inactive referral code' },
          { status: 400 }
        );
      }
    }
   
    // Generate subdomain from business name
    let subdomain = body.businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
   
    // Check if subdomain exists, add random number if it does
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });
   
    if (existingTenant) {
      // Add a random number to make it unique
      subdomain = `${subdomain}${Math.floor(Math.random() * 1000)}`;
    }
   
    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: body.email }
    });
   
    if (existingUser) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 400 }
      );
    }
    
    // Hash the password with bcrypt
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(body.password, 10);
    } catch (hashError) {
      console.error('Password hashing error:', hashError);
      return NextResponse.json(
        { error: 'Error creating account. Please try again.' },
        { status: 500 }
      );
    }
   
    // Create tenant, roles and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: body.businessName,
          subdomain: subdomain,
          subscriptionPlan: body.selectedPlan || 'trial',
          status: 'active',
        }
      });
     
      // Create tenant settings
      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          currencyCode: 'MWK', // Malawian Kwacha based on the pricing in the UI
          taxEnabled: true,
          defaultTaxRate: 0,
          invoicePrefix: 'INV',
          enabledModules: ['invoicing', 'clients', 'expenses', 'inventory', 'hr']
        }
      });
    
      // Seed role templates for the tenant (Owner/Manager/Sales/Inventory/Accountant/ReportsOnly)
      const seededRoles = await seedDefaultRolesForTenant(tenant.id, tx);
      const ownerRole = seededRoles.Owner;

      // Keep legacy Admin role for backward compatibility (existing installs/users may reference it)
      const fullAdminPermissions = generateFullPermissions();
      const adminRole = await tx.role.upsert({
        where: {
          name_tenantId: { name: 'Admin', tenantId: tenant.id }
        },
        update: { permissions: fullAdminPermissions },
        create: {
          name: 'Admin',
          description: 'Full access to all tenant features',
          tenantId: tenant.id,
          permissions: fullAdminPermissions
        }
      });
      
      // Create default roles for the tenant
      // const adminRole = await tx.role.create({
      //   data: {
      //     name: 'Admin',
      //     description: 'Full access to all tenant features',
      //     tenantId: tenant.id,
      //     permissions:  fullAdminPermissions
      //   }
      // });
      
   
     
      // Create user with owner-level role (main tenant / owner)
      const user = await tx.user.create({
        data: {
          name: body.fullName,
          email: body.email,
          password: hashedPassword,
          phone: body.phone,
          roleId: ownerRole?.id || adminRole.id,
          tenantId: tenant.id,
          isActive: true,
          isEmailVerified: false, // Set to false until OTP is verified
          otpCode: otp,
          otpExpiry: otpExpiry,
          tenants: {
            connect: { id: tenant.id }
          }
        }
      });

      // Create per-tenant membership record (role per business)
      try {
        await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            roleId: ownerRole?.id || adminRole.id,
            status: 'active',
          }
        });
      } catch (e) {
        // Backward compatible if table isn't deployed yet
      }

      // Main tenant user has access to all branches
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: user.id }
      });

      // Handle affiliate referral if present
      if (affiliate) {
        await tx.affiliateReferral.create({
          data: {
            affiliateId: affiliate.id,
            tenantId: tenant.id,
            userId: user.id,
            referralCode: referralCode.toUpperCase(),
            status: 'pending', // Will be updated to 'completed' when subscription is paid
            commissionAmount: 0, // Will be calculated when subscription is paid
            clickTimestamp: new Date(),
            registrationTimestamp: new Date()
          }
        });

        // Update affiliate stats
        await tx.affiliate.update({
          where: { id: affiliate.id },
          data: {
            totalReferrals: { increment: 1 },
            updatedAt: new Date()
          }
        });
      }
     
      const { initializeNewTenantFinancialDefaults } = await import('@/lib/initializeNewTenantFinancialDefaults');
      await initializeNewTenantFinancialDefaults(tenant.id, tx);

      // Log the signup
      await tx.auditLog.create({
        data: {
          action: 'SIGNUP',
          entityType: 'TENANT',
          entityId: tenant.id,
          userId: user.id,
          details: JSON.stringify({
            tenantName: tenant.name,
            subdomain: tenant.subdomain,
            userEmail: user.email,
            plan: body.selectedPlan
          }),
          tenantId: tenant.id
        }
      });
     
      return { tenant, user };
    });
    
    // Initialize trial subscription for the new tenant
    // Note: While a trial is created, subscription payment is required for full business functionality
    const trialSubscription = await initializeTenantTrial(result.tenant.id);

    // Log the user in immediately (same session shape as POST /api/auth/login)
    const userWithRole = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true,
          },
        },
      },
    });

    if (!userWithRole) {
      console.error('Signup: user missing after transaction');
      return NextResponse.json(
        { error: 'Account created but session could not be started. Please log in.' },
        { status: 500 }
      );
    }

    let initialBranchId = null;
    try {
      const ctx = await fetchUserBranchAccessContext(userWithRole.id, userWithRole.tenantId);
      const { allowedBranchIds } = computeAllowedBranchIds({
        userId: userWithRole.id,
        tenantId: userWithRole.tenantId,
        roleName: userWithRole.role ? userWithRole.role.name : null,
        contextLoadFailed: ctx.contextLoadFailed,
        tenantBranchCount: ctx.tenantBranchCount,
        userBranches: ctx.userBranches,
        tenant: ctx.tenant,
      });
      const preferredDefault =
        ctx.defaultBranchId ?? ctx.tenant?.defaultBranchId ?? null;
      if (allowedBranchIds == null) {
        initialBranchId = preferredDefault ?? null;
      } else if (allowedBranchIds.length > 0) {
        initialBranchId =
          preferredDefault && allowedBranchIds.includes(preferredDefault)
            ? preferredDefault
            : allowedBranchIds[0];
      } else {
        initialBranchId = null;
      }
    } catch (branchError) {
      console.error('Signup branch selection failed (non-fatal):', branchError?.message || branchError);
      initialBranchId = null;
    }

    const sessionData = {
      userId: userWithRole.id,
      tenantId: userWithRole.tenantId,
      branchId: initialBranchId,
      role: userWithRole.role ? userWithRole.role.name : null,
    };
    const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session',
      value: session,
      ...getSessionCookieOptions(),
    });

    try {
      await prisma.user.update({
        where: { id: userWithRole.id },
        data: { lastLogin: new Date() },
      });
    } catch (_) {
      /* non-fatal */
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully.',
        requiresVerification: false,
        token: session,
        userId: result.user.id,
        email: result.user.email,
        referralProcessed: !!affiliate,
        referralCode: affiliate ? referralCode : null,
        trial: {
          startDate: trialSubscription.trialStartDate.toISOString(),
          endDate: trialSubscription.trialEndDate.toISOString(),
          daysRemaining: 2,
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          subdomain: result.tenant.subdomain,
        },
        user: {
          id: userWithRole.id,
          name: userWithRole.name,
          email: userWithRole.email,
          isEmailVerified: true,
          role: userWithRole.role,
          tenant: userWithRole.tenant
            ? {
                id: userWithRole.tenant.id,
                name: userWithRole.tenant.name,
                subdomain: userWithRole.tenant.subdomain,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}