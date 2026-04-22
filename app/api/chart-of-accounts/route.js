// app/api/chart-of-accounts/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  canViewChartOfAccounts,
  canCreateChartOfAccount,
} from '@/lib/chartOfAccountsAccess';
import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
  aggregateGroupByRowsBySurvivor,
} from '@/lib/accountMergeRollup';
import { resolveProductCostPriceForDisplay } from '@/lib/productCostDisplay';
import { isCanonicalCode, isStructureExtensionCode } from '@/lib/coaMigration/canonicalCodes.js';
import { validateCoaAccountCreationRules } from '@/lib/coaAccountCreateRules.js';
import {
  pickPrimaryAccountForStructure,
  applyCatchAllRowDisplayBalancesToList,
} from '@/lib/coaSystemStructureTree.js';
import {
  blueprintCatalogTitleForCode,
  alignChartAccountsListToBlueprint,
} from '@/lib/coaBlueprintDisplayTitles.js';
import { CODE_ACCOUNTS_RECEIVABLE } from '@/lib/coaPostingCodes.js';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const normalizeAccountType = (value) => {
  if (!value) return value;
  const normalized = value.toString().trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ACCOUNT_TYPES.includes(upper) ? upper : normalized;
};

// Digits-only (3–10) or hierarchical form e.g. 1130-01 per CoA spec
const validateAccountCode = (code) => /^\d{3,10}(-\d{2,4})?$/.test(String(code || '').trim());

/**
 * Parent account rows should equal sum of child balances plus any balance posted
 * directly to the parent account (avoids aggregate heuristics double-counting vs children).
 * Uses postedDirectBalance (GL + rules on that row only) so rollup is not affected by in-place updates.
 */
function applyCoaParentRollup(accounts) {
  const list = accounts.map((a) => ({ ...a }));
  const byId = new Map(list.map((a) => [a.id, a]));
  const childrenByParent = new Map();
  for (const a of list) {
    if (a.parentAccountId && byId.has(a.parentAccountId)) {
      if (!childrenByParent.has(a.parentAccountId)) {
        childrenByParent.set(a.parentAccountId, []);
      }
      childrenByParent.get(a.parentAccountId).push(a.id);
    }
  }
  const memo = new Map();
  function rollup(id) {
    if (memo.has(id)) return memo.get(id);
    const acc = byId.get(id);
    if (!acc) return 0;
    const childIds = childrenByParent.get(id) || [];
    const code = String(acc.accountCode || acc.code || '');
    const directBase = Number.isFinite(Number(acc.postedDirectBalance))
      ? Number(acc.postedDirectBalance)
      : Number(acc.currentBalance) || 0;
    // Owner's Capital (3100) / legacy 500000: when children exist, rollup from children only to avoid double-count.
    const direct =
      (code === '500000' || code === '3100') && childIds.length > 0 ? 0 : directBase;
    if (childIds.length === 0) {
      memo.set(id, direct);
      return direct;
    }
    const sumChildren = childIds.reduce((sum, cid) => sum + rollup(cid), 0);
    const total = direct + sumChildren;
    memo.set(id, total);
    return total;
  }
  for (const a of list) {
    a.currentBalance = rollup(a.id);
  }
  return list;
}

/**
 * Inventory (1300) must match Stock Management: one total from the same product aggregate as /stock.
 * Rewrites postedDirectBalance on the 1300 Asset subtree so rolled parent total equals that amount.
 * If subtree leaves had no posted balance, the full total sits on 1300 and descendants are 0.
 * If leaves had balances, the stock total is split across leaves by those weights (parent direct 0) so sums match.
 */
function applyStockLedInventoryCoaSubtree(accounts, stockTotal) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const list = accounts.map((a) => ({ ...a }));
  const byId = new Map(list.map((a) => [a.id, a]));
  const typeAsset = (a) => {
    const t = String(a.accountType || a.type || '').trim();
    return t === 'Asset' || t === 'ASSET';
  };

  const inv = list.find(
    (a) => String(a.accountCode || a.code || '').trim() === '1300' && typeAsset(a)
  );
  if (!inv) return list;

  const S = Number(stockTotal) || 0;
  const childrenByParent = new Map();
  for (const a of list) {
    if (!a.parentAccountId) continue;
    if (!childrenByParent.has(a.parentAccountId)) {
      childrenByParent.set(a.parentAccountId, []);
    }
    childrenByParent.get(a.parentAccountId).push(a.id);
  }

  const subtree = new Set([inv.id]);
  const stack = [inv.id];
  while (stack.length) {
    const id = stack.pop();
    for (const k of childrenByParent.get(id) || []) {
      if (!subtree.has(k)) {
        subtree.add(k);
        stack.push(k);
      }
    }
  }

  const leafIds = [...subtree].filter((id) => {
    const kids = childrenByParent.get(id) || [];
    return !kids.some((k) => subtree.has(k));
  });

  const weightSnap = new Map();
  for (const lid of leafIds) {
    if (lid === inv.id) continue;
    const row = byId.get(lid);
    if (!row) continue;
    weightSnap.set(
      lid,
      Math.abs(Number(row.postedDirectBalance ?? row.currentBalance ?? 0) || 0)
    );
  }
  const W = [...weightSnap.values()].reduce((a, b) => a + b, 0);

  const note =
    W < 1e-9
      ? 'Inventory total matches Stock Management (all on this account; no leaf GL to split).'
      : 'Inventory total matches Stock Management; sub-accounts split this total by relative posted amounts on each leaf.';

  if (W < 1e-9) {
    inv.postedDirectBalance = S;
    inv.additionalBalance = 0;
    inv.inventoryBalanceSource = 'stock_management_aggregate';
    inv.inventoryBalanceNote = note;
    for (const id of subtree) {
      if (id === inv.id) continue;
      const a = byId.get(id);
      if (!a) continue;
      a.postedDirectBalance = 0;
      a.additionalBalance = 0;
      a.inventoryBalanceSource = 'stock_management_aggregate';
      a.inventoryBalanceNote = note;
    }
  } else {
    inv.postedDirectBalance = 0;
    inv.additionalBalance = 0;
    inv.inventoryBalanceSource = 'stock_management_aggregate';
    inv.inventoryBalanceNote = note;
    for (const id of subtree) {
      if (id === inv.id) continue;
      const a = byId.get(id);
      if (!a) continue;
      if (leafIds.includes(id) && weightSnap.has(id)) {
        const w = weightSnap.get(id) || 0;
        a.postedDirectBalance = (S * w) / W;
      } else {
        a.postedDirectBalance = 0;
      }
      a.additionalBalance = 0;
      a.inventoryBalanceSource = 'stock_management_aggregate';
      a.inventoryBalanceNote = note;
    }
  }

  return list;
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
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    if (!canViewChartOfAccounts(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.view permission required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('accountType');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    /** When true, include rows where mergedIntoAccountId is set (merge sources kept for audit). */
    const includeMergedSources = searchParams.get('includeMergedSources') === 'true';
    /** When true, include rows with visibleInChart=false (retired / hidden from default chart). */
    const includeChartHidden = searchParams.get('includeChartHidden') === 'true';
    /** Blueprint + structure extensions only (strict canonical surface). */
    const canonicalSurface = searchParams.get('canonicalSurface') === 'true';

    const where = {
      tenantId: user.tenantId
    };

    if (!includeChartHidden) {
      where.visibleInChart = true;
    }

    if (accountType && accountType !== 'All') {
      where.accountType = normalizeAccountType(accountType);
    }

    // Merge sources stay in the DB but are hidden from the chart and pickers unless auditing.
    if (!includeMergedSources) {
      where.mergedIntoAccountId = null;
    }

    const andBlocks = [];
    if (isActive === 'true' || (!includeInactive && isActive !== 'false')) {
      if (includeMergedSources) {
        andBlocks.push({
          OR: [{ isActive: true }, { mergedIntoAccountId: { not: null } }],
        });
      } else {
        andBlocks.push({ isActive: true });
      }
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    if (search) {
      andBlocks.push({
        OR: [
          { accountCode: { contains: search, mode: 'insensitive' } },
          { accountName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (andBlocks.length) {
      where.AND = andBlocks;
    }

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

      if (canonicalSurface) {
        accounts = accounts.filter((a) => {
          const c = String(a.accountCode || '').trim();
          return isCanonicalCode(c) || isStructureExtensionCode(c);
        });
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // Return empty array if accounts query fails
      return NextResponse.json({
        accounts: [],
        total: 0,
        error: 'Failed to fetch accounts'
      });
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
          tenantId: user.tenantId, // CRITICAL: Filter by tenant ID
          voidedAt: null,
          refundedAt: null
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
              status: 'Completed'
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
    
    // Calculate actual remaining balance from payments (more accurate than stored fields)
    const invoicesWithActualBalance = allInvoices.map(inv => {
      // Calculate total paid from actual completed payments
      const actualTotalPaid = inv.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      // Calculate actual remaining balance
      const actualRemaining = Math.max(0, parseFloat(inv.total) - actualTotalPaid);
      
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
      return sum + Math.max(0, inv.actualRemaining); // Use actual calculated remaining
    }, 0);

    // Inventory value from products — match /api/stock/statistics (branch + cost display rules)
    let inventoryProducts = [];
    try {
      const invWhere = {
        tenantId: user.tenantId,
        isService: false,
        isDeleted: false,
      };
      if (user?.currentBranchId) {
        invWhere.branchId = user.currentBranchId;
      }
      inventoryProducts = await prisma.product.findMany({
        where: invWhere,
        select: {
          stockLevel: true,
          cost: true,
          totalStockValue: true,
          averageCost: true,
          lastPurchaseCost: true,
        },
      });
    } catch (error) {
      console.error('Error fetching inventory products:', error);
    }
    const totalInventoryValue = inventoryProducts.reduce((sum, product) => {
      try {
        const stockLevel = Number(product.stockLevel) || 0;
        const cost = resolveProductCostPriceForDisplay(product);
        const stored =
          product.totalStockValue != null ? Number(product.totalStockValue) : null;
        const productValue =
          stored != null && !Number.isNaN(stored) && stored > 0
            ? stored
            : stockLevel * cost;
        return sum + productValue;
      } catch {
        return sum;
      }
    }, 0);
    
    console.log('Chart of Accounts (GL-first): inventory aggregate & AR sub-ledger context', {
      productCount: inventoryProducts.length,
      totalInventoryValue,
      totalAccountsReceivable,
    });

    const mergeRollupRows = await fetchTenantAccountsForMergeRollup(user.tenantId, prisma);
    const mergeRollupCtx = buildMergeRollupContext(mergeRollupRows);

    /** When set, GL transaction lines match branch-scoped registers (e.g. expenses). */
    const glBranchFilter =
      user?.currentBranchId != null && String(user.currentBranchId).trim() !== ''
        ? { branchId: user.currentBranchId }
        : {};

    // Posted GL lines from Transaction model (sales, payroll, etc.) — roll merge sources into survivors
    let txnByAccountId = {};
    try {
      const txnAggRows = await prisma.transactionLine.groupBy({
        by: ['accountId'],
        where: {
          transaction: {
            tenantId: user.tenantId,
            status: { in: ['posted', 'Posted'] },
            ...glBranchFilter,
          },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
        _count: {
          id: true,
        },
      });
      const txnMerged = aggregateGroupByRowsBySurvivor(
        txnAggRows,
        mergeRollupCtx.survivorOf
      );
      txnByAccountId = Object.fromEntries(
        [...txnMerged].map(([k, v]) => [
          k,
          {
            debit: v.debit,
            credit: v.credit,
            lineCount: v.lineCount,
          },
        ])
      );
    } catch (e) {
      console.error('Error aggregating transaction lines for chart of accounts:', e);
    }

    // Calculate current balances from journal entries
    // Wrap in try-catch to handle any individual account calculation errors
    const accountsWithBalances = await Promise.allSettled(accounts.map(async (account) => {
      try {
        // Get all journal entry lines for this account (both Posted and Draft)
        const journalAccountIds = mergeRollupCtx.allIdsRollingInto(account.id);
        const allJournalLines = await prisma.journalEntryLine.findMany({
          where: {
            accountId: { in: journalAccountIds },
            journalEntry: {
              tenantId: user.tenantId,
              ...glBranchFilter,
            }
          },
          include: {
            journalEntry: {
              select: {
                status: true
              }
            }
          }
        });

        const journalStatus = (s) => (s || '').toString().trim().toLowerCase();

        // Separate Posted and Draft entries (support Posted / posted)
        const postedLines = allJournalLines.filter(
          (line) => journalStatus(line.journalEntry?.status) === 'posted'
        );
        const draftLines = allJournalLines.filter(
          (line) => journalStatus(line.journalEntry?.status) === 'draft'
        );

        const txAgg = txnByAccountId[account.id] || { debit: 0, credit: 0, lineCount: 0 };

        // Calculate totals from Posted journal lines + posted Transaction lines (GL)
        const totalDebits =
          postedLines.reduce((sum, line) => {
            const debit = parseFloat(line.debitAmount) || 0;
            return sum + debit;
          }, 0) + txAgg.debit;

        const totalCredits =
          postedLines.reduce((sum, line) => {
            const credit = parseFloat(line.creditAmount) || 0;
            return sum + credit;
          }, 0) + txAgg.credit;

        // Determine normal balance - use account.normalBalance or infer from account type
        const normalBalance = account.normalBalance || 
          (account.accountType === 'Asset' || account.accountType === 'Expense' ? 'Debit' : 'Credit');

        // Calculate balance based on normal balance (posted journal + posted transactions only)
        let balance = 0;
        if (normalBalance === 'Debit') {
          balance = totalDebits - totalCredits;
        } else {
          balance = totalCredits - totalDebits;
        }
        const glBookBalance = balance;

        const postedGlLineCount =
          postedLines.length + (Number(txAgg.lineCount) || 0);
        const hasPostedGlActivity = postedGlLineCount > 0;

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
        } else if (legacyBalance !== 0) {
          finalBalance = legacyBalance;
        } else {
          finalBalance = 0;
        }

        let balanceSource = 'none';
        if (hasPostedGlActivity) {
          balanceSource = 'posted_gl';
        } else if (isAccountsReceivableLeaf) {
          balanceSource = 'ar_subledger';
        } else if (isInventoryLedger) {
          balanceSource = 'inventory_subledger';
        } else if (subledgerOverlayBeforeSuppress > 0) {
          balanceSource = 'subledger_estimate';
        } else if (legacyBalance !== 0) {
          balanceSource = 'legacy_account_balance';
        }

        const accountResult = {
          ...account,
          /** Posted GL (and documented sub-ledgers) on this account id only (before parent/child rollup). */
          postedDirectBalance: finalBalance,
          currentBalance: finalBalance,
          transactionCount: postedLines.length + txAgg.lineCount,
          postedEntryCount: postedLines.length + txAgg.lineCount,
          draftEntryCount: draftLines.length,
          additionalBalance,
          journalEntryBalance: balance,
          postedGlNet: glBookBalance,
          balanceSource,
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
    }));

    // Extract successful results and handle failures
    const successfulAccounts = accountsWithBalances
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Failed to calculate balance for account at index ${index}:`, result.reason);
          // Return a basic account object with zero balance
          const account = accounts[index];
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
      })
      .filter(account => account !== null && account !== undefined);

    // Same accountCode on multiple rows breaks hierarchy rollup — merge amounts and remap parents.
    const deduplicatedAccounts = mergeDuplicateAccountCodeRows(successfulAccounts);
    // Inventory (1300 subtree): always reconcile to Stock Management aggregate (never unexplained GL on parent).
    const stockLedAccounts = applyStockLedInventoryCoaSubtree(
      deduplicatedAccounts,
      totalInventoryValue
    );
    const accountsWithParentRollup = applyCoaParentRollup(stockLedAccounts);
    const accountsWithCatchAllDisplay =
      applyCatchAllRowDisplayBalancesToList(accountsWithParentRollup);

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

    return NextResponse.json(
      {
        accounts: accountsForResponse,
        total: accountsForResponse.length,
        traceability: {
          policy:
            'Chart balances are posted GL (journals + posted transactions) when any lines exist on the account. Without posted GL, only these non-GL displays apply: unpaid sales invoices on the canonical receivables leaf (1200-style), stock-valued leaves for non-1300 inventory-named asset accounts, and the 1300 subtree is then aligned to the same inventory aggregate as Stock Management. No revenue, COGS, payroll, AP, tax, PPE register, or expense-module overlays are applied — those belong in the GL or management reports, not on this chart.',
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
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

// POST - Create new account
export async function POST(request) {
  try {
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
      accountCode,
      accountName,
      accountType,
      accountSubtype,
      normalBalance,
      parentAccountId,
      description,
      isActive = true
    } = body;

    const normalizedType = normalizeAccountType(accountType);
    const resolvedNormalBalance =
      normalBalance ||
      (normalizedType === 'Asset' || normalizedType === 'Expense' ? 'Debit' : 'Credit');

    // Validation
    if (!accountCode || !accountName || !normalizedType) {
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

    if (!ACCOUNT_TYPES.includes(normalizedType)) {
      return NextResponse.json(
        { error: `Invalid account type. Expected one of: ${ACCOUNT_TYPES.join(', ')}` },
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

