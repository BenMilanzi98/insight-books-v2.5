/**
 * Wave 5 — Tax + Reversal reconciliation engines (read-only).
 */

import prisma from '../prisma.js';
import { modelsAvailable } from './periodStatuses.js';
import { sumAccumulatedTax } from './taxTransactionSubledger.js';

function variance(a, b) {
  return Number((Number(a || 0) - Number(b || 0)).toFixed(2));
}

/**
 * Subledger (TaxTransaction) vs GL lines on tax-linked accounts for a date range.
 */
export async function reconcileTaxSubledgerToGl({
  tenantId,
  startDate,
  endDate,
  db = prisma,
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const taxTypes = await db.taxType.findMany({
    where: { tenantId },
    select: { id: true, accountId: true, taxName: true, taxCode: true },
  });
  const accountIds = [...new Set(taxTypes.map((t) => t.accountId).filter(Boolean))];

  let glNet = 0;
  if (accountIds.length > 0) {
    const lines = await db.journalEntryLine.findMany({
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          tenantId,
          architectureVersion: 'ACCOUNTING_V2',
          status: 'Posted',
          OR: [
            { postingDate: { gte: start, lte: end } },
            { entryDate: { gte: start, lte: end } },
          ],
        },
      },
      select: { debitAmount: true, creditAmount: true },
    });
    for (const line of lines) {
      glNet += Number(line.debitAmount || 0) - Number(line.creditAmount || 0);
    }
  }
  glNet = Number(glNet.toFixed(2));

  const sub = await sumAccumulatedTax({
    tenantId,
    startDate,
    endDate,
    db,
  });
  const subledgerNet = sub.available ? Number(sub.total || 0) : null;

  return {
    kind: 'SUBLEDGER_VS_GL',
    startDate,
    endDate,
    subledgerAvailable: Boolean(sub.available),
    subledgerNet,
    glNet,
    variance: subledgerNet == null ? null : variance(subledgerNet, glNet),
    status:
      subledgerNet == null
        ? 'SUBLEDGER_EMPTY'
        : Math.abs(variance(subledgerNet, glNet)) < 0.02
          ? 'MATCHED'
          : 'VARIANCE',
    taxAccountCount: accountIds.length,
  };
}

/**
 * Filed/draft return totals vs subledger for the return's period.
 */
export async function reconcileReturnToTransactions({
  tenantId,
  returnId,
  db = prisma,
}) {
  if (!modelsAvailable(db, 'taxReturn')) {
    return { kind: 'RETURN_VS_TX', status: 'UNAVAILABLE' };
  }
  const taxReturn = await db.taxReturn.findFirst({
    where: { id: returnId, tenantId },
    include: { taxPeriod: true },
  });
  if (!taxReturn) {
    const err = new Error('Tax return not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const period = taxReturn.taxPeriod;
  const output = await sumAccumulatedTax({
    tenantId,
    purpose: 'VAT_OUTPUT',
    startDate: period.startDate,
    endDate: period.endDate,
    db,
  });
  const input = await sumAccumulatedTax({
    tenantId,
    purpose: 'VAT_INPUT',
    startDate: period.startDate,
    endDate: period.endDate,
    db,
  });
  const payable = await sumAccumulatedTax({
    tenantId,
    purpose: 'TAX_PAYABLE',
    startDate: period.startDate,
    endDate: period.endDate,
    db,
  });

  let computedNet;
  if (output.available || input.available) {
    const out = Math.max(0, -Number(output.total || 0));
    const inn = Math.max(0, Number(input.total || 0));
    computedNet = Number((out - inn).toFixed(2));
  } else if (payable.available) {
    computedNet = Number((-Number(payable.total || 0)).toFixed(2));
  } else {
    computedNet = null;
  }

  const returnNet = Number(taxReturn.netTax || 0);
  return {
    kind: 'RETURN_VS_TX',
    returnId: taxReturn.id,
    periodCode: period.code,
    returnNet,
    computedNet,
    variance: computedNet == null ? null : variance(returnNet, computedNet),
    status:
      computedNet == null
        ? 'SUBLEDGER_EMPTY'
        : Math.abs(variance(returnNet, computedNet)) < 0.02
          ? 'MATCHED'
          : 'VARIANCE',
  };
}

/**
 * Reversal journal linkage: originals with reversedByJournalId must point to a Posted reversal.
 */
export async function reconcileReversalJournalLinkage({
  tenantId,
  limit = 100,
  db = prisma,
}) {
  const reversed = await db.journalEntry.findMany({
    where: {
      tenantId,
      architectureVersion: 'ACCOUNTING_V2',
      status: 'Posted',
      OR: [
        { reversalStatus: 'REVERSED' },
        { reversedByJournalId: { not: null } },
      ],
    },
    select: {
      id: true,
      journalNumber: true,
      reversedByJournalId: true,
      originalJournalId: true,
      reversalStatus: true,
      sourceType: true,
      sourceId: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  const issues = [];
  let checked = 0;
  for (const je of reversed) {
    checked += 1;
    if (!je.reversedByJournalId) {
      issues.push({
        journalId: je.id,
        journalNumber: je.journalNumber,
        issue: 'MISSING_REVERSAL_LINK',
      });
      continue;
    }
    const rev = await db.journalEntry.findFirst({
      where: {
        id: je.reversedByJournalId,
        tenantId,
        architectureVersion: 'ACCOUNTING_V2',
      },
      select: { id: true, status: true, originalJournalId: true },
    });
    if (!rev) {
      issues.push({
        journalId: je.id,
        journalNumber: je.journalNumber,
        issue: 'REVERSAL_JOURNAL_MISSING',
      });
      continue;
    }
    if (rev.status !== 'Posted') {
      issues.push({
        journalId: je.id,
        journalNumber: je.journalNumber,
        issue: 'REVERSAL_NOT_POSTED',
        reversalJournalId: rev.id,
      });
    }
    if (rev.originalJournalId && rev.originalJournalId !== je.id) {
      issues.push({
        journalId: je.id,
        journalNumber: je.journalNumber,
        issue: 'BIDIRECTIONAL_LINK_MISMATCH',
        reversalJournalId: rev.id,
      });
    }
  }

  // Register vs document dual-run sample
  let registerOrphans = 0;
  if (modelsAvailable(db, 'transactionReversal')) {
    const completed = await db.transactionReversal.findMany({
      where: { tenantId, status: 'COMPLETED' },
      select: { id: true, sourceType: true, sourceId: true, reversalDocumentId: true },
      take: 50,
    });
    for (const row of completed) {
      if (!row.reversalDocumentId) registerOrphans += 1;
    }
  }

  return {
    kind: 'REVERSAL_JOURNAL_LINKAGE',
    checked,
    issueCount: issues.length,
    issues: issues.slice(0, 50),
    registerOrphans,
    status: issues.length === 0 ? 'MATCHED' : 'VARIANCE',
  };
}

export async function runTaxReconciliationSuite({
  tenantId,
  startDate,
  endDate,
  returnId = null,
  db = prisma,
}) {
  const subledgerVsGl = await reconcileTaxSubledgerToGl({
    tenantId,
    startDate,
    endDate,
    db,
  });
  const reversalLinkage = await reconcileReversalJournalLinkage({ tenantId, db });
  let returnVsTx = null;
  if (returnId) {
    returnVsTx = await reconcileReturnToTransactions({ tenantId, returnId, db });
  }

  const statuses = [subledgerVsGl.status, reversalLinkage.status];
  if (returnVsTx) statuses.push(returnVsTx.status);
  let overall = 'PARTIAL';
  if (statuses.includes('VARIANCE')) overall = 'VARIANCE';
  else if (statuses.every((s) => s === 'MATCHED')) overall = 'MATCHED';

  return {
    overall,
    ranAt: new Date().toISOString(),
    results: { subledgerVsGl, returnVsTx, reversalLinkage },
  };
}

