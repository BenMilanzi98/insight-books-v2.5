// app/api/expenses/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createExpenseReversal, validateReversalReason } from '@/lib/transactionReversalService';
import { isSystemExpenseStructurePickerAccount } from '@/lib/systemExpenseCategoryCodes.js';
import {
  GL_POSTED_STATUSES,
  postApprovedExpenseJournalIfMissing
} from '@/lib/expenseGlPosting';

// Helper function to get expense by ID with validation
async function getExpenseWithValidation(id, userId, tenantId) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      submittedBy: {
        select: {
          id: true,
          name: true,
        }
      },
      expenseAttachments: {
        select: {
          id: true,
          filename: true,
          fileType: true,
          fileSize: true,
          uploadedAt: true,
        }
      }
    }
  });
  
  if (!expense) {
    return { error: 'Expense not found', status: 404 };
  }
  
  // Security check: Ensure the expense belongs to the user's tenant
  if (expense.tenantId !== tenantId) {
    return { error: 'Access denied', status: 403 };
  }
  
  return {
    expense: {
      ...expense,
      // Format the amount for display
      amount: expense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      // Tax elements for reporting/reconciliation (always include)
      taxAmount: expense.taxAmount ?? 0,
      taxRate: expense.taxRate ?? 0,
      // Format the date for display
      date: expense.date.toISOString().split('T')[0],
      // Map attachments to the expected format
      attachments: expense.expenseAttachments.map(attachment => ({
        id: attachment.id,
        name: attachment.filename,
        type: attachment.fileType,
        size: formatFileSize(attachment.fileSize),
        date: attachment.uploadedAt.toISOString().split('T')[0]
      }))
    }
  };
}

// GET - Fetch a single expense by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const expenseId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get expense with validation
    const result = await getExpenseWithValidation(expenseId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    return NextResponse.json(result.expense);
  } catch (error) {
    console.error(`Error fetching expense ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch expense. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update an expense
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const expenseId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get expense with validation
    const result = await getExpenseWithValidation(expenseId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    const body = await request.json();

    const rawExisting = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId: user.tenantId },
      select: {
        id: true,
        amount: true,
        date: true,
        expenseAccountId: true,
        taxAmount: true,
        taxRate: true,
        category: true,
        status: true,
        isDeleted: true
      }
    });
    if (!rawExisting) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    if (rawExisting.isDeleted) {
      return NextResponse.json({ error: 'Cannot update a removed expense.' }, { status: 400 });
    }

    const postedExpenseJournal = await prisma.transaction.findFirst({
      where: {
        tenantId: user.tenantId,
        sourceType: 'Expense',
        sourceId: expenseId,
        status: GL_POSTED_STATUSES,
        isReversal: false
      },
      select: { id: true }
    });

    // Parse amount - convert string to number if needed
    let amount = body.amount;
    if (typeof body.amount === 'string') {
      amount = parseFloat(body.amount.replace(/,/g, ''));
    }

    if (postedExpenseJournal) {
      const nextAmount = body.amount !== undefined ? Number(amount) : Number(rawExisting.amount);
      const nextDate =
        body.date !== undefined ? new Date(body.date).getTime() : new Date(rawExisting.date).getTime();
      const nextAcct = body.expenseAccountId !== undefined ? body.expenseAccountId : rawExisting.expenseAccountId;
      const nextTaxAmt =
        body.taxAmount !== undefined ? Number(body.taxAmount) : Number(rawExisting.taxAmount ?? 0);
      const nextTaxRate =
        body.taxRate !== undefined ? Number(body.taxRate) : Number(rawExisting.taxRate ?? 0);

      const materialChanged =
        (body.amount !== undefined && Math.abs(nextAmount - Number(rawExisting.amount)) > 0.009) ||
        (body.date !== undefined && nextDate !== new Date(rawExisting.date).getTime()) ||
        (body.expenseAccountId !== undefined && String(nextAcct || '') !== String(rawExisting.expenseAccountId || '')) ||
        (body.taxAmount !== undefined && Math.abs(nextTaxAmt - Number(rawExisting.taxAmount ?? 0)) > 0.009) ||
        (body.taxRate !== undefined && Math.abs(nextTaxRate - Number(rawExisting.taxRate ?? 0)) > 0.009) ||
        (body.category !== undefined && String(body.category) !== String(rawExisting.category || '')) ||
        (body.status !== undefined && String(body.status) !== String(rawExisting.status || ''));

      if (materialChanged) {
        return NextResponse.json(
          {
            error:
              'This expense is posted to the general ledger. Reverse it from Accounting → Reversals (or use the reversal action), then record a corrected expense. Cosmetic edits (description, notes, merchant) are still allowed.'
          },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData = {};

    let expenseAccount = null;
    if (body.expenseAccountId) {
      expenseAccount = await prisma.account.findFirst({
        where: { id: body.expenseAccountId, tenantId: user.tenantId, accountType: 'Expense' },
      });

      if (!expenseAccount) {
        const ecByPickerId = await prisma.expenseCategory.findFirst({
          where: { id: body.expenseAccountId, tenantId: user.tenantId },
          include: { account: true },
        });
        if (ecByPickerId?.account) {
          expenseAccount = ecByPickerId.account;
        }
      }

      if (!expenseAccount) {
        return NextResponse.json(
          { error: 'Invalid expense account. Please select a valid expense account.' },
          { status: 400 }
        );
      }

      if (!isSystemExpenseStructurePickerAccount(expenseAccount)) {
        return NextResponse.json(
          {
            error:
              'That account is not a standard expense category. Select an account from the EXPENSES (5000) structure in Chart of accounts (e.g. 5110–5140, 5200–5210, 5300–5340, 5400, 5500, 5701–5899 custom expenses, 5900).',
          },
          { status: 400 }
        );
      }

      updateData.expenseAccountId = expenseAccount.id;
      updateData.category = expenseAccount.accountName;
    }
    
    // Only include fields that are provided in the request
    if (body.description !== undefined) updateData.description = body.description;
    if (amount !== undefined) updateData.amount = amount;
    if (body.taxAmount !== undefined) updateData.taxAmount = Number(body.taxAmount);
    if (body.taxRate !== undefined) updateData.taxRate = Number(body.taxRate);
    if (body.taxTypeId !== undefined) {
      updateData.taxTypeId =
        body.taxTypeId != null && String(body.taxTypeId).trim() !== ''
          ? String(body.taxTypeId).trim()
          : null;
    }
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.category !== undefined && !updateData.category) updateData.category = body.category;
    if (body.merchant !== undefined) updateData.merchant = body.merchant;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    // Payment status fields
    if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus;
    if (body.paidAmount !== undefined) updateData.paidAmount = body.paidAmount;
    if (body.paymentReference !== undefined) updateData.paymentReference = body.paymentReference;

    let updatedExpense;
    try {
      updatedExpense = await prisma.$transaction(async (tx) => {
        const updated = await tx.expense.update({
          where: { id: expenseId },
          data: updateData,
          include: {
            expenseAttachments: true
          }
        });
        await postApprovedExpenseJournalIfMissing({
          tx,
          tenantId: user.tenantId,
          userId: user.id,
          expense: updated
        });
        return updated;
      });
    } catch (txErr) {
      const msg = txErr?.message || 'Update failed';
      const code = txErr?.code;
      if (
        code === 'EXPENSE_TAX_EXCEEDS_GROSS' ||
        code === 'EXPENSE_GL_PENDING_NO_SUPPLIER' ||
        code === 'EXPENSE_GL_NO_ACCOUNT' ||
        code === 'EXPENSE_GL_NO_PAYMENT_METHOD' ||
        msg.includes('general ledger') ||
        msg.includes('Tax amount cannot exceed') ||
        msg.includes('Payment method is required') ||
        msg.includes('Expense account is required') ||
        msg.includes('unpaid and has no supplier')
      ) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw txErr;
    }

    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_UPDATED',
        entityType: 'EXPENSE',
        entityId: updatedExpense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          changes: updateData,
          hadPostedJournal: Boolean(postedExpenseJournal)
        })
      }
    });
    
    // Return updated expense
    return NextResponse.json({
      message: 'Expense updated successfully',
      expense: {
        ...updatedExpense,
        // Format the amount for display
        amount: updatedExpense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        // Format the date for display
        date: updatedExpense.date.toISOString().split('T')[0],
        // Map attachments to the expected format
        attachments: updatedExpense.expenseAttachments.map(attachment => ({
          id: attachment.id,
          name: attachment.filename,
          type: attachment.fileType,
          size: formatFileSize(attachment.fileSize),
          date: attachment.uploadedAt.toISOString().split('T')[0]
        }))
      }
    });
  } catch (error) {
    console.error(`Error updating expense ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update expense. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an expense
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const expenseId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get expense with validation
    const result = await getExpenseWithValidation(expenseId, user.id, user.tenantId);
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    
    const body = await request.json().catch(() => ({}));
    const deletionReason = body.reason || body.deletionReason || 'Manual removal from register';

    const raw = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId: user.tenantId },
      select: {
        id: true,
        status: true,
        isDeleted: true,
        isReversal: true,
        amount: true,
        description: true,
        category: true,
        supplierId: true
      }
    });
    if (!raw || raw.isDeleted) {
      return NextResponse.json({ error: 'Expense not found or already removed' }, { status: 404 });
    }
    if (raw.isReversal) {
      return NextResponse.json(
        { error: 'Cannot remove a reversal entry. Reverse the original transaction instead.' },
        { status: 400 }
      );
    }

    const postedJournal = await prisma.transaction.findFirst({
      where: {
        tenantId: user.tenantId,
        sourceType: 'Expense',
        sourceId: expenseId,
        status: GL_POSTED_STATUSES,
        isReversal: false
      },
      select: { id: true }
    });

    let auditReason = deletionReason;
    if (postedJournal) {
      const reasonValidation = validateReversalReason(body.reversalReason || deletionReason);
      if (!reasonValidation.isValid) {
        return NextResponse.json(
          {
            error: reasonValidation.error,
            hint:
              'This expense is posted to the GL. Provide reversalReason or reason (min 10 characters) before removal.'
          },
          { status: 400 }
        );
      }
      auditReason = reasonValidation.reason;

      const existingReversal = await prisma.expense.findFirst({
        where: {
          tenantId: user.tenantId,
          isReversal: true,
          reversedTransactionId: expenseId
        },
        select: { id: true }
      });
      if (!existingReversal) {
        try {
          await createExpenseReversal({
            expenseId,
            reversalReason: auditReason,
            userId: user.id,
            tenantId: user.tenantId
          });
        } catch (revErr) {
          console.error('Expense removal reversal failed:', revErr);
          return NextResponse.json(
            {
              error:
                revErr.message ||
                'Could not reverse accounting for this expense. Use the Reversals screen or fix the underlying journal entry.'
            },
            { status: 400 }
          );
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: user.id,
          deletionReason: [deletionReason, postedJournal ? `GL reversed: ${auditReason}` : 'No GL posted']
            .filter(Boolean)
            .join(' | ')
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'EXPENSE_SOFT_DELETED_AFTER_REVERSAL',
          entityType: 'EXPENSE',
          entityId: expenseId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            description: raw.description,
            amount: raw.amount,
            category: raw.category,
            status: raw.status,
            reversalReason: auditReason,
            accountingReversed: Boolean(postedJournal),
            canRestore: true
          })
        }
      });
    });

    if (raw.supplierId) {
      try {
        const { updateSupplierBalance } = await import('@/lib/supplierService');
        await updateSupplierBalance(raw.supplierId, user.tenantId);
      } catch (balErr) {
        console.error('updateSupplierBalance after expense delete:', balErr?.message);
      }
    }

    return NextResponse.json({
      message: 'Expense removed from the register; accounting reversed where applicable.'
    });
  } catch (error) {
    console.error(`Error deleting expense ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete expense. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes / 1048576 * 10) / 10 + ' MB';
}