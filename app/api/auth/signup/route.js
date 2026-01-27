import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { sendOTPEmail } from '@/lib/email';
import { generateFullPermissions } from '@/lib/permissionsMap';
import { initializeTenantTrial } from '@/lib/subscriptionService';

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
      !body.password ||
      !body.selectedPlan
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
   
    
    // Generate OTP (6-digit number)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Set OTP expiry (10 minutes from now)
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
   
    // Create tenant, roles and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: body.businessName,
          subdomain: subdomain,
          // Set subscription based on the selected plan
          subscriptionPlan: body.selectedPlan === '1year' ? '1year' : 
                           body.selectedPlan === '3months' ? '3months' : 
                           body.selectedPlan === '1month' ? '1month' : '1month',
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
    
      const fullAdminPermissions = generateFullPermissions(); 
      
    
      const adminRole =  await tx.role.upsert({
        where: {
          name_tenantId: {
            name: 'Admin',
            tenantId: tenant.id
          }
        },
        update: {
          permissions: fullAdminPermissions
        },
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
      
   
     
      // Create user with admin role, properly hashed password, and OTP
      const user = await tx.user.create({
        data: {
          name: body.fullName,
          email: body.email,
          password: hashedPassword,
          phone: body.phone,
          roleId: adminRole.id, // Use the adminRole ID instead of 'ADMIN' string
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
    
    // Send OTP email
    let emailSent = false;
    let emailError = null;
    
    try {
      console.log(`Attempting to send OTP email to: ${body.email}`);
      const emailResult = await sendOTPEmail(
        body.email, 
        otp, 
        body.fullName
      );
      
      if (emailResult.success) {
        emailSent = true;
        console.log('OTP email sent successfully:', emailResult.messageId);
      } else {
        emailError = emailResult.error;
        console.error('OTP email failed:', emailResult.error);
      }
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      emailError = emailError.message;
    }
   
    // Return response based on email status
    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: 'Account created successfully. Please check your email for the verification code.',
        userId: result.user.id,
        email: result.user.email,
        requiresVerification: true,
        referralProcessed: !!affiliate, // Indicate if referral was processed
        referralCode: affiliate ? referralCode : null, // Include referral code if processed
        trial: {
          startDate: trialSubscription.trialStartDate.toISOString(),
          endDate: trialSubscription.trialEndDate.toISOString(),
          daysRemaining: 3
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          subdomain: result.tenant.subdomain
        }
      }, { status: 201 });
    } else {
      // Account created but OTP email failed
      return NextResponse.json({
        success: true,
        message: 'Account created but verification email failed to send. Please contact support.',
        userId: result.user.id,
        email: result.user.email,
        requiresVerification: true,
        emailError: emailError,
        referralProcessed: !!affiliate, // Indicate if referral was processed
        referralCode: affiliate ? referralCode : null, // Include referral code if processed
        trial: {
          startDate: trialSubscription.trialStartDate.toISOString(),
          endDate: trialSubscription.trialEndDate.toISOString(),
          daysRemaining: 3
        },
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          subdomain: result.tenant.subdomain
        }
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}