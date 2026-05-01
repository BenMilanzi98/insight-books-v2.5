import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';
import {
  createReversalEntry,
  postEntry,
} from '@/lib/journalService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { formatJournalEntry } from '@/lib/journalEntryFormatter';
import {
  validateNoDuplicateInventoryLines,
  validateNoPostingToStructuralCoaRoots,
} from '@/lib/journalManualLineValidation';

const ENTRY_INCLUDE = {
  lines: {
    orderBy: { lineNumber: 'asc' },
    include: {
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          code: true,
          name: true,
          type: true,
        },
      },
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  postedBy: {
    select: { id: true, name: true, email: true },
  },
};

const ALLOWED_ENTRY_TYPES = ['Correction', 'Accrual', 'Opening Balance'];

function normalizeEntryType(value) {
  if (!value) return 'Correction';
  const normalized = value.toString().trim();
  if (normalized.toLowerCase() === 'openingbalance') return 'Opening Balance';
  return normalized;
}

function isFinanceAdmin(user) {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return (
    roleName.includes('finance') ||
    roleName.includes('admin') ||
    roleName === 'master_admin'
  );
}

function canViewJournalEntries(user) {
  return (
    isFinanceAdmin(user) ||
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'journalEntries.view')
  );
}

function canUpdateJournalEntries(user) {
  return (
    isFinanceAdmin(user) ||
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'journalEntries.update')
  );
}

function canPostJournalEntries(user) {
  return (
    isFinanceAdmin(user) ||
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'journalEntries.post')
  );
}

function canDeleteJournalEntries(user) {
  return (
    isFinanceAdmin(user) ||
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'journalEntries.delete')
  );
}

function normalizeLines(lines = [], fallbackDescription) {
  return lines
    .filter((line) => !!line.accountId)
    .map((line) => {
      const debit = Number(
        line.debitAmount ?? line.debit ?? line.debit_value ?? 0
      );
      const credit = Number(
        line.creditAmount ?? line.credit ?? line.credit_value ?? 0
      );

      return {
        accountId: line.accountId,
        description: line.description || fallbackDescription || null,
        debitAmount: Number.isFinite(debit) ? debit : 0,
        creditAmount: Number.isFinite(credit) ? credit : 0,
      };
    });
}

/**
 * GET - Fetch a single journal entry by ID
 */
export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canViewJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to view journal entries.' },
        { status: 403 }
      );
    }

    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const entryId = resolvedParams?.id;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const entry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        tenantId: user.tenantId,
      },
      include: ENTRY_INCLUDE,
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      );
    }

    if (action === 'impact') {
      const formatted = formatJournalEntry(entry);
      const totals = {
        debits: formatted.totalDebit,
        credits: formatted.totalCredit,
      };

      return NextResponse.json({
        entryId: entry.id,
        referenceNumber: entry.referenceNumber,
        entryDate: entry.entryDate,
        description: entry.description,
        status: entry.status,
        totals,
        isBalanced: Math.abs(totals.debits - totals.credits) < 0.0001,
        lines: formatted.lines.map((line) => ({
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
        })),
      });
    }

    return NextResponse.json(formatJournalEntry(entry));
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journal entry', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a draft journal entry
 */
export async function PUT(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canUpdateJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to update journal entries.' },
        { status: 403 }
      );
    }

    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const entryId = resolvedParams?.id;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const lines = normalizeLines(body.lines, body.description);
    const entryType = normalizeEntryType(body.entryType);

    if (!body.description || body.description.trim().length < 3) {
      return NextResponse.json(
        { error: 'A reason/description is required for journal entries.' },
        { status: 400 }
      );
    }

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'At least two lines are required for a journal entry.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_ENTRY_TYPES.includes(entryType)) {
      return NextResponse.json(
        { error: `Unsupported journal entry type: ${entryType}.` },
        { status: 400 }
      );
    }

    const accountIds = lines.map((line) => line.accountId);
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        id: { in: accountIds },
      },
      select: {
        id: true,
        isActive: true,
        accountCode: true,
        code: true,
        accountName: true,
        name: true,
        accountType: true,
        type: true,
        accountSubtype: true,
      },
    });

    if (accounts.length !== new Set(accountIds).size) {
      return NextResponse.json(
        { error: 'One or more accounts are invalid for this tenant.' },
        { status: 400 }
      );
    }

    const inactiveAccount = accounts.find((account) => !account.isActive);
    if (inactiveAccount) {
      return NextResponse.json(
        { error: 'Inactive accounts cannot be used in journal entries.' },
        { status: 400 }
      );
    }

    const invDup = validateNoDuplicateInventoryLines(lines, accounts);
    if (!invDup.ok) {
      return NextResponse.json(
        { error: invDup.error, details: invDup.details },
        { status: 400 }
      );
    }

    const structural = validateNoPostingToStructuralCoaRoots(lines, accounts);
    if (!structural.ok) {
      return NextResponse.json(
        { error: structural.error, details: structural.details },
        { status: 400 }
      );
    }

    const taxTypes = await prisma.taxType.findMany({
      where: {
        tenantId: user.tenantId,
        accountId: { in: accountIds },
      },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
          },
        },
      },
    });

    if (taxTypes.length > 0) {
      const taxAccountNames = taxTypes
        .map((tt) => tt.account.accountName || 'Unknown')
        .join(', ');
      return NextResponse.json(
        {
          error:
            'Manual journal entries to tax accounts are not allowed. Tax accounts must be posted automatically via the tax system.',
          details: `Tax accounts detected: ${taxAccountNames}. Please use the tax management system to post taxes.`,
        },
        { status: 400 }
      );
    }

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        tenantId: user.tenantId,
      },
      include: { lines: true },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      );
    }

    if (existingEntry.status === 'Posted') {
      return NextResponse.json(
        { error: 'Posted journal entries are read-only. Use a reversal instead.' },
        { status: 400 }
      );
    }

    if (existingEntry.sourceType === 'capital_contribution') {
      return NextResponse.json(
        {
          error:
            'Capital contribution entries cannot be edited. Post a reversing journal entry if you need to correct the books.',
        },
        { status: 400 }
      );
    }

    await assertPeriodOpen(user.tenantId, existingEntry.entryDate || existingEntry.createdAt, prisma);

    const updatedEntry = await prisma.$transaction(async (tx) => {
      await tx.journalEntryLine.deleteMany({
        where: { journalEntryId: entryId },
      });

      return tx.journalEntry.update({
        where: { id: entryId },
        data: {
          entryDate: body.entryDate || body.date ? new Date(body.entryDate || body.date) : existingEntry.entryDate,
          description: body.description,
          entryType,
          notes: body.notes || body.internalReference || null,
          lines: {
            create: lines.map((line, index) => ({
              lineNumber: index + 1,
              accountId: line.accountId,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description,
            })),
          },
        },
        include: ENTRY_INCLUDE,
      });
    });

    return NextResponse.json(formatJournalEntry(updatedEntry));
  } catch (error) {
    console.error('Error updating journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to update journal entry', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Post or reverse a journal entry
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canPostJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to post or reverse journal entries.' },
        { status: 403 }
      );
    }

    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const entryId = resolvedParams?.id;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'post';
    const body = await request.json().catch(() => ({}));

    if (action === 'reverse') {
      const reversal = await createReversalEntry(entryId, body.reason, {
        userId: user.id,
        tenantId: user.tenantId,
      });

      const hydrated = await prisma.journalEntry.findUnique({
        where: { id: reversal.id },
        include: ENTRY_INCLUDE,
      });

      return NextResponse.json({
        message: 'Journal entry reversed successfully.',
        entry: formatJournalEntry(hydrated),
      });
    }

    const posted = await postEntry(entryId, {
      userId: user.id,
      tenantId: user.tenantId,
    });

    const hydrated = await prisma.journalEntry.findUnique({
      where: { id: posted.id },
      include: ENTRY_INCLUDE,
    });

    return NextResponse.json({
      message: 'Journal entry posted successfully.',
      entry: formatJournalEntry(hydrated),
    });
  } catch (error) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post journal entry' },
      { status: 400 }
    );
  }
}

/**
 * DELETE - Delete a journal entry
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }

    if (!canDeleteJournalEntries(user)) {
      return NextResponse.json(
        { error: 'Access denied. You do not have permission to delete journal entries.' },
        { status: 403 }
      );
    }

    const resolvedParams = typeof params.then === 'function' ? await params : params;
    const entryId = resolvedParams?.id;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      );
    }

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id: entryId,
        tenantId: user.tenantId,
      },
      include: {
        lines: true,
      },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Journal entry not found' },
        { status: 404 }
      );
    }

    if (existingEntry.status === 'Posted') {
      return NextResponse.json(
        { error: 'Cannot delete posted journal entries. Please reverse instead.' },
        { status: 400 }
      );
    }

    if (existingEntry.sourceType === 'capital_contribution') {
      return NextResponse.json(
        {
          error:
            'Capital contribution entries cannot be deleted. Use a reversal entry if a correction is required.',
        },
        { status: 400 }
      );
    }

    await assertPeriodOpen(user.tenantId, existingEntry.entryDate || existingEntry.createdAt, prisma);

    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.delete({
        where: { id: entryId },
      });

      await tx.auditLog.create({
        data: {
          action: 'JOURNAL_ENTRY_DELETED',
          entityType: 'JournalEntry',
          entityId: entryId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            entryId: entryId,
            referenceNumber: existingEntry.referenceNumber,
            description: existingEntry.description,
          }),
        },
      });
    });

    return NextResponse.json({
      message: 'Journal entry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete journal entry', details: error.message },
      { status: 500 }
    );
  }
}