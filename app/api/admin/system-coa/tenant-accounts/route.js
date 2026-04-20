import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  buildDefaultSystemCoaPayload,
  validateSystemCoaPayload,
} from '@/lib/systemCoaPayload';

const SYSTEM_COA_ID = 'default';

function normCode(c) {
  return String(c ?? '').trim();
}

/** Prefer new columns; fall back to legacy `code` / `name` / `type` (e.g. POST /api/accounts). */
function effectiveAccountCode(a) {
  return normCode(a?.accountCode) || normCode(a?.code);
}

function effectiveAccountName(a) {
  const n = normCode(a?.accountName) || normCode(a?.name);
  return n || null;
}

function effectiveAccountType(a) {
  const t = String(a?.accountType || a?.type || '').trim();
  return t || null;
}

function normalizeRelatedAccount(rel) {
  if (!rel) return null;
  const accountCode = effectiveAccountCode(rel);
  const accountName = effectiveAccountName(rel);
  const accountType = effectiveAccountType(rel);
  return {
    ...rel,
    accountCode: accountCode || null,
    accountName,
    accountType,
  };
}

function normalizeTenantAccountRow(a) {
  if (!a || typeof a !== 'object') return a;
  const { _count, balance, ...rest } = a;
  const je = _count?.journalEntryLines ?? 0;
  const tx = _count?.transactionLines ?? 0;
  return {
    ...rest,
    accountCode: effectiveAccountCode(a) || null,
    accountName: effectiveAccountName(a),
    accountType: effectiveAccountType(a),
    parentAccount: normalizeRelatedAccount(a.parentAccount),
    mergedIntoAccount: normalizeRelatedAccount(a.mergedIntoAccount),
    currentBalance: Number(balance) || 0,
    transactionCount: je + tx,
  };
}

const accountSelectForCatalog = {
  id: true,
  tenantId: true,
  accountCode: true,
  accountName: true,
  code: true,
  name: true,
  accountType: true,
  type: true,
  accountSubtype: true,
  normalBalance: true,
  balance: true,
  isActive: true,
  isSystem: true,
  mergedIntoAccountId: true,
  parentAccountId: true,
  description: true,
  requiresReclassification: true,
  retiredAt: true,
  migratedToAccountCode: true,
  visibleInChart: true,
  acceptsNewTransactions: true,
  _count: {
    select: {
      journalEntryLines: true,
      transactionLines: true,
    },
  },
  mergedIntoAccount: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      code: true,
      name: true,
    },
  },
  parentAccount: {
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      code: true,
      name: true,
    },
  },
};

/**
 * Admin-only: tenant GL accounts, payment accounts, plus default blueprint and saved system definition
 * (read-only catalog for /insightbooks/chart-of-accounts merge planning).
 * Includes legacy `code`-only rows, CoA linked from /payments/management, and GL from expense categories.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantIdFilter = searchParams.get('tenantId')?.trim() || null;
    /** When true, response includes every tenant Account row (not deduped by code) for admin CoA tooling. */
    const includeAllTenantRows = searchParams.get('includeAllTenantRows') === 'true';

    const tenantWhere = tenantIdFilter ? { id: tenantIdFilter } : {};

    const expenseCategoryWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {};

    const [chartAccountsRaw, paymentAccounts, tenantSummaries, expenseCategoryRefs] = await Promise.all([
      prisma.account.findMany({
        where: {
          tenantId: { not: null },
          ...(tenantIdFilter ? { tenantId: tenantIdFilter } : {}),
        },
        select: accountSelectForCatalog,
        orderBy: [{ tenantId: 'asc' }, { id: 'asc' }],
      }),
      prisma.paymentAccount.findMany({
        where: tenantIdFilter ? { tenantId: tenantIdFilter } : {},
        select: {
          id: true,
          tenantId: true,
          name: true,
          accountType: true,
          reference: true,
          isActive: true,
          isSystem: true,
          coaAccountId: true,
          coaAccount: {
            select: {
              id: true,
              tenantId: true,
              accountCode: true,
              accountName: true,
              code: true,
              name: true,
              accountType: true,
              type: true,
              accountSubtype: true,
              normalBalance: true,
              balance: true,
              isActive: true,
              isSystem: true,
              mergedIntoAccountId: true,
              parentAccountId: true,
              description: true,
              _count: {
                select: {
                  journalEntryLines: true,
                  transactionLines: true,
                },
              },
              mergedIntoAccount: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  code: true,
                  name: true,
                },
              },
              parentAccount: {
                select: {
                  id: true,
                  accountCode: true,
                  accountName: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
      }),
      prisma.tenant.findMany({
        where: tenantWhere,
        select: {
          id: true,
          status: true,
          _count: {
            select: { accounts: true, paymentAccounts: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.expenseCategory.findMany({
        where: expenseCategoryWhere,
        select: { accountId: true },
      }),
    ]);

    const chartIds = new Set(chartAccountsRaw.map((a) => a.id));
    const extraAccountIds = new Set();

    for (const p of paymentAccounts) {
      if (p.coaAccountId && !chartIds.has(p.coaAccountId)) {
        extraAccountIds.add(p.coaAccountId);
      }
    }
    for (const row of expenseCategoryRefs) {
      if (row.accountId && !chartIds.has(row.accountId)) {
        extraAccountIds.add(row.accountId);
      }
    }

    let chartAccounts = chartAccountsRaw;
    if (extraAccountIds.size > 0) {
      const extraRows = await prisma.account.findMany({
        where: { id: { in: [...extraAccountIds] } },
        select: accountSelectForCatalog,
        orderBy: { id: 'asc' },
      });
      chartAccounts = [...chartAccountsRaw, ...extraRows];
    }

    const chartAccountRowCount = chartAccounts.length;
    chartAccounts = chartAccounts.map(normalizeTenantAccountRow);

    const paymentAccountsOut = paymentAccounts.map((p) => ({
      ...p,
      coaAccount: p.coaAccount ? normalizeTenantAccountRow({ ...p.coaAccount }) : null,
    }));

    const tenantIds = new Set([
      ...chartAccounts.map((a) => a.tenantId),
      ...paymentAccounts.map((p) => p.tenantId),
    ]);

    const defaultPayload = buildDefaultSystemCoaPayload();
    const blueprintChartCatalog = (defaultPayload.accounts || []).map((a) => ({
      _inventorySource: 'blueprint',
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      parentCode: a.parentCode ?? null,
      normalBalance: a.normalBalance ?? null,
      isSystem: Boolean(a.isSystem),
      description: a.description ?? null,
    }));

    let savedDefinitionCatalog = [];
    try {
      const defRow = await prisma.systemCoaDefinition.findUnique({
        where: { id: SYSTEM_COA_ID },
        select: { payload: true },
      });
      if (defRow?.payload && typeof defRow.payload === 'object') {
        const v = validateSystemCoaPayload(defRow.payload);
        if (v.ok && Array.isArray(v.payload.accounts)) {
          savedDefinitionCatalog = v.payload.accounts.map((a) => ({
            _inventorySource: 'saved_definition',
            code: a.code,
            name: a.name,
            type: a.type,
            subtype: a.subtype ?? null,
            parentCode: a.parentCode ?? null,
            normalBalance: a.normalBalance ?? null,
            isSystem: Boolean(a.isSystem),
            description: a.description ?? null,
          }));
        }
      }
    } catch (e) {
      console.warn('tenant-accounts: saved definition catalog skipped:', e?.message || e);
    }

    /** Case-insensitive key so the same GL code is not listed twice. */
    const codeDedupeKey = (c) => normCode(c).toLowerCase();

    const distinctGlCodes = new Set();
    for (const a of chartAccounts) {
      const k = codeDedupeKey(a.accountCode);
      if (k) distinctGlCodes.add(k);
    }
    for (const a of savedDefinitionCatalog) {
      const k = codeDedupeKey(a.code);
      if (k) distinctGlCodes.add(k);
    }
    for (const a of blueprintChartCatalog) {
      const k = codeDedupeKey(a.code);
      if (k) distinctGlCodes.add(k);
    }

    const seenKeys = new Set();
    const combinedGlCatalog = [];
    for (const a of chartAccounts) {
      const k = codeDedupeKey(a.accountCode);
      if (!k || seenKeys.has(k)) continue;
      seenKeys.add(k);
      combinedGlCatalog.push({ ...a, _inventorySource: 'tenant' });
    }
    for (const a of savedDefinitionCatalog) {
      const k = codeDedupeKey(a.code);
      if (!k || seenKeys.has(k)) continue;
      seenKeys.add(k);
      combinedGlCatalog.push({ ...a });
    }
    for (const a of blueprintChartCatalog) {
      const k = codeDedupeKey(a.code);
      if (!k || seenKeys.has(k)) continue;
      seenKeys.add(k);
      combinedGlCatalog.push({ ...a });
    }

    const allTenantGlAccounts = includeAllTenantRows
      ? chartAccounts.map((a) => ({ ...a, _inventorySource: 'tenant' }))
      : undefined;

    return NextResponse.json({
      meta: {
        chartAccountCount: chartAccountRowCount,
        blueprintCatalogCount: blueprintChartCatalog.length,
        savedDefinitionCatalogCount: savedDefinitionCatalog.length,
        /** Union of unique codes across tenant rows + saved template + blueprint (same rule as catalog UI). */
        combinedGlCatalogCount: distinctGlCodes.size,
        allTenantGlAccountCount: includeAllTenantRows ? chartAccountRowCount : undefined,
        paymentAccountCount: paymentAccounts.length,
        tenantCount: tenantSummaries.length,
        distinctTenantIdsInRows: tenantIds.size,
        filteredByTenantId: tenantIdFilter,
        includeAllTenantRows,
      },
      tenants: tenantSummaries.map((t) => ({
        id: t.id,
        status: t.status,
        chartAccountCount: t._count.accounts,
        paymentAccountCount: t._count.paymentAccounts,
      })),
      combinedGlCatalog,
      paymentAccounts: paymentAccountsOut,
      ...(includeAllTenantRows && allTenantGlAccounts ? { allTenantGlAccounts } : {}),
    });
  } catch (error) {
    console.error('admin system-coa tenant-accounts GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load tenant accounts' },
      { status: 500 }
    );
  }
}
