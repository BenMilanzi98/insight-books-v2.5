import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  ALLOWED_PAYMENT_ACCOUNT_TYPES,
  PaymentGlSlotsExhaustedError,
} from '@/lib/paymentAccountCoaLink';
import { withoutPosTillFloatPaymentAccounts } from '@/lib/posTillFloatAccounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function safeInitializeDefaults(tenantId) {
  try {
    const { initializeDefaultPaymentAccounts } = await import('@/lib/paymentAccountInitialization');
    await initializeDefaultPaymentAccounts(tenantId, prisma);
  } catch (e) {
    console.warn('initializeDefaultPaymentAccounts failed (non-fatal):', e?.message || e);
  }
}

async function safeLinkCoa(tenantId, paymentAccount) {
  try {
    const { ensurePaymentAccountCoaLink } = await import('@/lib/paymentAccountCoaLink');
    await ensurePaymentAccountCoaLink(tenantId, paymentAccount, prisma);
  } catch (e) {
    console.warn('ensurePaymentAccountCoaLink failed (non-fatal):', paymentAccount?.id, e?.message || e);
  }
}

// GET - List all payment accounts for the tenant
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user.tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 400 });
    }

    await safeInitializeDefaults(user.tenantId);

    let activeOnly = false;
    try {
      const { searchParams } = new URL(request.url);
      activeOnly = searchParams.get('activeOnly') === 'true';
    } catch (_) {}

    const where = {
      tenantId: user.tenantId,
      ...(activeOnly && { isActive: true }),
    };

    let paymentAccounts = await prisma.paymentAccount.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    });
    paymentAccounts = withoutPosTillFloatPaymentAccounts(paymentAccounts);

    const { findPaymentAccountsNeedingLeafCoaMigration } = await import('@/lib/paymentAccountCoaLink');
    const needsLeafMigration = withoutPosTillFloatPaymentAccounts(
      await findPaymentAccountsNeedingLeafCoaMigration(user.tenantId, prisma)
    );
    const needsLink = paymentAccounts.filter((p) => !p.coaAccountId);
    const toCoaFix = [...new Map([...needsLink, ...needsLeafMigration].map((p) => [p.id, p])).values()];
    if (toCoaFix.length > 0) {
      for (const p of toCoaFix.slice(0, 80)) {
        await safeLinkCoa(user.tenantId, p);
      }
      paymentAccounts = withoutPosTillFloatPaymentAccounts(
        await prisma.paymentAccount.findMany({
          where,
          orderBy: [
            { isSystem: 'desc' },
            { name: 'asc' },
          ],
        })
      );
    }

    return NextResponse.json({ 
      success: true, 
      paymentAccounts 
    });
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    return NextResponse.json({
      error: 'Failed to fetch payment accounts',
      hint: error?.message?.slice(0, 300) || undefined,
      code: error?.code || undefined,
    }, { status: 500 });
  }
}

// POST - Create a new payment account
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user.tenantId) {
      return NextResponse.json({ error: 'No tenant associated with user' }, { status: 400 });
    }

    try {
      const { assertTenantCoaUnlocked } = await import('@/lib/coaTenantLock');
      await assertTenantCoaUnlocked(user.tenantId);
    } catch (lockErr) {
      if (lockErr?.code === 'COA_TENANT_LOCKED') {
        return NextResponse.json({ error: lockErr.message, code: lockErr.code }, { status: 423 });
      }
      throw lockErr;
    }

    await safeInitializeDefaults(user.tenantId);

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { name, accountType, reference, isActive = true, parentGlCode } = body || {};
    const trimmedName = String(name ?? '').trim();
    const trimmedType = String(accountType ?? '').trim();
    const trimmedParentGl = parentGlCode != null ? String(parentGlCode).trim() : '';
    const trimmedReference = reference != null ? String(reference).trim() : '';
    const normalizedReference = trimmedReference || null;

    if (!trimmedName || !trimmedType) {
      return NextResponse.json({ 
        error: 'Name and account type are required' 
      }, { status: 400 });
    }

    if (!ALLOWED_PAYMENT_ACCOUNT_TYPES.includes(trimmedType)) {
      return NextResponse.json(
        {
          error: `Invalid account type. Allowed: ${ALLOWED_PAYMENT_ACCOUNT_TYPES.join(', ')}`,
          code: 'INVALID_PAYMENT_ACCOUNT_TYPE',
        },
        { status: 400 }
      );
    }

    // Same name is allowed; account number must be present and unique for non-Cash accounts.
    if (trimmedType !== 'Cash' && !normalizedReference) {
      return NextResponse.json(
        {
          error: 'Account number / reference is required. Multiple accounts may share a name if the account number differs.',
          code: 'PAYMENT_ACCOUNT_REFERENCE_REQUIRED',
        },
        { status: 400 }
      );
    }

    if (normalizedReference) {
      const refExists = await prisma.paymentAccount.findFirst({
        where: {
          tenantId: user.tenantId,
          reference: normalizedReference,
        },
        select: { id: true, name: true },
      });
      if (refExists) {
        return NextResponse.json(
          {
            error: `Account number "${normalizedReference}" is already used by "${refExists.name}". Use a different account number.`,
            code: 'PAYMENT_ACCOUNT_REFERENCE_DUPLICATE',
          },
          { status: 409 }
        );
      }
    }

    const { resolvePaymentParentGlCode } = await import('@/lib/paymentGlChannels.js');
    const resolvedParent =
      trimmedType === 'Cash'
        ? null
        : resolvePaymentParentGlCode({
            accountType: trimmedType,
            name: trimmedName,
            parentGlCode: trimmedParentGl || null,
          });

    if (['Bank', 'Mobile Money', 'Wallet', 'POS Terminal'].includes(trimmedType) && !resolvedParent) {
      return NextResponse.json(
        {
          error:
            'Select a bank or mobile money channel (1131–1138, 1140, or 1141). The GL sub-account will be created automatically under that parent.',
          code: 'PAYMENT_PARENT_GL_REQUIRED',
        },
        { status: 400 }
      );
    }

    const { ensurePaymentAccountCoaLink } = await import('@/lib/paymentAccountCoaLink');

    let paymentAccount;
    try {
      paymentAccount = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentAccount.create({
          data: {
            tenant: { connect: { id: user.tenantId } },
            name: trimmedName,
            accountType: trimmedType,
            reference: normalizedReference,
            isActive: Boolean(isActive),
            isSystem: false,
          },
        });
        return ensurePaymentAccountCoaLink(
          user.tenantId,
          { ...created, parentGlCode: resolvedParent },
          tx
        );
      });
    } catch (linkErr) {
      if (linkErr instanceof PaymentGlSlotsExhaustedError) {
        return NextResponse.json(
          { error: linkErr.message, code: linkErr.code },
          { status: 400 }
        );
      }
      const linkMessage = String(linkErr?.message || '');
      if (linkMessage.includes('Argument `tenant` is missing')) {
        return NextResponse.json(
          {
            error: 'Failed to create payment account: tenant relation is required.',
            code: 'PRISMA_TENANT_RELATION',
            hint: linkMessage.slice(0, 300),
          },
          { status: 400 }
        );
      }
      console.warn('COA link failed for new payment account:', linkMessage || linkErr);
      throw linkErr;
    }

    try {
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
    } catch (auditErr) {
      console.warn('Audit log failed for payment account creation:', auditErr?.message || auditErr);
    }

    return NextResponse.json({ 
      success: true, 
      paymentAccount 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment account:', error);
    const code = error?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'That account number is already in use, or a matching ledger code already exists. Use a different account number and try again.',
          code: 'PAYMENT_ACCOUNT_DUPLICATE',
        },
        { status: 409 }
      );
    }
    if (code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid chart-of-accounts link. Check that your asset accounts are set up.', code: 'P2003' },
        { status: 400 }
      );
    }
    return NextResponse.json({
      error: 'Failed to create payment account',
      hint: error?.message?.slice(0, 300) || undefined,
      code: code || undefined,
    }, { status: 500 });
  }
}
