import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@/lib/emailService';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('search') || '';

    // Build where clause
    let whereClause = {};
    if (status !== 'all') {
      whereClause.status = status;
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { referralCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch affiliates from database
    const affiliates = await prisma.affiliate.findMany({
      where: whereClause,
      include: {
        referrals: {
          select: {
            id: true,
            commissionAmount: true,
            status: true,
            createdAt: true
          }
        },
        payouts: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform data for frontend
    const transformedAffiliates = affiliates.map(affiliate => {
      const totalSales = affiliate.referrals
        .filter(ref => ref.status === 'completed')
        .reduce((sum, ref) => sum + (ref.commissionAmount || 0), 0);
      
      // Use commission rate from schema or default
      const commissionRate = affiliate.commissionRate || 30; // Default 30% commission
      const totalCommissions = totalSales * (commissionRate / 100);
      
      const pendingPayouts = affiliate.payouts
        .filter(payout => payout.status === 'pending')
        .reduce((sum, payout) => sum + (payout.amount || 0), 0);

      return {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        businessName: affiliate.businessName || '',
        affiliateCode: affiliate.referralCode,
        status: affiliate.status,
        commissionRate: commissionRate,
        paymentMethod: affiliate.paymentMethod,
        bankDetails: affiliate.paymentDetails, // Using paymentDetails from schema
        totalSales: totalSales,
        totalCommissions: totalCommissions,
        pendingPayouts: pendingPayouts,
        referralCount: affiliate.referrals.length,
        hasPassword: !!affiliate.password, // Check if affiliate has a password set
        createdAt: affiliate.createdAt,
        updatedAt: affiliate.updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      affiliates: transformedAffiliates
    });

  } catch (error) {
    console.error('Error fetching affiliates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch affiliates' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, commissionRate = 30, status = 'active', paymentMethod = 'bank', bankDetails = {} } = body;

    // Validation
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
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

    // Generate a temporary password for the affiliate
    const tempPassword = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create affiliate with default commission rate and password
    const affiliate = await prisma.affiliate.create({
      data: {
        name,
        email,
        password: hashedPassword,
        businessName: name, // Use name as business name by default
        paymentMethod,
        paymentDetails: paymentMethod === 'bank' ? JSON.stringify(bankDetails) : JSON.stringify({}),
        status,
        referralCode: referralCode,
        commissionRate: commissionRate || 20,
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
          password: tempPassword,
          referralCode: affiliate.referralCode,
          loginUrl: loginUrl,
          commissionRate: affiliate.commissionRate
        }
      };

      await sendEmail(emailContent);
      console.log(`Welcome email sent to affiliate: ${affiliate.email}`);

      // Create audit log for email sent
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'AFFILIATE_WELCOME_EMAIL_SENT',
          entityType: 'AFFILIATE',
          entityId: affiliate.id,
          details: JSON.stringify({
            affiliateName: affiliate.name,
            email: affiliate.email,
            emailType: 'welcome-email'
          }),
          timestamp: new Date()
        }
      });

    } catch (emailError) {
      console.error('Failed to send welcome email to affiliate:', emailError);
      
      // Create audit log for email failure
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'AFFILIATE_WELCOME_EMAIL_FAILED',
          entityType: 'AFFILIATE',
          entityId: affiliate.id,
          details: JSON.stringify({
            affiliateName: affiliate.name,
            email: affiliate.email,
            error: emailError.message
          }),
          timestamp: new Date()
        }
      });
    }

    // Create audit log entry for affiliate creation
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'AFFILIATE_CREATED',
        entityType: 'AFFILIATE',
        entityId: affiliate.id,
        details: JSON.stringify({
          affiliateName: affiliate.name,
          email: affiliate.email,
          referralCode: affiliate.referralCode,
          commissionRate: affiliate.commissionRate
        }),
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Affiliate created successfully',
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        referralCode: affiliate.referralCode,
        status: affiliate.status,
        commissionRate: affiliate.commissionRate
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating affiliate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create affiliate' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 