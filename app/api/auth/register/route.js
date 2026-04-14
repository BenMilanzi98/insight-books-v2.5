import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';
const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      tenantName, 
      subdomain, 
      referralCode, // New field for affiliate tracking
      ...otherFields 
    } = body;

    // Validate required fields
    if (!name || !email || !password || !tenantName) {
      return NextResponse.json(
        { success: false, error: 'Name, email, password, and tenant name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Check if tenant subdomain already exists
    if (subdomain) {
      const existingTenant = await prisma.tenant.findUnique({
        where: { subdomain }
      });

      if (existingTenant) {
        return NextResponse.json(
          { success: false, error: 'Subdomain already taken' },
          { status: 400 }
        );
      }
    }

    // Generate unique subdomain if not provided
    const finalSubdomain = subdomain || generateUniqueSubdomain(tenantName);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Start transaction for user, tenant, and affiliate tracking
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant first
      const newTenant = await tx.tenant.create({
        data: {
          name: tenantName,
          subdomain: finalSubdomain,
          status: 'active',
          subscriptionPlan: '1month'
        }
      });

      // Create user (main tenant / owner)
      const newUser = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          tenantId: newTenant.id,
          role: 'owner',
          ...otherFields
        }
      });

      // Main tenant user has access to all branches
      await tx.tenant.update({
        where: { id: newTenant.id },
        data: { ownerUserId: newUser.id }
      });

      // Create tenant settings
      await tx.tenantSettings.create({
        data: {
          tenantId: newTenant.id,
          businessEmail: email.toLowerCase(),
          currencyCode: 'MWK',
          timezone: 'Africa/Blantyre',
          dateFormat: 'DD/MM/YYYY',
          language: 'en'
        }
      });

      // Create initial subscription (trial)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30); // 30-day trial

      const newSubscription = await tx.accountSubscription.create({
        data: {
          tenantId: newTenant.id,
          plan: '1month',
          status: 'Pending',
          isActive: false,
          isTrial: true,
          trialStartDate: new Date(),
          trialEndDate: trialEndDate,
          expiresAt: trialEndDate,
          paymentMethod: 'trial',
          txRef: `TRIAL_${newTenant.id}_${Date.now()}`,
          amount: 0.00,
          currency: 'MWK'
        }
      });

      const { initializeNewTenantFinancialDefaults } = await import('@/lib/initializeNewTenantFinancialDefaults');
      await initializeNewTenantFinancialDefaults(newTenant.id, tx);

      // Handle affiliate tracking if referral code is provided
      let affiliateReferral = null;
      if (referralCode) {
        // Find affiliate by referral code
        const affiliate = await tx.affiliate.findUnique({
          where: { referralCode: referralCode.toUpperCase() }
        });

        if (affiliate && affiliate.status === 'active') {
          // Create affiliate referral record
          affiliateReferral = await tx.affiliateReferral.create({
            data: {
              affiliateId: affiliate.id,
              tenantId: newTenant.id,
              userId: newUser.id,
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
      }

      return {
        user: newUser,
        tenant: newTenant,
        subscription: newSubscription,
        affiliateReferral
      };
    });

    let token;
    try {
      token = jwt.sign(
        {
          userId: result.user.id,
          email: result.user.email,
          tenantId: result.tenant.id,
          role: result.user.role
        },
        getJwtSecret(),
        { expiresIn: '7d' }
      );
    } catch (signErr) {
      if (
        signErr?.message?.includes('JWT_SECRET') ||
        signErr?.message?.includes('production')
      ) {
        return NextResponse.json(
          { success: false, error: 'Server configuration error' },
          { status: 503 }
        );
      }
      throw signErr;
    }

    // Set cookie
    const response = NextResponse.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.tenant.id
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain
      },
      subscription: {
        id: result.subscription.id,
        plan: result.subscription.plan,
        isTrial: result.subscription.isTrial,
        trialEndDate: result.subscription.trialEndDate
      },
      affiliateReferral: result.affiliateReferral ? {
        id: result.affiliateReferral.id,
        status: result.affiliateReferral.status,
        referralCode: result.affiliateReferral.referralCode
      } : null
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to generate unique subdomain
function generateUniqueSubdomain(tenantName) {
  const base = tenantName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
  
  const timestamp = Date.now().toString().slice(-4);
  return `${base}${timestamp}`;
} 