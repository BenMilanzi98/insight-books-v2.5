/**
 * Phase 5 — General Ledger Query Service.
 *
 * The single ledger computation engine: opening balances, period movement,
 * closing balances, running balances, normal-balance presentation, account
 * hierarchy handling. Screen, export and API all call this service — never
 * their own queries — so every surface shows identical numbers.
 *
 * Sources exclusively from the Canonical Journal Source (ADR-001/ADR-011).
 * Never reads `Account.balance`, `AccountBalance`, or operational tables.
 * All arithmetic in integer minor units (ADR-006).
 */

import {
  getCanonicalAccountTotals,
  listCanonicalLines,
  assertLedgerContext,
} from './canonicalJournalSource.js';
import { minorToDecimalString } from '../domain/money.js';
import { buildSurvivorResolver } from '../../accountMergeRollup.js';
import { AccountingValidationError } from '../domain/errors.js';

/* ── Normal-balance presentation ──────────────────────────────────────────── */

const CATEGORY_NORMAL_BALANCE = Object.freeze({
  ASSET: 'DEBIT',
  EXPENSE: 'DEBIT',
  COST_OF_SALES: 'DEBIT',
  OTHER_EXPENSE: 'DEBIT',
  LIABILITY: 'CREDIT',
  EQUITY: 'CREDIT',
  REVENUE: 'CREDIT',
  OTHER_INCOME: 'CREDIT',
});

const LEGACY_TYPE_NORMAL_BALANCE = Object.freeze({
  asset: 'DEBIT',
  expense: 'DEBIT',
  liability: 'CREDIT',
  equity: 'CREDIT',
  income: 'CREDIT',
  revenue: 'CREDIT',
});

/**
 * Resolve the normal balance for presentation. Precedence (never account-code
 * ranges): CoA V2 configuration → legacy `normalBalance` column → category /
 * legacy type default → DEBIT with a configuration warning.
 * @param {object} account
 * @returns {{normalBalance: 'DEBIT'|'CREDIT', source: string, warning: string|null}}
 */
export function resolveNormalBalance(account) {
  const v2 = String(account?.coaV2NormalBalance ?? '').toUpperCase();
  if (v2 === 'DEBIT' || v2 === 'CREDIT') {
    return { normalBalance: v2, source: 'COA_V2', warning: null };
  }
  const legacy = String(account?.normalBalance ?? '').toUpperCase();
  if (legacy === 'DEBIT' || legacy === 'CREDIT') {
    return { normalBalance: legacy, source: 'LEGACY_COLUMN', warning: null };
  }
  const category = String(account?.coaV2Category ?? '').toUpperCase();
  if (CATEGORY_NORMAL_BALANCE[category]) {
    return { normalBalance: CATEGORY_NORMAL_BALANCE[category], source: 'CATEGORY_DEFAULT', warning: null };
  }
  const type = String(account?.accountType ?? account?.type ?? '').toLowerCase();
  if (LEGACY_TYPE_NORMAL_BALANCE[type]) {
    return { normalBalance: LEGACY_TYPE_NORMAL_BALANCE[type], source: 'TYPE_DEFAULT', warning: null };
  }
  return {
    normalBalance: 'DEBIT',
    source: 'FALLBACK',
    warning: 'Account has no normal-balance configuration; presented debit-normal.',
  };
}

/** Present a signed (debit-positive) minor balance under a normal balance. */
export function presentBalance(signedMinor, normalBalance) {
  const displayMinor = normalBalance === 'CREDIT' ? -signedMinor : signedMinor;
  return {
    signedMinor,
    displayMinor,
    display: minorToDecimalString(displayMinor),
    abnormal: displayMinor < 0,
  };
}

/* ── Account metadata ─────────────────────────────────────────────────────── */

const ACCOUNT_SELECT = Object.freeze({
  id: true,
  tenantId: true,
  accountCode: true,
  code: true,
  accountName: true,
  name: true,
  accountType: true,
  type: true,
  normalBalance: true,
  parentAccountId: true,
  mergedIntoAccountId: true,
  isActive: true,
  coaV2Category: true,
  coaV2SubType: true,
  coaV2Behaviour: true,
  coaV2NormalBalance: true,
  coaV2Status: true,
  postingAllowed: true,
  hierarchyPath: true,
  coaDepth: true,
  displayOrder: true,
  // Phase 7 — financial-statement mapping inputs (Phase 3 classification).
  financialStatementSection: true,
  financialStatementSubsection: true,
  cashFlowClassification: true,
  systemPurpose: true,
  controlAccountPurpose: true,
  consolidationGroup: true,
});

async function loadAccounts(db, tenantId) {
  const rows = await db.account.findMany({ where: { tenantId }, select: { ...ACCOUNT_SELECT } });
  return new Map(rows.map((a) => [a.id, a]));
}

function isHeaderAccount(account) {
  return account?.coaV2Behaviour === 'HEADER' || account?.postingAllowed === false;
}

function accountDisplay(account) {
  return {
    accountId: account.id,
    accountCode: account.accountCode || account.code || null,
    accountName: account.accountName || account.name || null,
    accountType: account.accountType || account.type || null,
    category: account.coaV2Category ?? null,
    behaviour: account.coaV2Behaviour ?? null,
    coaStatus: account.coaV2Status ?? null,
    parentAccountId: account.parentAccountId ?? null,
    isHeader: isHeaderAccount(account),
    // Phase 7 — explicit report-mapping inputs.
    coaV2SubType: account.coaV2SubType ?? null,
    financialStatementSection: account.financialStatementSection ?? null,
    financialStatementSubsection: account.financialStatementSubsection ?? null,
    cashFlowClassification: account.cashFlowClassification ?? null,
    systemPurpose: account.systemPurpose ?? null,
    controlAccountPurpose: account.controlAccountPurpose ?? null,
    consolidationGroup: account.consolidationGroup ?? null,
  };
}

/* ── Business ledger summary ──────────────────────────────────────────────── */

/**
 * Per-account ledger summary for a business and window: opening balance,
 * period debits/credits (raw, un-netted), closing balance, normal-balance
 * presentation and abnormal flags. Merged-away accounts roll up to survivors;
 * header accounts are presentation-only and flagged if they carry direct
 * activity (GL-110 anomaly → exceptional posting account for reports).
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context AccountingContext
 * @param {{startDate?: Date, endDate?: Date, branchId?: string|null,
 *          includeZeroActivity?: boolean}} [options]
 */
export async function getBusinessLedgerSummary(db, context, options = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const { startDate, endDate, branchId = null } = options;

  const accounts = await loadAccounts(db, tenantId);
  const { survivorOf } = buildSurvivorResolver(
    [...accounts.values()].map((a) => ({ id: a.id, mergedIntoAccountId: a.mergedIntoAccountId }))
  );

  const [openingTotals, movementTotals] = await Promise.all([
    startDate
      ? getCanonicalAccountTotals(db, context, {
          endDate: new Date(new Date(startDate).getTime() - 1),
          branchId,
        })
      : Promise.resolve(new Map()),
    getCanonicalAccountTotals(db, context, { startDate, endDate, branchId }),
  ]);

  // Roll posting-account totals up to merge survivors (presentation identity).
  const bySurvivor = new Map();
  const fold = (totals, key) => {
    for (const [accountId, t] of totals) {
      const sid = survivorOf(accountId) ?? accountId;
      const row = bySurvivor.get(sid) ?? {
        openingDebitMinor: 0,
        openingCreditMinor: 0,
        periodDebitMinor: 0,
        periodCreditMinor: 0,
        lineCount: 0,
      };
      if (key === 'opening') {
        row.openingDebitMinor += t.debitMinor;
        row.openingCreditMinor += t.creditMinor;
      } else {
        row.periodDebitMinor += t.debitMinor;
        row.periodCreditMinor += t.creditMinor;
        row.lineCount += t.lineCount;
      }
      bySurvivor.set(sid, row);
    }
  };
  fold(openingTotals, 'opening');
  fold(movementTotals, 'movement');

  const rows = [];
  const anomalies = [];
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;

  for (const [accountId, t] of bySurvivor) {
    const account = accounts.get(accountId);
    if (!account) {
      anomalies.push({
        rule: 'GL-113',
        accountId,
        message: 'Posted activity references an account row missing from this business chart.',
      });
      continue;
    }
    const { normalBalance, source, warning } = resolveNormalBalance(account);
    const openingSigned = t.openingDebitMinor - t.openingCreditMinor;
    const movementSigned = t.periodDebitMinor - t.periodCreditMinor;
    const closingSigned = openingSigned + movementSigned;
    const header = isHeaderAccount(account);
    const hasDirectActivity =
      t.periodDebitMinor !== 0 || t.periodCreditMinor !== 0 || openingSigned !== 0;
    const exceptionalPostingAccount = header && hasDirectActivity;
    if (exceptionalPostingAccount) {
      anomalies.push({
        rule: 'GL-110',
        accountId,
        message:
          'Header/non-posting account carries direct posted activity; treated as exceptional posting account (included once in reports).',
      });
    }
    totalDebitMinor += t.periodDebitMinor;
    totalCreditMinor += t.periodCreditMinor;
    rows.push({
      ...accountDisplay(account),
      normalBalance,
      normalBalanceSource: source,
      normalBalanceWarning: warning,
      opening: presentBalance(openingSigned, normalBalance),
      periodDebitMinor: t.periodDebitMinor,
      periodCreditMinor: t.periodCreditMinor,
      periodDebit: minorToDecimalString(t.periodDebitMinor),
      periodCredit: minorToDecimalString(t.periodCreditMinor),
      closing: presentBalance(closingSigned, normalBalance),
      lineCount: t.lineCount,
      hasDirectActivity,
      exceptionalPostingAccount,
    });
  }

  if (options.includeZeroActivity) {
    for (const account of accounts.values()) {
      if (bySurvivor.has(account.id)) continue;
      if (account.mergedIntoAccountId) continue; // merged-away: activity shown on survivor
      const { normalBalance, source, warning } = resolveNormalBalance(account);
      rows.push({
        ...accountDisplay(account),
        normalBalance,
        normalBalanceSource: source,
        normalBalanceWarning: warning,
        opening: presentBalance(0, normalBalance),
        periodDebitMinor: 0,
        periodCreditMinor: 0,
        periodDebit: '0.00',
        periodCredit: '0.00',
        closing: presentBalance(0, normalBalance),
        lineCount: 0,
        hasDirectActivity: false,
        exceptionalPostingAccount: false,
      });
    }
  }

  rows.sort((a, b) => String(a.accountCode ?? '').localeCompare(String(b.accountCode ?? '')));

  return {
    accounts: rows,
    totals: {
      periodDebitMinor: totalDebitMinor,
      periodCreditMinor: totalCreditMinor,
      periodDebit: minorToDecimalString(totalDebitMinor),
      periodCredit: minorToDecimalString(totalCreditMinor),
      balanced: totalDebitMinor === totalCreditMinor,
      differenceMinor: totalDebitMinor - totalCreditMinor,
    },
    anomalies,
    sourcePolicy: {
      source: 'canonical posted journal lines (Transaction + non-mirror JournalEntry)',
      storedBalancesUsed: false,
      arithmetic: 'integer minor units',
    },
  };
}

/* ── Account activity (drill-down) ────────────────────────────────────────── */

/**
 * Account ledger activity with chronological running balances and stable
 * pagination. Merged-away account ids roll into the requested survivor: the
 * activity view includes lines posted to every account that merges into it,
 * with the original posting account preserved on each line.
 *
 * Running balances are computed over the canonical ASCENDING order; when
 * `order` is 'desc' the computed rows are presented newest-first without
 * recomputing (fixes legacy defect P5-I04).
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {{
 *   accountId: string, startDate?: Date, endDate?: Date, branchId?: string|null,
 *   currency?: string|null, dimensionKey?: string|null, dimensionValue?: string|null,
 *   page?: number, pageSize?: number, order?: 'asc'|'desc',
 * }} options
 */
export async function getAccountLedger(db, context, options) {
  assertLedgerContext(context);
  if (!options?.accountId) {
    throw new AccountingValidationError('accountId is required for account ledger queries.', [
      { path: 'accountId', message: 'required' },
    ]);
  }
  const tenantId = context.businessId;
  const account = await db.account.findFirst({
    where: { id: options.accountId, tenantId },
    select: { ...ACCOUNT_SELECT },
  });
  if (!account) {
    throw new AccountingValidationError('Account not found in this business.', [
      { path: 'accountId', message: 'unknown or cross-business account' },
    ]);
  }

  const accounts = await loadAccounts(db, tenantId);
  const { survivorOf, allIdsRollingInto } = buildSurvivorResolver(
    [...accounts.values()].map((a) => ({ id: a.id, mergedIntoAccountId: a.mergedIntoAccountId }))
  );
  const survivorId = survivorOf(account.id) ?? account.id;
  const memberIds = allIdsRollingInto(survivorId);

  const { normalBalance, source, warning } = resolveNormalBalance(account);
  const sign = (line) => line.debitMinor - line.creditMinor;

  // Opening: all canonical activity for the rollup group before the window.
  let openingSigned = 0;
  if (options.startDate) {
    const openingTotals = await getCanonicalAccountTotals(db, context, {
      endDate: new Date(new Date(options.startDate).getTime() - 1),
      branchId: options.branchId ?? null,
      accountIds: memberIds,
    });
    for (const t of openingTotals.values()) {
      openingSigned += t.debitMinor - t.creditMinor;
    }
  }

  const lines = await listCanonicalLines(db, context, {
    accountIds: memberIds,
    startDate: options.startDate,
    endDate: options.endDate,
    branchId: options.branchId ?? null,
    currency: options.currency ?? null,
    dimensionKey: options.dimensionKey ?? null,
    dimensionValue: options.dimensionValue ?? null,
  });

  // Chronological running balance over the FULL window, then paginate.
  let running = openingSigned;
  let periodDebitMinor = 0;
  let periodCreditMinor = 0;
  const enriched = lines.map((line) => {
    running += sign(line);
    periodDebitMinor += line.debitMinor;
    periodCreditMinor += line.creditMinor;
    return {
      ...line,
      debit: minorToDecimalString(line.debitMinor),
      credit: minorToDecimalString(line.creditMinor),
      runningBalance: presentBalance(running, normalBalance),
      postingAccountId: line.accountId,
      rolledUpFromMergedAccount: line.accountId !== survivorId,
    };
  });

  const closingSigned = running;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, options.pageSize ?? 50));
  const ordered = options.order === 'desc' ? [...enriched].reverse() : enriched;
  const pageRows = ordered.slice((page - 1) * pageSize, page * pageSize);

  return {
    account: {
      ...accountDisplay(account),
      normalBalance,
      normalBalanceSource: source,
      normalBalanceWarning: warning,
      mergeRollupMemberIds: memberIds,
    },
    opening: presentBalance(openingSigned, normalBalance),
    period: {
      debitMinor: periodDebitMinor,
      creditMinor: periodCreditMinor,
      debit: minorToDecimalString(periodDebitMinor),
      credit: minorToDecimalString(periodCreditMinor),
    },
    closing: presentBalance(closingSigned, normalBalance),
    lines: pageRows,
    pagination: { page, pageSize, totalLines: enriched.length, order: options.order ?? 'asc' },
  };
}

/* ── Hierarchy view ───────────────────────────────────────────────────────── */

/**
 * Ledger summary organized as an account tree (R4-A):
 * - Posting accounts carry their own balances.
 * - Header rollups = children only (never parent stored balance + children).
 * - Exceptional direct activity on a header is kept on the node once and folded
 *   into ancestor rollups without double-counting against children.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {{startDate?: Date, endDate?: Date, branchId?: string|null}} [options]
 */
export async function getLedgerHierarchy(db, context, options = {}) {
  const summary = await getBusinessLedgerSummary(db, context, {
    ...options,
    includeZeroActivity: true,
  });
  const byId = new Map(summary.accounts.map((r) => [r.accountId, { ...r, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parentAccountId ? byId.get(node.parentAccountId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const aggregate = (node) => {
    let childOpening = 0;
    let childDebit = 0;
    let childCredit = 0;
    for (const child of node.children) {
      const agg = aggregate(child);
      childOpening += agg.opening;
      childDebit += agg.debit;
      childCredit += agg.credit;
    }

    const ownOpening = node.opening.signedMinor;
    const ownDebit = node.periodDebitMinor;
    const ownCredit = node.periodCreditMinor;

    if (node.isHeader) {
      // Presentation rollup is children-only (R4-A rule 2).
      if (node.children.length > 0) {
        node.rollup = {
          opening: presentBalance(childOpening, node.normalBalance),
          periodDebit: minorToDecimalString(childDebit),
          periodCredit: minorToDecimalString(childCredit),
          closing: presentBalance(childOpening + childDebit - childCredit, node.normalBalance),
          presentationOnly: true,
          excludesOwnDirectActivity: Boolean(node.exceptionalPostingAccount),
        };
      }
      // Exceptional direct activity contributes once to ancestors; clean headers contribute 0.
      const exceptional = Boolean(node.exceptionalPostingAccount);
      return {
        opening: childOpening + (exceptional ? ownOpening : 0),
        debit: childDebit + (exceptional ? ownDebit : 0),
        credit: childCredit + (exceptional ? ownCredit : 0),
      };
    }

    const opening = ownOpening + childOpening;
    const debit = ownDebit + childDebit;
    const credit = ownCredit + childCredit;
    if (node.children.length > 0) {
      node.rollup = {
        opening: presentBalance(opening, node.normalBalance),
        periodDebit: minorToDecimalString(debit),
        periodCredit: minorToDecimalString(credit),
        closing: presentBalance(opening + debit - credit, node.normalBalance),
        presentationOnly: false,
      };
    }
    return { opening, debit, credit };
  };
  for (const root of roots) aggregate(root);

  const sortTree = (nodes) => {
    nodes.sort((a, b) => String(a.accountCode ?? '').localeCompare(String(b.accountCode ?? '')));
    for (const n of nodes) sortTree(n.children);
  };
  sortTree(roots);

  return { tree: roots, totals: summary.totals, anomalies: summary.anomalies };
}
