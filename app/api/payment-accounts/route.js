import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { initializeDefaultPaymentAccounts } from '@/lib/paymentAccountInitialization';
import { ensurePaymentAccountCoaLink } from '@/lib/paymentAccountCoaLink';

// GET - List all payment accounts for the tenant
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Ensure system default payment accounts exist (e.g. Cash) for this tenant.
    await initializeDefaultPaymentAccounts(user.tenantId, prisma);

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where = {
      tenantId: user.tenantId,
      ...(activeOnly && { isActive: true })
    };

    let paymentAccounts = await prisma.paymentAccount.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' }, // System accounts first
        { name: 'asc' }
      ]
    });

    const needsLink = paymentAccounts.filter((p) => !p.coaAccountId);
    if (needsLink.length > 0) {
      for (const p of needsLink.slice(0, 50)) {
        try {
          await ensurePaymentAccountCoaLink(user.tenantId, p, prisma);
        } catch (e) {
          console.warn('payment-accounts COA link:', p.id, e?.message || e);
        }
      }
      paymentAccounts = await prisma.paymentAccount.findMany({
        where,
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' },
        ],
      });
    }

    return NextResponse.json({ 
      success: true, 
      paymentAccounts 
    });
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch payment accounts' }, { status: 500 });
  }
}

// POST - Create a new payment account
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Make sure the system account set exists even if this is the first request.
    await initializeDefaultPaymentAccounts(user.tenantId, prisma);

    const body = await request.json();
    const { name, accountType, reference, isActive = true } = body;

    // Validation
    if (!name || !accountType) {
      return NextResponse.json({ 
        error: 'Name and account type are required' 
      }, { status: 400 });
    }

    // Check if account with same name already exists for this tenant
    const existing = await prisma.paymentAccount.findUnique({
      where: {
        tenantId_name: {
          tenantId: user.tenantId,
          name: name.trim()
        }
      }
    });

    if (existing) {
      return NextResponse.json({ 
        error: 'Payment account with this name already exists' 
      }, { status: 400 });
    }

    // Create payment account
    let paymentAccount = await prisma.paymentAccount.create({
      data: {
        tenantId: user.tenantId,
        name: name.trim(),
        accountType,
        reference: reference?.trim() || null,
        isActive,
        isSystem: false // User-created accounts are not system accounts
      }
    });
    paymentAccount = await ensurePaymentAccountCoaLink(user.tenantId, paymentAccount, prisma);

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_ACCOUNT_CREATED',
        entityType: 'PAYMENT_ACCOUNT',
        entityId: paymentAccount.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: paymentAccount.name,
          accountType: paymentAccount.accountType
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      paymentAccount 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment account:', error);
    return NextResponse.json({ error: 'Failed to create payment account' }, { status: 500 });
  }
}

