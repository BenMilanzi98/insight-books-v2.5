import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@/lib/emailService';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      businessName, 
      paymentMethod, 
      bankDetails 
    } = body;

    // Validation
    if (!name || !email || !password || !businessName) {
      return NextResponse.json(
        { success: false, error: 'All required fields must be provided' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingAffiliate = await prisma.affiliate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingAffiliate) {
      return NextResponse.json(
        { success: false, error: 'An affiliate with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code
    let referralCode;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const existingCode = await prisma.affiliate.findUnique({
        where: { referralCode }
      });
      
      if (!existingCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate unique referral code. Please try again.' },
        { status: 500 }
      );
    }

    // Create affiliate account
    const affiliate = await prisma.affiliate.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        businessName,
        referralCode,
        paymentMethod,
        paymentDetails: paymentMethod === 'bank' ? JSON.stringify(bankDetails) : null,
        commissionRate: 20, // Default 20% commission rate
        status: 'active',
        totalReferrals: 0,
        totalSales: 0,
        totalCommissions: 0
      }
    });

    // Send welcome email to the affiliate
    try {
      const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://insightbooksafrica.com'}/affiliate/login`;
      
      const emailContent = {
        to: affiliate.email,
        subject: 'Welcome to InsightBooks Affiliate Program',
        template: 'affiliate-welcome',
        data: {
          name: affiliate.name,
          email: affiliate.email,
          password: password, // Use the original password they entered
          referralCode: affiliate.referralCode,
          loginUrl: loginUrl,
          commissionRate: affiliate.commissionRate
        }
      };

      await sendEmail(emailContent);
      console.log(`Welcome email sent to affiliate: ${affiliate.email}`);

    } catch (emailError) {
      console.error('Failed to send welcome email to affiliate:', emailError);
      // Continue with affiliate creation even if email fails
    }

    // Create audit log entry
    await prisma.adminAuditLog.create({
      data: {
        action: 'AFFILIATE_CREATED',
        entityType: 'AFFILIATE',
        entityId: affiliate.id,
        details: JSON.stringify({
          affiliateName: affiliate.name,
          email: affiliate.email,
          referralCode: affiliate.referralCode,
          businessName: affiliate.businessName
        }),
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate account created successfully',
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        referralCode: affiliate.referralCode,
        businessName: affiliate.businessName
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Affiliate signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create affiliate account' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 