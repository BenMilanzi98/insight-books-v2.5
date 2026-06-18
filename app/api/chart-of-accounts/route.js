// app/api/chart-of-accounts/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import {
  canViewChartOfAccounts,
  canCreateChartOfAccount,
} from '@/lib/chartOfAccountsAccess';
import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
} from '@/lib/accountMergeRollup';
import { validateCoaAccountCreationRules } from '@/lib/coaAccountCreateRules.js';
import {
  pickPrimaryAccountForStructure,
} from '@/lib/coaSystemStructureTree.js';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import {
  apply3100CapitalBucketAncestorPropagation,
  applyCoaParentRollup,
  applyLiabilityRegisterCoaSubtree,
  applyStockLedInventoryCoaSubtree,
  foldCatchAllBucketTotalsIntoPostedDirect,
  injectSyntheticDirectPostingLeaves,
} from '@/lib/coaChartRollup.js';
import { loadCoaBulkGlAggregates } from '@/lib/coaBulkGlAggregation.js';
import { getTenantFiscalYearStartMonth } from '@/lib/accountingPeriodService';
import { roundCents, inferCoaNormalBalance } from '@/lib/coaMoney.js';
import {
  alignInventorySearchParamsWithGlBranch,
  computePhysicalInventoryValuationTotal,
} from '@/lib/stockValuationAggregate.js';
import {
  blueprintCatalogTitleForCode,
  alignChartAccountsListToBlueprint,
} from '@/lib/coaBlueprintDisplayTitles.js';
import { CODE_ACCOUNTS_RECEIVABLE } from '@/lib/coaPostingCodes.js';
import { reattachOrphanParentsForCoaRollup } from '@/lib/coaOrphanParentAttach.js';
import {
  assignNextCustomExpenseAccountCode,
  ensureCustomExpenses5700ForTenant,
} from '@/lib/customExpenseRange.server.js';
import {
  buildCoaAccountListWhere,
  COA_ACCOUNT_TYPES,
  normalizeCoaAccountType,
} from '@/lib/coaAccountListWhere.js';
import { bootstrapReportRoute } from '@/lib/reportRouteBootstrap';

// Digits-only (3–10) or hierarchical form e.g. 1130-01 per CoA spec
const validateAccountCode = (code) => /^\d{3,10}(-\d{2,4})?$/.test(String(code || '').trim());

function parseOptionalDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildChartDateRange(searchParams) {
  const fromRaw = searchParams.get('dateFrom');
  const toRaw = searchParams.get('dateTo');
  const from = parseOptionalDate(fromRaw);
  const to = parseOptionalDate(toRaw);
  if (from && to && from > to) {
    return { invalid: true };
  }
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to, invalid: false };
}

/**
 * Same display code on multiple Account rows breaks parent/child rollup — merge into one row and remap parent ids.
 * Canonical row must not be chosen only by highest activity (that attached the wrong duplicate’s title to a GL code).
 */
function mergeDuplicateAccountCodeRows(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const keyFor = (a) => {
    const c = String(a.accountCode || a.code || '').trim().toLowerCase();
    return c || null;
  };
  const groups = new Map();
  const noCodeKey = [];
  for (const a of accounts) {
    const k = keyFor(a);
    if (!k) {
      noCodeKey.push(a);
      continue;
    }
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  const idRemap = new Map();
  const pickCanonical = (group) => {
    const codeRaw = String(group[0]?.accountCode || group[0]?.code || '').trim();
    const byBlueprint = pickPrimaryAccountForStructure(group, '', codeRaw);
    if (byBlueprint) return byBlueprint;
    const score = (r) =>
      (Number(r.postedEntryCount) || 0) * 1e12 +
      (Number(r.transactionCount) || 0) * 1e6 +
      Math.abs(Number(r.postedDirectBalance ?? r.currentBalance) || 0);
    return [...group].sort((a, b) => {
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return String(a.id).localeCompare(String(b.id));
    })[0];
  };
  const out = [...noCodeKey];
  for (const [, group] of groups) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const canonical = { ...pickCanonical(group) };
    const catalogTitle = blueprintCatalogTitleForCode(canonical.accountCode || canonical.code);
    if (catalogTitle) {
      canonical.accountName = catalogTitle;
      canonical.name = catalogTitle;
    }
    const others = group.filter((x) => x.id !== canonical.id);
    for (const d of others) {
      idRemap.set(d.id, canonical.id);
    }
    let sumPosted = Number(canonical.postedDirectBalance ?? canonical.currentBalance) || 0;
    let sumCur = Number(canonical.currentBalance) || 0;
    let sumTx = Number(canonical.transactionCount) || 0;
    let sumPostedCount = Number(canonical.postedEntryCount) || 0;
    let sumDraft = Number(canonical.draftEntryCount) || 0;
    let sumJbal = Number(canonical.journalEntryBalance) || 0;
    let sumAdd = Number(canonical.additionalBalance) || 0;
    for (const d of others) {
      sumPosted += Number(d.postedDirectBalance ?? d.currentBalance) || 0;
      sumCur += Number(d.currentBalance) || 0;
      sumTx += Number(d.transactionCount) || 0;
      sumPostedCount += Number(d.postedEntryCount) || 0;
      sumDraft += Number(d.draftEntryCount) || 0;
      sumJbal += Number(d.journalEntryBalance) || 0;
      sumAdd += Number(d.additionalBalance) || 0;
    }
    canonical.postedDirectBalance = sumPosted;
    canonical.currentBalance = sumCur;
    canonical.transactionCount = sumTx;
    canonical.postedEntryCount = sumPostedCount;
    canonical.draftEntryCount = sumDraft;
    canonical.journalEntryBalance = sumJbal;
    canonical.additionalBalance = sumAdd;
    out.push(canonical);
  }
  const remapPid = (pid) => {
    if (!pid) return pid;
    const seen = new Set();
    let p = pid;
    while (p && idRemap.has(p) && !seen.has(p)) {
      seen.add(p);
      p = idRemap.get(p);
    }
    return p;
  };
  return out.map((a) => ({
    ...a,
    parentAccountId: remapPid(a.parentAccountId),
  }));
}

// GET - List all accounts with filtering and search
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'accounts.view');
    if (perm) return perm;

    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const { user, tenantIds, tenants, scope, primaryTenantId } = boot;

    if (!canViewChartOfAccounts(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.view permission required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const dateRangeProbe = buildChartDateRange(searchParams);
    if (dateRangeProbe.invalid) {
      return NextResponse.json({ error: 'Invalid date range: dateFrom must be <= dateTo' }, { status: 400 });
    }

    if (tenantIds.length > 1) {
      const byTenant = [];
      for (const t of tenants) {
        const payload = await buildCoaPayload(t.id, user, searchParams);
        byTenant.push({
          tenantId: t.id,
          tenantName: t.name,
          accounts: payload.accounts,
        });
      }
      return NextResponse.json(
        { scope, byTenant },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            Pragma: 'no-cache',
          },
        }
      );
    }

    const payload = await buildCoaPayload(primaryTenantId, user, searchParams);
    if (payload.error) {
      return NextResponse.json({ error: payload.error }, { status: payload.status || 400 });
    }
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return NextResponse.json(
      { error: 'Failed to fetch chart of accounts', details: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined },
      { status: 500 }
    );
  }
}

async function buildCoaPayload(tenantId, user, searchParams) {
    const dateRange = buildChartDateRange(searchParams);
    if (dateRange.invalid) {
      return { error: 'Invalid date range: dateFrom must be <= dateTo', status: 400 };
    }
    const hasDateFilter = Boolean(dateRange.from || dateRange.to);

    const where = buildCoaAccountListWhere(tenantId, searchParams);

    let accounts = [];
    try {
      accounts = await prisma.account.findMany({
        where,
        include: {
          parentAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          mergedIntoAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          },
          childAccounts: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              isActive: true,
              isSystem: true
            }
          },
          _count: {
            select: {
              journalEntryLines: true,
              transactionLines: true
            }
          }
        },
        orderBy: [
          { accountCode: 'asc' }
        ]
      });

<<<<<<< Updated upstream
=======
      const rollupOnlyRows = await fetchChartRollupOnlyAccounts(tenantId, prisma);
      accounts = mergeRollupOnlyAccountsForProcessing(accounts, rollupOnlyRows);

>>>>>>> Stashed changes
      // Canonical-only display removed from page controls; full tenant chart stays visible.
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // Return empty array if accounts query fails
      return {
        accounts: [],
        total: 0,
        error: 'Failed to fetch accounts'
      };
    }

    // Stable order for balance aggregation + duplicate-code merge (avoids tie-break drift across reloads).
    accounts.sort((a, b) => {
      const ca = String(a.accountCode || a.code || '').localeCompare(String(b.accountCode || b.code || ''));
      if (ca !== 0) return ca;
      return String(a.id).localeCompare(String(b.id));
    });

    const parentIdsWithChildren = new Set();
    for (const a of accounts) {
      if (a.parentAccountId) parentIdsWithChildren.add(a.parentAccountId);
    }

    // Accounts Receivable from unpaid invoices (sub-ledger only when the AR leaf has no posted GL).
    // Fetch invoices with their actual payments to calculate accurate remaining balance
    let allInvoices = [];
    try {
      allInvoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          voidedAt: null,
          refundedAt: null,
          ...(dateRange.to || dateRange.from
            ? {
                issueDate: {
                  lte: dateRange.to || dateRange.from,
                },
              }
            : {}),
        },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          totalPaid: true,
          remainingBalance: true,
          status: true,
          issueDate: true,
          dueDate: true,
          payments: {
            where: {
              status: 'Completed',
              ...(dateRange.to || dateRange.from
                ? {
                    paymentDate: {
                      lte: dateRange.to || dateRange.from,
                    },
                  }
                : {}),
            },
            select: {
              amount: true,
              status: true
            }
          }
        },
        orderBy: {
          issueDate: 'desc'
        }
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }

    let liabilitiesForChartOverlay = [];
    try {
      liabilitiesForChartOverlay = await prisma.liability.findMany({
        where: { tenantId, status: 'active' },
        select: {
          id: true,
          glAccountId: true,
          currentBalance: true,
          status: true,
        },
      });
    } catch (error) {
      console.error('Error fetching liabilities for chart overlay:', error);
    }
    
    // Calculate actual remaining balance from payments (more accurate than stored fields)
    const invoicesWithActualBalance = allInvoices.map(inv => {
      // Calculate total paid from actual completed payments
      const actualTotalPaid = inv.payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
      
      // Calculate actual remaining balance
      const actualRemaining = Math.max(0, subtractMoney(inv.total, actualTotalPaid));
      
      return {
        ...inv,
        actualTotalPaid,
        actualRemaining,
        storedRemainingBalance: inv.remainingBalance,
        storedTotalPaid: inv.totalPaid
      };
    });
    
    // Filter for unpaid invoices - VERY STRICT: Only count invoices that are clearly unpaid
    // If user says they have no pending invoices, this should return 0
    const unpaidInvoices = invoicesWithActualBalance.filter(inv => {
      const status = (inv.status || '').toLowerCase().trim();
      const remaining = inv.actualRemaining; // Use calculated remaining balance from payments
      
      // STRICT: Exclude ALL of these statuses (these are NOT accounts receivable)
      const excludedStatuses = [
        'paid', 
        'completed', 
        'void', 
        'refunded',
        'fully refunded',
        'draft',
        'cancelled',
        'closed'
      ];
      
      if (excludedStatuses.includes(status)) {
        return false;
      }
      
      // STRICT: Only include if status EXACTLY matches unpaid statuses
      // AND there's actually a remaining balance > 0
      const unpaidStatuses = [
        'unpaid',
        'pending',
        'partially paid',
        'partial',
        'sent'
      ];
      
      const isUnpaidStatus = unpaidStatuses.some(us => status === us || status.includes(us));
      
      // Must have unpaid status AND remaining balance > 0
      return isUnpaidStatus && remaining > 0;
    });
    
    const totalAccountsReceivable = unpaidInvoices.reduce((sum, inv) => {
      return addMoney(sum, Math.max(0, inv.actualRemaining)); // Use actual calculated remaining
    }, 0);

    /** When set, GL transaction lines match branch-scoped registers (e.g. expenses). */
    const glBranchFilter =
      user?.currentBranchId != null && String(user.currentBranchId).trim() !== ''
        ? { branchId: user.currentBranchId }
        : {};

    const inventorySearchAligned = alignInventorySearchParamsWithGlBranch(searchParams, glBranchFilter);

    // Inventory — live valuation matching GET /api/stock/statistics (same branch scope as GL above).
    // Date filters apply to posted GL only; inventory overlay stays aligned with Stock Management so 1300 matches /stock.
    let totalInventoryValue = 0;
    let inventoryProductCount = 0;
    let inventoryValuationNote = null;
    try {
      const invAgg = await computePhysicalInventoryValuationTotal(
        prisma,
        tenantId,
        user,
        inventorySearchAligned,
        {}
      );
      totalInventoryValue = invAgg.total;
      inventoryProductCount = invAgg.productCount;
      inventoryValuationNote =
        invAgg.valuationNote ??
        (hasDateFilter
          ? 'Inventory total matches Stock Management (live); chart date filters apply to posted GL on accounts, not to this inventory aggregate.'
          : null);
    } catch (error) {
      console.error('Error fetching inventory aggregate for chart:', error);
    }

    console.log('Chart of Accounts (GL-first): inventory aggregate & AR sub-ledger context', {
      productCount: inventoryProductCount,
      totalInventoryValue,
      totalAccountsReceivable,
    });

    const mergeRollupRows = await fetchTenantAccountsForMergeRollup(tenantId, prisma);
    const mergeRollupCtx = buildMergeRollupContext(mergeRollupRows);

    const fiscalYearStartMonth = await getTenantFiscalYearStartMonth(tenantId, prisma);
    let journalBySurvivor = new Map();
    let draftBySurvivor = new Map();
    let txnBySurvivor = new Map();
    try {
      const bulk = await loadCoaBulkGlAggregates(prisma, {
        tenantId,
        glBranchFilter,
        mergeRollupCtx,
        accounts,
        dateRange,
        fiscalYearStartMonth,
      });
      journalBySurvivor = bulk.journalBySurvivor;
      draftBySurvivor = bulk.draftBySurvivor;
      txnBySurvivor = bulk.txnBySurvivor;
    } catch (e) {
      console.error('Error bulk-loading GL for chart of accounts:', e);
    }

    const accountsWithBalances = accounts.map((account) => {
      try {
        const ja = journalBySurvivor.get(account.id) || { debit: 0, credit: 0, lineCount: 0 };
        const txAgg = txnBySurvivor.get(account.id) || { debit: 0, credit: 0, lineCount: 0 };

        const totalDebits = ja.debit + txAgg.debit;
        const totalCredits = ja.credit + txAgg.credit;

        const normalBalance = inferCoaNormalBalance(account);

        // Calculate balance based on normal balance (posted journal + posted transactions only)
        let balance = 0;
        if (normalBalance === 'Debit') {
          balance = totalDebits - totalCredits;
        } else {
          balance = totalCredits - totalDebits;
        }
        const postedGlLineCount =
          (Number(ja.lineCount) || 0) + (Number(txAgg.lineCount) || 0);
        const hasPostedGlActivity = postedGlLineCount > 0;
        const draftEntryCount = draftBySurvivor.get(account.id) || 0;

        const accountCode = String(account.accountCode || account.code || '').trim();
        const accountName = (account.accountName || account.name || '').toLowerCase().trim();
        const accountType = (account.accountType || account.type || '').trim().toUpperCase();

        /** Parent/header accounts: use only posted GL on this account; roll up children later. */
        const hasChildren =
          (Array.isArray(account.childAccounts) && account.childAccounts.length > 0) ||
          parentIdsWithChildren.has(account.id);

        const isAccountsReceivableLeaf =
          !hasChildren &&
          (accountType === 'ASSET' || accountType === 'Asset') &&
          (accountCode === CODE_ACCOUNTS_RECEIVABLE ||
            (accountName.includes('receivable') &&
              !accountName.includes('payable') &&
              !accountName.includes('prepaid') &&
              accountCode.startsWith('12') &&
              accountCode !== '1210' &&
              accountCode !== '1215'));

        // Add balances from other sources based on account type and name
        let additionalBalance = 0;
        let isInventoryLedger = false;

        if (!hasChildren) {
        // Accounts Receivable: canonical **1200** only (1100 is Current Assets group — never AR subledger).
        // When no GL activity yet, show unpaid invoices; once GL posts exist, balance is traceable from journals/transactions.
        if (isAccountsReceivableLeaf && !hasPostedGlActivity) {
          balance = Math.max(0, totalAccountsReceivable);
          additionalBalance = 0;
        }
        
        // Custom inventory GL (not 1300): leaf only; canonical 1300 is handled after parent/child branch so headers still match /stock.
        const isCustomInventoryName =
          accountCode !== '1300' &&
          accountName.includes('inventory') &&
          !accountName.includes('receivable');
        isInventoryLedger =
          isCustomInventoryName && (accountType === 'ASSET' || accountType === 'Asset');

        if (isInventoryLedger && !hasPostedGlActivity) {
          balance = totalInventoryValue;
          additionalBalance = 0;
        }

        } else {
          // Parent/summary account: only posted GL (journal + transaction) on this code.
          // Aggregate heuristics would double-count vs child lines; children are summed in rollup.
          additionalBalance = 0;
        }

        const subledgerOverlayBeforeSuppress = additionalBalance;
        if (hasPostedGlActivity) {
          additionalBalance = 0;
        }

        const legacyBalance = parseFloat(account.balance) || 0;

        /** Displayed balance must reconcile to posted GL when activity exists (no GL + subledger double-count). */
        let finalBalance;
        if (isAccountsReceivableLeaf || isInventoryLedger) {
          finalBalance = balance;
        } else if (hasPostedGlActivity) {
          finalBalance = balance;
        } else if (subledgerOverlayBeforeSuppress > 0) {
          finalBalance = subledgerOverlayBeforeSuppress;
        } else if (!hasChildren && legacyBalance !== 0) {
          finalBalance = legacyBalance;
        } else {
          finalBalance = 0;
        }

        finalBalance = roundCents(finalBalance);
        balance = roundCents(balance);

        let balanceSource = 'none';
        if (hasPostedGlActivity) {
          balanceSource = 'posted_gl';
        } else if (isAccountsReceivableLeaf) {
          balanceSource = 'ar_subledger';
        } else if (isInventoryLedger) {
          balanceSource = hasDateFilter ? 'inventory_subledger_as_of' : 'inventory_subledger';
        } else if (subledgerOverlayBeforeSuppress > 0) {
          balanceSource = 'subledger_estimate';
        } else if (!hasChildren && legacyBalance !== 0) {
          balanceSource = 'legacy_account_balance';
        }

        const accountResult = {
          ...account,
          /** Posted GL (and documented sub-ledgers) on this account id only (before parent/child rollup). */
          postedDirectBalance: finalBalance,
          currentBalance: finalBalance,
          transactionCount: postedGlLineCount,
          postedEntryCount: postedGlLineCount,
          draftEntryCount,
          additionalBalance,
          journalEntryBalance: balance,
          postedGlNet: balance,
          balanceSource,
          legacyStoredBalanceIgnored:
            hasChildren && !hasPostedGlActivity && legacyBalance !== 0 ? legacyBalance : 0,
          subledgerOverlaySuppressed:
            hasPostedGlActivity && subledgerOverlayBeforeSuppress > 0
              ? subledgerOverlayBeforeSuppress
              : 0,
        };

        return accountResult;
      } catch (error) {
        console.error(`Error calculating balance for account ${account?.id || 'unknown'}:`, error);
        // Return account with zero balance if calculation fails
        return {
          ...account,
          postedDirectBalance: 0,
          currentBalance: 0,
          transactionCount: 0,
          postedEntryCount: 0,
          draftEntryCount: 0,
          additionalBalance: 0,
          journalEntryBalance: 0
        };
      }
    });

    const successfulAccounts = accountsWithBalances.filter(
      (account) => account !== null && account !== undefined
    );

    // Same accountCode on multiple rows breaks hierarchy rollup — merge amounts and remap parents.
    const deduplicatedAccounts = mergeDuplicateAccountCodeRows(successfulAccounts);

    const parentChainRows = await prisma.account.findMany({
<<<<<<< Updated upstream
      where: { tenantId: user.tenantId },
      select: { id: true, parentAccountId: true },
=======
      where: { tenantId },
      select: { id: true, parentAccountId: true, mergedIntoAccountId: true },
>>>>>>> Stashed changes
    });
    const parentAccountIdByAccountId = new Map(
      parentChainRows.map((r) => [r.id, r.parentAccountId ?? null])
    );
    // Orphans whose DB parent row is not in this chart response roll up under nearest in-list ancestor (display-only parent tweak).
    const rollupReadyAccounts = reattachOrphanParentsForCoaRollup(
      deduplicatedAccounts,
      parentAccountIdByAccountId
    );

    // Inventory (1300 subtree): always reconcile to Stock Management aggregate (never unexplained GL on parent).
    const stockLedAccounts = applyStockLedInventoryCoaSubtree(
      rollupReadyAccounts,
      totalInventoryValue
    );
    // Liability register: merge after inventory subtree alignment, before parent rollup (ordering matches inventory-style overlays).
    const withLiabilityOverlay = applyLiabilityRegisterCoaSubtree(
      stockLedAccounts,
      liabilitiesForChartOverlay
    );
    const withSyntheticLeaves = injectSyntheticDirectPostingLeaves(withLiabilityOverlay);
    const accountsAfterFirstRollup = applyCoaParentRollup(withSyntheticLeaves);
    const foldedPosted = foldCatchAllBucketTotalsIntoPostedDirect(accountsAfterFirstRollup);
    const afterCatchAllRollup = applyCoaParentRollup(foldedPosted);
    const accountsWithCatchAllDisplay = apply3100CapitalBucketAncestorPropagation(afterCatchAllRollup);

    const codeOf = (a) => String(a.accountCode || a.code || '');
    const parentCap =
      accountsWithCatchAllDisplay.find((a) => codeOf(a) === '3100') ||
      accountsWithCatchAllDisplay.find((a) => codeOf(a) === '500000');
    const sortedAccounts = (() => {
      if (!parentCap) {
        return [...accountsWithCatchAllDisplay].sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
      }
      const children = accountsWithCatchAllDisplay
        .filter((a) => a.parentAccountId === parentCap.id)
        .sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
      const rest = accountsWithCatchAllDisplay.filter(
        (a) => a.id !== parentCap.id && a.parentAccountId !== parentCap.id
      );
      const restSorted = rest.sort((a, b) => codeOf(a).localeCompare(codeOf(b)));
      return [parentCap, ...children, ...restSorted];
    })();

    const accountsForResponse = alignChartAccountsListToBlueprint(sortedAccounts);

    return {
      accounts: accountsForResponse,
      total: accountsForResponse.length,
      traceability: {
        policy:
          'Posted GL only: manual journals with transactionId=null (no mirrored system journals) plus posted Transaction lines (including reversals, so original + reversal net correctly). With a date filter: Asset/Liability/Equity use cumulative activity through dateTo; Revenue/Expense use net activity in [dateFrom or FY-start, dateTo]. AR sub-ledger uses invoices and completed payments through the as-of end date. The 1300 inventory overlay uses the same live physical-stock valuation as GET /api/stock/statistics, scoped to the same branch as GL when a branch is selected (see inventoryValuationNote). Chart date filters do not restate inventory; they only change posted GL amounts on accounts. Parent totals include synthetic "Direct postings" children so parent = sum of descendants. Liability register overlay unchanged when the target leaf has zero posted GL.',
        inventoryValuationNote: inventoryValuationNote || undefined,
      },
      period: {
        dateFrom: dateRange.from ? dateRange.from.toISOString() : null,
        dateTo: dateRange.to ? dateRange.to.toISOString() : null,
        hasDateFilter,
      },
    };
}

// POST - Create new account
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'accounts.create');
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
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

    if (!canCreateChartOfAccount(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.create permission required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      accountCode: rawAccountCode,
      accountName,
      accountType,
      accountSubtype,
      normalBalance,
      parentAccountId: rawParentAccountId,
      description,
      isActive = true
    } = body;

    let accountCode = rawAccountCode != null ? String(rawAccountCode).trim() : '';
    let parentAccountId = rawParentAccountId ?? null;

    const normalizedType = normalizeCoaAccountType(accountType);
    const resolvedNormalBalance =
      normalBalance ||
      (normalizedType === 'Asset' || normalizedType === 'Expense' ? 'Debit' : 'Credit');

    if (!accountName || !normalizedType) {
      return NextResponse.json(
        { error: 'Missing required fields: accountName, accountType' },
        { status: 400 }
      );
    }

    if (normalizedType === 'Expense') {
      const header5700 = await ensureCustomExpenses5700ForTenant(user.tenantId, prisma);
      if (!header5700?.id) {
        return NextResponse.json(
          { error: 'Could not ensure Custom Expenses header account (5700). Try Sync standard CoA from Chart of Accounts.' },
          { status: 500 }
        );
      }
      const autoAssign =
        !accountCode || /^AUTO$/i.test(accountCode);
      if (autoAssign) {
        const next = await assignNextCustomExpenseAccountCode(user.tenantId, prisma);
        if (!next) {
          return NextResponse.json(
            {
              error: 'All custom expense account codes (5701–5899) are in use.',
              code: 'CUSTOM_EXPENSE_RANGE_FULL',
            },
            { status: 409 }
          );
        }
        accountCode = next;
        parentAccountId = header5700.id;
      } else {
        parentAccountId = header5700.id;
      }
    } else if (!accountCode) {
      return NextResponse.json(
        { error: 'Missing required fields: accountCode, accountName, accountType' },
        { status: 400 }
      );
    }

    // Validate account code format (numeric only)
    if (!validateAccountCode(accountCode)) {
      return NextResponse.json(
        { error: 'Account code must be numeric (3-10 digits).' },
        { status: 400 }
      );
    }

    if (!COA_ACCOUNT_TYPES.includes(normalizedType)) {
      return NextResponse.json(
        { error: `Invalid account type. Expected one of: ${COA_ACCOUNT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if account code already exists for this tenant
    // Also check for case-insensitive matches and variations
    const existingAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        OR: [
          { accountCode: accountCode },
          // Also check if account name matches (to prevent duplicates with different codes)
          accountName ? { accountName: { equals: accountName, mode: 'insensitive' } } : {}
        ].filter(condition => Object.keys(condition).length > 0)
      }
    });

    if (existingAccount) {
      if (existingAccount.accountCode === accountCode) {
        return NextResponse.json(
          { 
            error: 'Account code must be unique',
            details: `Account code ${accountCode} is already in use by account: ${existingAccount.accountName || existingAccount.accountCode}`
          },
          { status: 400 }
        );
      } else if (existingAccount.accountName && accountName && 
                 existingAccount.accountName.toLowerCase() === accountName.toLowerCase()) {
        return NextResponse.json(
          { 
            error: 'Account name already exists',
            details: `An account with the name "${accountName}" already exists with code: ${existingAccount.accountCode}`
          },
          { status: 400 }
        );
      }
    }

    /** @type {{ accountCode?: string|null, accountType?: string|null } | null} */
    let parentAccount = null;
    if (parentAccountId) {
      parentAccount = await prisma.account.findUnique({
        where: { id: parentAccountId },
      });

      if (!parentAccount || parentAccount.tenantId !== user.tenantId) {
        return NextResponse.json(
          { error: 'Invalid parent account' },
          { status: 400 }
        );
      }

      if (parentAccount.accountType !== normalizedType) {
        return NextResponse.json(
          { error: 'Parent account must be of the same type' },
          { status: 400 }
        );
      }

      const pc = String(parentAccount.accountCode || '').trim();
      if (pc === '1130' && !/^1130-\d{2}$/.test(String(accountCode).trim())) {
        return NextResponse.json(
          {
            error: 'Invalid code for Bank & Mobile group',
            details: 'Accounts under 1130 must use hierarchical codes like 1130-06.',
          },
          { status: 400 }
        );
      }
    }

    const coaCreateRules = validateCoaAccountCreationRules({
      accountCode,
      accountType: normalizedType,
      parentAccount,
      userOriginated: normalizedType === 'Expense' ? true : false,
    });
    if (!coaCreateRules.ok) {
      return NextResponse.json({ error: coaCreateRules.message }, { status: 400 });
    }

    // Validate normal balance matches account type
    const expectedNormalBalance = {
      'Asset': 'Debit',
      'Expense': 'Debit',
      'Liability': 'Credit',
      'Equity': 'Credit',
      'Income': 'Credit'
    };

    if (expectedNormalBalance[normalizedType] !== resolvedNormalBalance) {
      return NextResponse.json(
        { error: `Normal balance for ${normalizedType} should be ${expectedNormalBalance[normalizedType]}` },
        { status: 400 }
      );
    }

    // Validate posting rules: Ensure account type allows the specified normal balance
    // This is already validated above, but we'll add additional checks here
    const postingRules = {
      'Asset': { normalBalance: 'Debit', canDebit: true, canCredit: false },
      'Expense': { normalBalance: 'Debit', canDebit: true, canCredit: false },
      'Liability': { normalBalance: 'Credit', canDebit: false, canCredit: true },
      'Equity': { normalBalance: 'Credit', canDebit: false, canCredit: true },
      'Revenue': { normalBalance: 'Credit', canDebit: false, canCredit: true },
      'Income': { normalBalance: 'Credit', canDebit: false, canCredit: true }
    };

    const rule = postingRules[normalizedType];
    if (rule && rule.normalBalance !== resolvedNormalBalance) {
      return NextResponse.json(
        { 
          error: 'Invalid posting rule',
          details: `${normalizedType} accounts must have a ${rule.normalBalance} normal balance`
        },
        { status: 400 }
      );
    }

    let account;
    try {
      account = await prisma.account.create({
        data: {
          accountCode,
          accountName,
          accountType: normalizedType,
          accountSubtype: accountSubtype || null,
          normalBalance: resolvedNormalBalance,
          parentAccountId: parentAccountId || null,
          description: description || null,
          isActive,
          tenantId: user.tenantId,
          isSystem: false,
          balance: 0,
          code: accountCode,
          name: accountName,
          type: normalizedType
        },
        include: {
          parentAccount: {
            select: {
              id: true,
              accountCode: true,
              accountName: true
            }
          }
        }
      });
    } catch (createError) {
      // Handle Prisma unique constraint errors
      if (createError.code === 'P2002') {
        const field = createError.meta?.target?.[0] || 'field';
        let errorMessage = 'Account code must be unique';
        let errorDetails = `The ${field} value is already in use.`;
        
        if (field === 'accountCode') {
          errorMessage = 'Account code must be unique';
          errorDetails = `Account code ${accountCode} is already in use.`;
        } else if (field === 'accountName' || field === 'name') {
          errorMessage = 'Account name must be unique';
          errorDetails = `An account with the name "${accountName}" already exists.`;
        }
        
        return NextResponse.json(
          { error: errorMessage, details: errorDetails },
          { status: 400 }
        );
      }
      
      // Re-throw other errors
      throw createError;
    }

    return NextResponse.json({
      account,
      message: 'Account created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Failed to create account', details: error.message },
      { status: 500 }
    );
  }
}
