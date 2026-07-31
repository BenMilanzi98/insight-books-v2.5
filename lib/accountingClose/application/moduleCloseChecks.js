/**
 * Year-end module close checks — consume existing reconciliations / GL signals.
 * Returns readiness-shaped check objects (code, status, blocking, message, evidence).
 */

import {
  reconcileAccountsReceivable,
  reconcileAccountsPayable,
} from '../../glReconciliation.js';
import { runEquityReconciliation } from '../../equityManagement/application/reconciliationService.js';

function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function checkFromReconcile(code, label, result) {
  if (!result) {
    return {
      code,
      status: 'PASSED_WITH_WARNING',
      message: `${label}: reconciliation unavailable — manual evidence required.`,
    };
  }
  if (result.isReconciled) {
    return {
      code,
      status: 'PASSED',
      message: `${label} reconciles (Δ ${Number(result.delta || 0).toFixed(2)}).`,
      evidence: {
        glBalance: result.glBalance,
        subledgerTotal: result.subledgerTotal,
        delta: result.delta,
      },
    };
  }
  return {
    code,
    status: 'FAILED',
    blocking: true,
    message: `${label} difference ${Number(result.delta || 0).toFixed(2)} exceeds tolerance.`,
    evidence: {
      glBalance: result.glBalance,
      subledgerTotal: result.subledgerTotal,
      delta: result.delta,
      controlAccountCode: result.controlAccountCode,
    },
  };
}

async function countByPurpose(db, tenantId, purposes) {
  if (!db.account?.count) return 0;
  return db.account.count({
    where: {
      tenantId,
      isActive: true,
      OR: purposes.flatMap((p) => [
        { systemPurpose: p },
        { controlAccountPurpose: p },
        { coaV2SubType: p },
      ]),
    },
  });
}

async function unpostedSourceCount(db, model, tenantId, dateField, start, end, statusField = 'status') {
  if (!db[model]?.count) return null;
  try {
    return db[model].count({
      where: {
        tenantId,
        [dateField]: { gte: start, lte: end },
        OR: [
          { accountingStatus: { in: ['PENDING', 'FAILED', 'DRAFT', 'READY'] } },
          { [statusField]: { in: ['DRAFT', 'PENDING', 'APPROVED'] }, journalEntryId: null },
        ],
      },
    });
  } catch {
    try {
      return db[model].count({
        where: {
          tenantId,
          [dateField]: { gte: start, lte: end },
          journalEntryId: null,
        },
      });
    } catch {
      return null;
    }
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {{ startDate: Date|string, endDate: Date|string }} fy
 */
export async function runModuleCloseChecks(db, context, fy) {
  const tenantId = context.businessId;
  const asOf = iso(fy.endDate);
  const start = new Date(fy.startDate);
  const end = new Date(fy.endDate);
  const checks = [];

  // Receivables / Payables
  try {
    const ar = await reconcileAccountsReceivable(tenantId, asOf, context.branchId ?? null, db);
    checks.push(checkFromReconcile('YE_AR_RECONCILE', 'Receivables', ar));
  } catch (err) {
    checks.push({
      code: 'YE_AR_RECONCILE',
      status: 'PASSED_WITH_WARNING',
      message: `Receivables check error: ${err.message}`,
    });
  }

  try {
    const ap = await reconcileAccountsPayable(tenantId, asOf, context.branchId ?? null, db);
    checks.push(checkFromReconcile('YE_AP_RECONCILE', 'Payables', ap));
  } catch (err) {
    checks.push({
      code: 'YE_AP_RECONCILE',
      status: 'PASSED_WITH_WARNING',
      message: `Payables check error: ${err.message}`,
    });
  }

  // Inventory — GL control presence + unposted stock adjustments if model exists
  try {
    const invAccounts = await countByPurpose(db, tenantId, ['INVENTORY', 'INVENTORY_ASSET', 'STOCK']);
    const unpostedAdj = await unpostedSourceCount(db, 'stockAdjustment', tenantId, 'adjustmentDate', start, end);
    if (invAccounts === 0) {
      checks.push({
        code: 'YE_INVENTORY_FINAL',
        status: 'PASSED_WITH_WARNING',
        message: 'No inventory control account mapped — confirm N/A or configure CoA.',
      });
    } else if (unpostedAdj != null && unpostedAdj > 0) {
      checks.push({
        code: 'YE_INVENTORY_FINAL',
        status: 'FAILED',
        blocking: true,
        message: `${unpostedAdj} inventory adjustment(s) without journals in the year.`,
        evidence: { unpostedAdj },
      });
    } else {
      checks.push({
        code: 'YE_INVENTORY_FINAL',
        status: 'PASSED',
        message: 'Inventory control mapped; no unposted year adjustments detected.',
        evidence: { inventoryAccounts: invAccounts, unpostedAdj },
      });
    }
  } catch (err) {
    checks.push({
      code: 'YE_INVENTORY_FINAL',
      status: 'PASSED_WITH_WARNING',
      message: `Inventory check inconclusive: ${err.message}`,
    });
  }

  // Payroll
  try {
    const unpostedPayroll =
      (await unpostedSourceCount(db, 'payrollRun', tenantId, 'payPeriodEnd', start, end)) ??
      (await unpostedSourceCount(db, 'payroll', tenantId, 'periodEnd', start, end));
    if (unpostedPayroll != null && unpostedPayroll > 0) {
      checks.push({
        code: 'YE_PAYROLL_FINAL',
        status: 'FAILED',
        blocking: true,
        message: `${unpostedPayroll} payroll run(s) not fully posted for the year.`,
      });
    } else {
      checks.push({
        code: 'YE_PAYROLL_FINAL',
        status: unpostedPayroll == null ? 'PASSED_WITH_WARNING' : 'PASSED',
        message:
          unpostedPayroll == null
            ? 'Payroll source model not detected — complete manual YE payroll checklist.'
            : 'No unposted payroll runs detected for the year.',
      });
    }
  } catch (err) {
    checks.push({
      code: 'YE_PAYROLL_FINAL',
      status: 'PASSED_WITH_WARNING',
      message: `Payroll check inconclusive: ${err.message}`,
    });
  }

  // Fixed assets / depreciation
  try {
    let deprPosted = null;
    if (db.journalEntry?.count) {
      deprPosted = await db.journalEntry.count({
        where: {
          tenantId,
          entryDate: { gte: start, lte: end },
          status: { in: ['Posted', 'POSTED'] },
          OR: [
            { description: { contains: 'Depreciation', mode: 'insensitive' } },
            { metadata: { path: ['templateId'], equals: 'DEPRECIATION' } },
          ],
        },
      });
    }
    const assetCount = db.asset?.count
      ? await db.asset.count({ where: { tenantId, isActive: true } }).catch(() => null)
      : null;
    if (assetCount != null && assetCount > 0 && deprPosted === 0) {
      checks.push({
        code: 'YE_ASSETS_DEPR',
        status: 'FAILED',
        blocking: true,
        message: `${assetCount} active asset(s) but no depreciation journals found in the year.`,
        evidence: { assetCount, deprPosted },
      });
    } else {
      checks.push({
        code: 'YE_ASSETS_DEPR',
        status: assetCount == null ? 'PASSED_WITH_WARNING' : 'PASSED',
        message:
          assetCount == null
            ? 'Fixed-asset register not queried — complete manual depreciation checklist.'
            : `Asset register OK (${assetCount}); depreciation journals in year: ${deprPosted ?? 0}.`,
        evidence: { assetCount, deprPosted },
      });
    }
  } catch (err) {
    checks.push({
      code: 'YE_ASSETS_DEPR',
      status: 'PASSED_WITH_WARNING',
      message: `Fixed-asset check inconclusive: ${err.message}`,
    });
  }

  // Loans
  try {
    const loanAccounts = await countByPurpose(db, tenantId, [
      'LOAN_PAYABLE',
      'LONG_TERM_LOAN',
      'INTEREST_PAYABLE',
    ]);
    const loanCount = db.loan?.count
      ? await db.loan.count({ where: { tenantId, status: { not: 'CLOSED' } } }).catch(() => null)
      : null;
    checks.push({
      code: 'YE_LOANS_FINAL',
      status: loanCount == null && loanAccounts === 0 ? 'PASSED_WITH_WARNING' : 'PASSED',
      message:
        loanCount != null
          ? `${loanCount} open loan(s); ${loanAccounts} loan-related CoA mapping(s). Review interest accruals.`
          : loanAccounts > 0
            ? 'Loan GL mappings present — confirm interest finalized on checklist.'
            : 'No loan module data — confirm N/A on checklist.',
      evidence: { loanCount, loanAccounts },
    });
  } catch (err) {
    checks.push({
      code: 'YE_LOANS_FINAL',
      status: 'PASSED_WITH_WARNING',
      message: `Loan check inconclusive: ${err.message}`,
    });
  }

  // Tax
  try {
    const taxAccounts = await countByPurpose(db, tenantId, [
      'VAT_PAYABLE',
      'VAT_CONTROL',
      'TAX_PAYABLE',
      'PAYE_PAYABLE',
      'CORPORATE_TAX_PAYABLE',
    ]);
    checks.push({
      code: 'YE_TAX_FINAL',
      status: taxAccounts > 0 ? 'PASSED' : 'PASSED_WITH_WARNING',
      message:
        taxAccounts > 0
          ? `${taxAccounts} tax control account(s) mapped — review VAT/PAYE/corporate tax on checklist.`
          : 'No tax control mappings found — confirm N/A or configure CoA.',
      evidence: { taxAccounts },
    });
  } catch (err) {
    checks.push({
      code: 'YE_TAX_FINAL',
      status: 'PASSED_WITH_WARNING',
      message: `Tax check inconclusive: ${err.message}`,
    });
  }

  // Equity — live run
  try {
    const equity = await runEquityReconciliation(db, context, { asOfDate: asOf });
    const findings = equity.findings || [];
    const critical = findings.filter((f) =>
      ['CRITICAL', 'HIGH'].includes(String(f.severity || '').toUpperCase())
    );
    const equityFailed = critical.length > 0 || equity.overallOk === false;
    checks.push({
      code: 'YE_EQUITY_RECONCILE',
      status: equityFailed ? 'FAILED' : 'PASSED',
      blocking: equityFailed,
      message: equityFailed
        ? `Equity reconciliation has ${critical.length || findings.length} material finding(s).`
        : 'Equity reconciliation passed.',
      evidence: { findingCount: findings.length, overallOk: equity.overallOk, runId: equity.id },
    });

    const drawingsOk = !findings.some((f) =>
      /DRAW|DIVIDEND/i.test(String(f.ruleCode || '') + String(f.message || ''))
    );
    checks.push({
      code: 'YE_DRAWINGS_DIVIDENDS',
      status: drawingsOk ? 'PASSED' : 'FAILED',
      blocking: !drawingsOk,
      message: drawingsOk
        ? 'No drawings/dividend integrity failures in equity recon.'
        : 'Drawings/dividend findings present — review before close.',
    });

    checks.push({
      code: 'YE_RE_CYE',
      status: 'PASSED',
      message: 'CYE MODEL A: profit transfers once via Closing Journals (no dual CYE control).',
    });
  } catch (err) {
    checks.push({
      code: 'YE_EQUITY_RECONCILE',
      status: 'PASSED_WITH_WARNING',
      message: `Equity recon unavailable: ${err.message}`,
    });
    checks.push({
      code: 'YE_DRAWINGS_DIVIDENDS',
      status: 'PASSED_WITH_WARNING',
      message: 'Complete drawings/dividend manual checklist.',
    });
    checks.push({
      code: 'YE_RE_CYE',
      status: 'PASSED_WITH_WARNING',
      message: 'Confirm RE/CYE configuration on close config.',
    });
  }

  return checks;
}
