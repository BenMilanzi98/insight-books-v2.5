import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  ALLOWED_PAYMENT_ACCOUNT_TYPES,
  PaymentGlSlotsExhaustedError,
} from '@/lib/paymentAccountCoaLink';
import {
  isPaymentGlChildCode,
  isPaymentGlParentCode,
  resolvePaymentParentGlCode,
} from '@/lib/paymentGlChannels.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function inferParentGlCodeFromCoaAccount(tenantId, coaAccountId, tx = prisma) {
  if (!coaAccountId) return null;
  const acc = await tx.account.findFirst({
    where: { id: coaAccountId, tenantId },
    select: { accountCode: true, code: true },
  });
  if (!acc) return null;
  const code = String(acc.accountCode ?? acc.code ?? '').trim();
  if (isPaymentGlParentCode(code)) return code;
  if (isPaymentGlChildCode(code)) return code.split('-')[0];
  return null;
}

// GET - Get a specific payment account
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    const paymentAccount = await prisma.paymentAccount.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                amount: true,
                paymentDate: true,
                type: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10 // Last 10 allocations
        }
      }
    });

    if (!paymentAccount) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, paymentAccount });
  } catch (error) {
    console.error('Error fetching payment account:', error);
    return NextResponse.json({ error: 'Failed to fetch payment account' }, { status: 500 });
  }
}

// PUT - Update a payment account
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.tenantId) {
      try {
        const { assertTenantCoaUnlocked } = await import('@/lib/coaTenantLock');
        await assertTenantCoaUnlocked(user.tenantId);
      } catch (lockErr) {
        if (lockErr?.code === 'COA_TENANT_LOCKED') {
          return NextResponse.json({ error: lockErr.message, code: lockErr.code }, { status: 423 });
        }
        throw lockErr;
      }
    }

    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { name, accountType, reference, isActive, parentGlCode } = body || {};

    if (accountType !== undefined && !ALLOWED_PAYMENT_ACCOUNT_TYPES.includes(String(accountType).trim())) {
      return NextResponse.json(
        {
          error: `Invalid account type. Allowed: ${ALLOWED_PAYMENT_ACCOUNT_TYPES.join(', ')}`,
          code: 'INVALID_PAYMENT_ACCOUNT_TYPE',
        },
        { status: 400 }
      );
    }

    // Find the payment account
    const existing = await prisma.paymentAccount.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    // System accounts (Cash) cannot be deleted or disabled
    if (existing.isSystem && isActive === false) {
      return NextResponse.json({ 
        error: 'System payment accounts cannot be deactivated' 
      }, { status: 400 });
    }

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== existing.name) {
      const nameExists = await prisma.paymentAccount.findUnique({
        where: {
          tenantId_name: {
            tenantId: user.tenantId,
            name: name.trim()
          }
        }
      });

      if (nameExists && nameExists.id !== id) {
        return NextResponse.json({ 
          error: 'Payment account with this name already exists' 
        }, { status: 400 });
      }
    }

    // Update payment account (clear GL link when type changes so we can attach under the new main)
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (accountType !== undefined) updateData.accountType = accountType;
    if (reference !== undefined) updateData.reference = reference?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (
      accountType !== undefined &&
      String(accountType).trim() !== String(existing.accountType || '').trim()
    ) {
      updateData.coaAccountId = null;
    }

    const effectiveType =
      accountType !== undefined ? String(accountType).trim() : String(existing.accountType || '').trim();
    const effectiveName = name !== undefined ? String(name).trim() : existing.name;
    const typeChanged =
      accountType !== undefined &&
      String(accountType).trim() !== String(existing.accountType || '').trim();
    const coaLinkCleared = typeChanged;

    let resolvedParent = null;
    if (effectiveType !== 'Cash') {
      resolvedParent = resolvePaymentParentGlCode({
        accountType: effectiveType,
        name: effectiveName,
        parentGlCode: parentGlCode != null ? String(parentGlCode).trim() : null,
      });
      if (!resolvedParent && !coaLinkCleared && existing.coaAccountId) {
        resolvedParent = await inferParentGlCodeFromCoaAccount(
          user.tenantId,
          existing.coaAccountId,
          prisma
        );
      }
    }

    if (
      ['Bank', 'Mobile Money', 'Wallet'].includes(effectiveType) &&
      (coaLinkCleared || !existing.coaAccountId) &&
      !resolvedParent
    ) {
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

    let refreshed;
    try {
      refreshed = await prisma.$transaction(async (tx) => {
        const updated = await tx.paymentAccount.update({
          where: { id },
          data: updateData,
        });
        return ensurePaymentAccountCoaLink(
          user.tenantId,
          { ...updated, parentGlCode: resolvedParent },
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
      throw linkErr;
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: 'PAYMENT_ACCOUNT_UPDATED',
          entityType: 'PAYMENT_ACCOUNT',
          entityId: refreshed.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            name: refreshed.name,
            accountType: refreshed.accountType,
            isActive: refreshed.isActive,
          }),
        },
      });
    } catch (auditErr) {
      console.warn('Audit log failed for payment account update:', auditErr?.message || auditErr);
    }

    return NextResponse.json({ success: true, paymentAccount: refreshed });
  } catch (error) {
    console.error('Error updating payment account:', error);
    const code = error?.code;
    if (code === 'P2002') {
      return NextResponse.json(
        {
          error: 'A payment account or ledger code already exists for this business.',
          code: 'PAYMENT_ACCOUNT_DUPLICATE',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: 'Failed to update payment account',
        hint: error?.message?.slice(0, 300) || undefined,
        code: code || undefined,
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a payment account (soft delete by deactivating)
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.tenantId) {
      try {
        const { assertTenantCoaUnlocked } = await import('@/lib/coaTenantLock');
        await assertTenantCoaUnlocked(user.tenantId);
      } catch (lockErr) {
        if (lockErr?.code === 'COA_TENANT_LOCKED') {
          return NextResponse.json({ error: lockErr.message, code: lockErr.code }, { status: 423 });
        }
        throw lockErr;
      }
    }

    const { id } = await params;

    // Find the payment account
    const existing = await prisma.paymentAccount.findFirst({
      where: {
        id,
        tenantId: user.tenantId
      },
      include: {
        allocations: {
          take: 1 // Check if there are any allocations
        }
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    // System accounts cannot be deleted
    if (existing.isSystem) {
      return NextResponse.json({ 
        error: 'System payment accounts cannot be deleted' 
      }, { status: 400 });
    }

    // Check if account has been used in payments
    if (existing.allocations.length > 0) {
      // Instead of deleting, deactivate it
      const paymentAccount = await prisma.paymentAccount.update({
        where: { id },
        data: { isActive: false }
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          action: 'PAYMENT_ACCOUNT_DEACTIVATED',
          entityType: 'PAYMENT_ACCOUNT',
          entityId: paymentAccount.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            name: paymentAccount.name,
            reason: 'Account has payment history'
          })
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Payment account deactivated (has payment history)',
        paymentAccount 
      });
    }

    // If no allocations, can be deleted
    await prisma.paymentAccount.delete({
      where: { id }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_ACCOUNT_DELETED',
        entityType: 'PAYMENT_ACCOUNT',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: existing.name
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Payment account deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting payment account:', error);
    return NextResponse.json({ error: 'Failed to delete payment account' }, { status: 500 });
  }
}

