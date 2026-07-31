/**
 * Pure Closing Journal line generator.
 * Uses adjusted GL balances (signedMinor: debit-positive).
 * Never closes permanent Balance Sheet accounts.
 */

import { createHash } from 'crypto';
import { CloseMethod, ClosingLineRole } from './enums.js';
import {
  isTemporaryIncomeStatementAccount,
  isDrawingsAccount,
  roleForTemporaryCategory,
  validateTemporaryAccountClassification,
} from './temporaryAccounts.js';
import { ClosingJournalUnbalancedError, InvalidClosingMethodError } from './errors.js';

function minorToDecimal(minor) {
  const n = Number(minor || 0);
  return (n / 100).toFixed(2);
}

/**
 * @param {object} params
 * @param {Array<{accountId, accountCode, accountName, category, subType?, isHeader?, rawNetMinor}>} params.accounts
 * @param {string} params.closingMethod
 * @param {string} params.destinationAccountId Retained Earnings / Owner Capital / Fund
 * @param {{accountId, accountCode?, accountName?} | null} params.incomeSummaryAccount
 * @param {{accountId, accountCode?, accountName?} | null} [params.ownerCapitalAccount]
 * @param {boolean} [params.closeDrawings]
 * @param {Array<{partnerAccountId, shareMinor}>} [params.partnerAllocations] shares of 10_000 = 100%
 */
export function generateClosingJournalPreview(params) {
  const {
    closingMethod,
    destinationAccountId,
    incomeSummaryAccount = null,
    ownerCapitalAccount = null,
    closeDrawings = true,
    partnerAllocations = [],
    accounts,
  } = params;

  if (!destinationAccountId) {
    throw new InvalidClosingMethodError('Profit/loss destination account is required.');
  }

  const defects = validateTemporaryAccountClassification(accounts);
  const materialDefects = defects.filter((d) => d.code === 'CLS-005' || d.code === 'CLS-010');
  if (materialDefects.length) {
    throw new InvalidClosingMethodError(
      `Temporary account classification defects: ${materialDefects.map((d) => d.message).join('; ')}`
    );
  }

  const temps = accounts.filter(
    (a) => !a.isHeader && isTemporaryIncomeStatementAccount(a) && Number(a.rawNetMinor || 0) !== 0
  );
  const drawings = closeDrawings
    ? accounts.filter((a) => !a.isHeader && isDrawingsAccount(a) && Number(a.rawNetMinor || 0) !== 0)
    : [];

  /** Net P/L from temporary accounts: credit-normal revenue → negative signed = profit contribution */
  let profitMinor = 0;
  for (const a of temps) {
    // signedMinor is debit-positive; profit = credits − debits on IS = −sum(signed)
    profitMinor -= Number(a.rawNetMinor || 0);
  }

  const lines = [];
  let seq = 0;
  const push = (line) => {
    seq += 1;
    lines.push({ sequence: seq, ...line });
  };

  const useIncomeSummary =
    closingMethod === CloseMethod.INCOME_SUMMARY_TO_RETAINED_EARNINGS ||
    closingMethod === CloseMethod.PARTNER_CAPITAL_ALLOCATION;

  if (useIncomeSummary && !incomeSummaryAccount?.accountId) {
    throw new InvalidClosingMethodError('Income Summary account is required for this closing method.');
  }

  if (useIncomeSummary) {
    for (const a of temps) {
      const bal = Number(a.rawNetMinor || 0);
      const role = roleForTemporaryCategory(a.category || a.accountType, a.subType || a.coaV2SubType);
      if (bal < 0) {
        // Credit balance (typical revenue) → Dr account, Cr Income Summary
        const amount = -bal;
        push({
          accountId: a.accountId,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountCategory: a.category,
          lineRole: role,
          debitMinor: amount,
          creditMinor: 0,
          description: `Close ${a.accountCode} to Income Summary`,
        });
        push({
          accountId: incomeSummaryAccount.accountId,
          accountCode: incomeSummaryAccount.accountCode,
          accountName: incomeSummaryAccount.accountName || 'Income Summary',
          accountCategory: 'EQUITY',
          lineRole: ClosingLineRole.INCOME_SUMMARY,
          debitMinor: 0,
          creditMinor: amount,
          description: `Income Summary — close ${a.accountCode}`,
        });
      } else if (bal > 0) {
        // Debit balance (typical expense) → Dr Income Summary, Cr account
        push({
          accountId: incomeSummaryAccount.accountId,
          accountCode: incomeSummaryAccount.accountCode,
          accountName: incomeSummaryAccount.accountName || 'Income Summary',
          accountCategory: 'EQUITY',
          lineRole: ClosingLineRole.INCOME_SUMMARY,
          debitMinor: bal,
          creditMinor: 0,
          description: `Income Summary — close ${a.accountCode}`,
        });
        push({
          accountId: a.accountId,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountCategory: a.category,
          lineRole: role,
          debitMinor: 0,
          creditMinor: bal,
          description: `Close ${a.accountCode} to Income Summary`,
        });
      }
    }

    // Transfer Income Summary balance to permanent equity (Income Summary → 0)
    if (profitMinor > 0) {
      push({
        accountId: incomeSummaryAccount.accountId,
        accountCode: incomeSummaryAccount.accountCode,
        accountName: incomeSummaryAccount.accountName || 'Income Summary',
        accountCategory: 'EQUITY',
        lineRole: ClosingLineRole.INCOME_SUMMARY,
        debitMinor: profitMinor,
        creditMinor: 0,
        description: 'Transfer net profit from Income Summary',
      });
      if (closingMethod === CloseMethod.PARTNER_CAPITAL_ALLOCATION && partnerAllocations.length) {
        allocatePartners(push, partnerAllocations, profitMinor, true);
      } else {
        push({
          accountId: destinationAccountId,
          accountCode: null,
          accountName: null,
          accountCategory: 'EQUITY',
          lineRole: ClosingLineRole.PROFIT_TRANSFER,
          debitMinor: 0,
          creditMinor: profitMinor,
          description: 'Transfer net profit to permanent equity',
        });
      }
    } else if (profitMinor < 0) {
      const loss = -profitMinor;
      push({
        accountId: incomeSummaryAccount.accountId,
        accountCode: incomeSummaryAccount.accountCode,
        accountName: incomeSummaryAccount.accountName || 'Income Summary',
        accountCategory: 'EQUITY',
        lineRole: ClosingLineRole.INCOME_SUMMARY,
        debitMinor: 0,
        creditMinor: loss,
        description: 'Transfer net loss from Income Summary',
      });
      if (closingMethod === CloseMethod.PARTNER_CAPITAL_ALLOCATION && partnerAllocations.length) {
        allocatePartners(push, partnerAllocations, loss, false);
      } else {
        push({
          accountId: destinationAccountId,
          accountCode: null,
          accountName: null,
          accountCategory: 'EQUITY',
          lineRole: ClosingLineRole.LOSS_TRANSFER,
          debitMinor: loss,
          creditMinor: 0,
          description: 'Transfer net loss to permanent equity',
        });
      }
    }
  } else {
    // DIRECT / OWNER_CAPITAL / FUND — close each temp directly against destination
    for (const a of temps) {
      const bal = Number(a.rawNetMinor || 0);
      const role = roleForTemporaryCategory(a.category || a.accountType, a.subType || a.coaV2SubType);
      if (bal < 0) {
        const amount = -bal;
        push({
          accountId: a.accountId,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountCategory: a.category,
          lineRole: role,
          debitMinor: amount,
          creditMinor: 0,
          description: `Close ${a.accountCode}`,
        });
        push({
          accountId: destinationAccountId,
          lineRole: ClosingLineRole.PROFIT_TRANSFER,
          accountCategory: 'EQUITY',
          debitMinor: 0,
          creditMinor: amount,
          description: `Close ${a.accountCode} to equity destination`,
        });
      } else if (bal > 0) {
        push({
          accountId: a.accountId,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountCategory: a.category,
          lineRole: role,
          debitMinor: 0,
          creditMinor: bal,
          description: `Close ${a.accountCode}`,
        });
        push({
          accountId: destinationAccountId,
          lineRole: ClosingLineRole.LOSS_TRANSFER,
          accountCategory: 'EQUITY',
          debitMinor: bal,
          creditMinor: 0,
          description: `Close ${a.accountCode} to equity destination`,
        });
      }
    }
  }

  // Drawings → Owner Capital (not Income Statement)
  const capitalForDrawings = ownerCapitalAccount?.accountId || destinationAccountId;
  for (const a of drawings) {
    const bal = Number(a.rawNetMinor || 0); // typically debit
    if (bal > 0) {
      push({
        accountId: capitalForDrawings,
        accountCategory: 'EQUITY',
        lineRole: ClosingLineRole.CLOSE_DRAWINGS,
        debitMinor: bal,
        creditMinor: 0,
        description: `Close drawings ${a.accountCode} to capital`,
      });
      push({
        accountId: a.accountId,
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountCategory: a.category,
        lineRole: ClosingLineRole.CLOSE_DRAWINGS,
        debitMinor: 0,
        creditMinor: bal,
        description: `Close drawings ${a.accountCode}`,
      });
    } else if (bal < 0) {
      const amount = -bal;
      push({
        accountId: a.accountId,
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountCategory: a.category,
        lineRole: ClosingLineRole.CLOSE_DRAWINGS,
        debitMinor: amount,
        creditMinor: 0,
        description: `Close drawings ${a.accountCode}`,
      });
      push({
        accountId: capitalForDrawings,
        accountCategory: 'EQUITY',
        lineRole: ClosingLineRole.CLOSE_DRAWINGS,
        debitMinor: 0,
        creditMinor: amount,
        description: `Close drawings ${a.accountCode} to capital`,
      });
    }
  }

  const totalDebit = lines.reduce((s, l) => s + Number(l.debitMinor || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.creditMinor || 0), 0);
  if (totalDebit !== totalCredit) {
    throw new ClosingJournalUnbalancedError(
      `Closing journal unbalanced: Dr ${minorToDecimal(totalDebit)} Cr ${minorToDecimal(totalCredit)}`
    );
  }

  // Forbid permanent BS in close roles other than transfer/drawings
  for (const l of lines) {
    const cat = String(l.accountCategory || '').toUpperCase();
    if (
      (cat === 'ASSET' || cat === 'LIABILITY') &&
      ![ClosingLineRole.PROFIT_TRANSFER, ClosingLineRole.LOSS_TRANSFER, ClosingLineRole.CLOSE_DRAWINGS].includes(
        l.lineRole
      )
    ) {
      throw new InvalidClosingMethodError(`Permanent account ${l.accountId} cannot be included in temporary closure.`);
    }
  }

  const preview = {
    closingMethod,
    destinationAccountId,
    incomeSummaryAccountId: incomeSummaryAccount?.accountId || null,
    temporaryAccountCount: temps.length,
    drawingsAccountCount: drawings.length,
    lineCount: lines.length,
    totalDebitMinor: totalDebit,
    totalCreditMinor: totalCredit,
    calculatedProfitOrLossMinor: profitMinor,
    calculatedProfitOrLoss: minorToDecimal(profitMinor),
    lines,
    warnings: defects.filter((d) => d.code === 'CLS-003'),
    cyeModel: 'MODEL_A_CALCULATED_REPORTING_LINE',
    notes: [
      'Current Year Earnings is not transferred separately — this batch is the sole P/L transfer.',
      'Drawings and dividends are excluded from operating Expense closure.',
      'Balance Sheet accounts are not closed to zero.',
    ],
  };

  preview.previewChecksum = checksumPreview(preview);
  return preview;
}

function allocatePartners(push, allocations, amountMinor, isProfit) {
  const totalShare = allocations.reduce((s, a) => s + Number(a.shareMinor || 0), 0);
  if (totalShare !== 10_000) {
    throw new InvalidClosingMethodError('Partner allocation shares must total exactly 100.00%.');
  }
  let allocated = 0;
  allocations.forEach((a, idx) => {
    let part =
      idx === allocations.length - 1
        ? amountMinor - allocated
        : Math.trunc((amountMinor * Number(a.shareMinor)) / 10_000);
    allocated += part;
    if (isProfit) {
      push({
        accountId: a.partnerAccountId,
        accountCategory: 'EQUITY',
        lineRole: ClosingLineRole.PARTNER_ALLOCATION,
        debitMinor: 0,
        creditMinor: part,
        description: `Partner profit allocation ${a.shareMinor / 100}%`,
        metadata: { relationshipId: a.relationshipId || null },
      });
    } else {
      push({
        accountId: a.partnerAccountId,
        accountCategory: 'EQUITY',
        lineRole: ClosingLineRole.PARTNER_ALLOCATION,
        debitMinor: part,
        creditMinor: 0,
        description: `Partner loss allocation ${a.shareMinor / 100}%`,
        metadata: { relationshipId: a.relationshipId || null },
      });
    }
  });
}

export function checksumPreview(preview) {
  const canonical = {
    method: preview.closingMethod,
    destination: preview.destinationAccountId,
    incomeSummary: preview.incomeSummaryAccountId,
    profit: preview.calculatedProfitOrLossMinor,
    lines: preview.lines.map((l) => ({
      s: l.sequence,
      a: l.accountId,
      r: l.lineRole,
      d: l.debitMinor,
      c: l.creditMinor,
    })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/** Build Post-Closing TB expectation: temps and drawings (if closed) should be zero. */
export function validatePostClosingBalances(accounts, { drawingsClosed = true } = {}) {
  const failures = [];
  for (const a of accounts) {
    if (a.isHeader) continue;
    const bal = Number(a.rawNetMinor || 0);
    if (isTemporaryIncomeStatementAccount(a) && bal !== 0) {
      failures.push({
        code: bal > 0 ? 'CLS-007' : 'CLS-006',
        accountId: a.accountId,
        accountCode: a.accountCode,
        balanceMinor: bal,
        message: `Temporary account ${a.accountCode} remains non-zero after close.`,
      });
    }
    if (drawingsClosed && isDrawingsAccount(a) && bal !== 0) {
      failures.push({
        code: 'CLS-012',
        accountId: a.accountId,
        accountCode: a.accountCode,
        balanceMinor: bal,
        message: `Drawings account ${a.accountCode} remains non-zero after close.`,
      });
    }
    if (String(a.subType || a.coaV2SubType || '').toUpperCase() === 'CURRENT_YEAR_EARNINGS' && bal !== 0) {
      // Under MODEL A CYE is usually not a posted account; if it exists with balance, flag.
      failures.push({
        code: 'CLS-010',
        accountId: a.accountId,
        message: 'Current Year Earnings control account remains non-zero (MODEL A expects zero / unused).',
      });
    }
  }
  return failures;
}
