/**
 * Matching engine — rules, auto/manual, 1:1 / 1:N / N:1 / partial / controlled N:N.
 */

import {
  MatchType,
  MatchConfidence,
  MatchStatus,
  StatementMatchingStatus,
  CONFIDENCE_RANK,
} from '../domain/enums.js';
import { daysBetween, normalizeReference } from '../domain/signedAmount.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import { listGlCandidates } from './candidateService.js';
import { getConfiguration } from './configService.js';

const DEFAULT_RULES = [
  {
    ruleKey: 'EXACT_REF_AMOUNT_DATE',
    name: 'Exact reference + amount + date',
    priority: 10,
    confidence: MatchConfidence.EXACT,
    matchType: MatchType.ONE_TO_ONE,
    criteria: { amountExact: true, referenceRequired: true, dateToleranceDays: 0 },
  },
  {
    ruleKey: 'EXACT_AMOUNT_DATE',
    name: 'Exact amount + date',
    priority: 20,
    confidence: MatchConfidence.HIGH,
    matchType: MatchType.ONE_TO_ONE,
    criteria: { amountExact: true, dateToleranceDays: 0 },
  },
  {
    ruleKey: 'AMOUNT_DATE_TOLERANCE',
    name: 'Amount + date tolerance',
    priority: 30,
    confidence: MatchConfidence.MEDIUM,
    matchType: MatchType.ONE_TO_ONE,
    criteria: { amountExact: true, dateToleranceDays: 3 },
  },
  {
    ruleKey: 'AMOUNT_ONLY',
    name: 'Amount only (review)',
    priority: 40,
    confidence: MatchConfidence.LOW,
    matchType: MatchType.ONE_TO_ONE,
    criteria: { amountExact: true, dateToleranceDays: 14 },
  },
];

function scorePair(stmt, book, rule, dateToleranceDays) {
  const tol = rule.criteria.dateToleranceDays ?? dateToleranceDays;
  const dateDiff = daysBetween(stmt.transactionDate, book.transactionDate);
  if (dateDiff > tol) return null;

  const amountOk =
    Math.abs(Number(stmt.remainingAmountMinor)) === Math.abs(Number(book.remainingAmountMinor)) &&
    Math.sign(stmt.remainingAmountMinor) === Math.sign(book.remainingAmountMinor);
  if (rule.criteria.amountExact && !amountOk) return null;

  const stmtRef = stmt.referenceNormalized || normalizeReference(stmt.reference);
  const bookRef = normalizeReference(book.reference);
  if (rule.criteria.referenceRequired) {
    if (!stmtRef || !bookRef || stmtRef !== bookRef) return null;
  }

  let confidence = rule.confidence;
  if (stmtRef && bookRef && stmtRef === bookRef && amountOk && dateDiff === 0) {
    confidence = MatchConfidence.EXACT;
  }

  return {
    statementId: stmt.id,
    journalEntryLineId: book.journalEntryLineId,
    journalEntryId: book.journalEntryId,
    confidence,
    ruleKey: rule.ruleKey,
    matchType: MatchType.ONE_TO_ONE,
    dateDiff,
    statementAmountMinor: stmt.remainingAmountMinor,
    bookAmountMinor: book.remainingAmountMinor,
  };
}

/**
 * Suggest 1:1 matches for unmatched statement rows.
 */
export async function suggestMatches(db, context, { reconciliationId, paymentAccountId }) {
  const recon = await db.bankRecReconciliation.findFirst({
    where: { id: reconciliationId, tenantId: context.businessId },
  });
  if (!recon) {
    throw new AccountingValidationError('Reconciliation not found.', [{ path: 'reconciliationId', message: 'not found' }]);
  }
  const cfg = await getConfiguration(db, context.businessId, paymentAccountId || recon.paymentAccountId);
  const dateTol = cfg?.dateToleranceDays ?? 3;

  const statements = await db.bankRecStatementTransaction.findMany({
    where: {
      tenantId: context.businessId,
      paymentAccountId: recon.paymentAccountId,
      matchingStatus: { in: [StatementMatchingStatus.UNMATCHED, StatementMatchingStatus.SUGGESTED, StatementMatchingStatus.PARTIAL] },
      remainingAmountMinor: { not: 0 },
      ...(recon.id ? { OR: [{ reconciliationId: recon.id }, { reconciliationId: null }] } : {}),
    },
  });

  const candidates = await listGlCandidates(db, context, {
    paymentAccountId: recon.paymentAccountId,
    startDate: recon.periodStart,
    endDate: recon.periodEnd || recon.statementDate,
  });

  const rules = [...DEFAULT_RULES].sort((a, b) => a.priority - b.priority);
  const suggestions = [];
  const usedBooks = new Set();
  const usedStmts = new Set();

  for (const rule of rules) {
    for (const stmt of statements) {
      if (usedStmts.has(stmt.id)) continue;
      const hits = [];
      for (const book of candidates) {
        if (usedBooks.has(book.journalEntryLineId)) continue;
        const scored = scorePair(stmt, book, rule, dateTol);
        if (scored) hits.push(scored);
      }
      if (hits.length === 1) {
        suggestions.push(hits[0]);
        usedStmts.add(stmt.id);
        usedBooks.add(hits[0].journalEntryLineId);
      } else if (hits.length > 1) {
        suggestions.push({
          ...hits[0],
          confidence: MatchConfidence.CONFLICTED,
          conflicts: hits.slice(0, 5),
        });
        usedStmts.add(stmt.id);
      }
    }
  }

  // 1:N — one statement equals sum of multiple book lines (same date window)
  for (const stmt of statements) {
    if (usedStmts.has(stmt.id)) continue;
    const target = stmt.remainingAmountMinor;
    const pool = candidates.filter(
      (b) =>
        !usedBooks.has(b.journalEntryLineId) &&
        Math.sign(b.remainingAmountMinor) === Math.sign(target) &&
        daysBetween(stmt.transactionDate, b.transactionDate) <= dateTol
    );
    const combo = findSubsetSum(pool, target, 5);
    if (combo) {
      suggestions.push({
        statementIds: [stmt.id],
        bookLineIds: combo.map((c) => c.journalEntryLineId),
        confidence: MatchConfidence.MEDIUM,
        ruleKey: 'ONE_TO_MANY_SUBSET',
        matchType: MatchType.ONE_TO_MANY,
        statementAmountMinor: target,
        bookAmountMinor: combo.reduce((s, c) => s + c.remainingAmountMinor, 0),
      });
      usedStmts.add(stmt.id);
      combo.forEach((c) => usedBooks.add(c.journalEntryLineId));
    }
  }

  return { suggestions, statementCount: statements.length, candidateCount: candidates.length };
}

function findSubsetSum(items, target, maxLen) {
  const absTarget = Math.abs(target);
  const sorted = [...items].sort((a, b) => Math.abs(b.remainingAmountMinor) - Math.abs(a.remainingAmountMinor));
  const limited = sorted.slice(0, 20);
  let found = null;
  function dfs(start, acc, sum) {
    if (found) return;
    if (sum === absTarget && acc.length >= 2) {
      found = acc;
      return;
    }
    if (acc.length >= maxLen || sum > absTarget) return;
    for (let i = start; i < limited.length; i += 1) {
      dfs(i + 1, [...acc, limited[i]], sum + Math.abs(limited[i].remainingAmountMinor));
    }
  }
  dfs(0, [], 0);
  return found;
}

export async function persistSuggestions(db, context, { reconciliationId, suggestions, autoAcceptMin }) {
  const created = [];
  const minRank = CONFIDENCE_RANK[autoAcceptMin] ?? CONFIDENCE_RANK.HIGH;
  for (const s of suggestions) {
    if (s.confidence === MatchConfidence.CONFLICTED) continue;
    const statementIds = s.statementIds || (s.statementId ? [s.statementId] : []);
    const bookIds = s.bookLineIds || (s.journalEntryLineId ? [s.journalEntryLineId] : []);
    if (!statementIds.length || !bookIds.length) continue;

    const match = await createMatchRecord(db, context, {
      reconciliationId,
      matchType: s.matchType || MatchType.ONE_TO_ONE,
      confidence: s.confidence,
      status: CONFIDENCE_RANK[s.confidence] >= minRank ? MatchStatus.ACCEPTED : MatchStatus.SUGGESTED,
      ruleKey: s.ruleKey,
      statementIds,
      bookLinks: bookIds.map((id) => ({
        journalEntryLineId: id,
        journalEntryId: s.journalEntryId,
        allocatedAmountMinor: s.bookAmountMinor != null && bookIds.length === 1 ? s.bookAmountMinor : undefined,
      })),
      statementAmountMinor: s.statementAmountMinor,
      bookAmountMinor: s.bookAmountMinor,
      autoAccept: CONFIDENCE_RANK[s.confidence] >= minRank,
    });
    created.push(match);
  }
  return created;
}

export async function createMatchRecord(db, context, input) {
  const recon = await db.bankRecReconciliation.findFirst({
    where: { id: input.reconciliationId, tenantId: context.businessId },
  });
  if (!recon) {
    throw new AccountingValidationError('Reconciliation not found.', [{ path: 'reconciliationId', message: 'not found' }]);
  }
  if (['COMPLETED', 'REVERSED'].includes(recon.status)) {
    throw new AccountingValidationError('Cannot match on a completed/reversed reconciliation.', [
      { path: 'status', message: recon.status },
    ]);
  }

  const stmts = await db.bankRecStatementTransaction.findMany({
    where: { id: { in: input.statementIds }, tenantId: context.businessId },
  });
  if (stmts.length !== input.statementIds.length) {
    throw new AccountingValidationError('One or more statement rows not found.', [
      { path: 'statementIds', message: 'not found' },
    ]);
  }

  const statementTotal = stmts.reduce((s, r) => s + Number(r.remainingAmountMinor), 0);
  let bookTotal = 0;
  const bookLinks = [];
  for (const bl of input.bookLinks || []) {
    const alloc =
      bl.allocatedAmountMinor != null
        ? Number(bl.allocatedAmountMinor)
        : statementTotal / (input.bookLinks.length || 1);
    bookTotal += Number(alloc);
    bookLinks.push({ ...bl, allocatedAmountMinor: Math.round(alloc) });
  }

  // For N:1 provide explicit allocations
  if (input.matchType === MatchType.MANY_TO_ONE && stmts.length > 1 && bookLinks.length === 1) {
    bookLinks[0].allocatedAmountMinor = statementTotal;
    bookTotal = statementTotal;
  }

  const status = input.status || MatchStatus.SUGGESTED;
  const match = await db.bankRecMatch.create({
    data: {
      tenantId: context.businessId,
      reconciliationId: recon.id,
      matchType: input.matchType || MatchType.ONE_TO_ONE,
      confidence: input.confidence || MatchConfidence.MANUAL,
      status,
      statementTotalMinor: statementTotal,
      bookTotalMinor: bookTotal,
      differenceMinor: statementTotal - bookTotal,
      ruleKey: input.ruleKey || null,
      notes: input.notes || null,
      createdBy: context.userId || null,
      acceptedBy: status === MatchStatus.ACCEPTED ? context.userId || null : null,
      acceptedAt: status === MatchStatus.ACCEPTED ? new Date() : null,
      links: {
        create: [
          ...stmts.map((st) => ({
            tenantId: context.businessId,
            side: 'STATEMENT',
            statementTransactionId: st.id,
            allocatedAmountMinor: st.remainingAmountMinor,
          })),
          ...bookLinks.map((bl) => ({
            tenantId: context.businessId,
            side: 'BOOK',
            journalEntryLineId: bl.journalEntryLineId,
            journalEntryId: bl.journalEntryId || null,
            allocatedAmountMinor: bl.allocatedAmountMinor,
          })),
        ],
      },
    },
    include: { links: true },
  });

  if (status === MatchStatus.ACCEPTED) {
    await applyAcceptedMatch(db, context, match);
  } else {
    await db.bankRecStatementTransaction.updateMany({
      where: { id: { in: stmts.map((s) => s.id) } },
      data: { matchingStatus: StatementMatchingStatus.SUGGESTED, reconciliationId: recon.id },
    });
  }

  return match;
}

async function applyAcceptedMatch(db, context, match) {
  const links = match.links || (await db.bankRecMatchLink.findMany({ where: { matchId: match.id } }));
  for (const link of links) {
    if (link.side === 'STATEMENT' && link.statementTransactionId) {
      const st = await db.bankRecStatementTransaction.findUnique({ where: { id: link.statementTransactionId } });
      if (!st) continue;
      const remaining = Number(st.remainingAmountMinor) - Number(link.allocatedAmountMinor);
      await db.bankRecStatementTransaction.update({
        where: { id: st.id },
        data: {
          remainingAmountMinor: remaining,
          matchingStatus:
            remaining === 0 ? StatementMatchingStatus.MATCHED : StatementMatchingStatus.PARTIAL,
          reconciliationId: match.reconciliationId,
        },
      });
    }
  }
}

export async function acceptMatch(db, context, matchId) {
  const match = await db.bankRecMatch.findFirst({
    where: { id: matchId, tenantId: context.businessId },
    include: { links: true },
  });
  if (!match) throw new AccountingValidationError('Match not found.');
  if (match.status === MatchStatus.ACCEPTED) return match;
  if (match.status === MatchStatus.REJECTED) {
    throw new AccountingValidationError('Rejected match cannot be accepted.');
  }
  const updated = await db.bankRecMatch.update({
    where: { id: match.id },
    data: {
      status: MatchStatus.ACCEPTED,
      acceptedBy: context.userId || null,
      acceptedAt: new Date(),
    },
    include: { links: true },
  });
  await applyAcceptedMatch(db, context, updated);
  return updated;
}

export async function rejectMatch(db, context, matchId) {
  const match = await db.bankRecMatch.findFirst({
    where: { id: matchId, tenantId: context.businessId },
    include: { links: true },
  });
  if (!match) throw new AccountingValidationError('Match not found.');
  if (match.status === MatchStatus.ACCEPTED) {
    // reverse remaining amounts
    for (const link of match.links) {
      if (link.side === 'STATEMENT' && link.statementTransactionId) {
        const st = await db.bankRecStatementTransaction.findUnique({ where: { id: link.statementTransactionId } });
        if (!st) continue;
        const remaining = Number(st.remainingAmountMinor) + Number(link.allocatedAmountMinor);
        await db.bankRecStatementTransaction.update({
          where: { id: st.id },
          data: {
            remainingAmountMinor: remaining,
            matchingStatus:
              Math.abs(remaining) === Math.abs(st.signedAmountMinor)
                ? StatementMatchingStatus.UNMATCHED
                : StatementMatchingStatus.PARTIAL,
          },
        });
      }
    }
  }
  return db.bankRecMatch.update({
    where: { id: match.id },
    data: { status: MatchStatus.REJECTED },
  });
}

/**
 * Manual match: arbitrary statement IDs + book line allocations (supports partial / N:N when totals equal).
 */
export async function manualMatch(db, context, input) {
  const statementIds = input.statementIds || [];
  const bookLinks = input.bookLinks || [];
  if (!statementIds.length || !bookLinks.length) {
    throw new AccountingValidationError('Manual match requires statementIds and bookLinks.');
  }
  let matchType = MatchType.ONE_TO_ONE;
  if (statementIds.length === 1 && bookLinks.length > 1) matchType = MatchType.ONE_TO_MANY;
  else if (statementIds.length > 1 && bookLinks.length === 1) matchType = MatchType.MANY_TO_ONE;
  else if (statementIds.length > 1 && bookLinks.length > 1) matchType = MatchType.MANY_TO_MANY;
  if (input.partial) matchType = MatchType.PARTIAL;

  return createMatchRecord(db, context, {
    reconciliationId: input.reconciliationId,
    matchType,
    confidence: MatchConfidence.MANUAL,
    status: MatchStatus.ACCEPTED,
    statementIds,
    bookLinks,
    notes: input.notes,
  });
}

export async function runAutoMatch(db, context, { reconciliationId }) {
  const recon = await db.bankRecReconciliation.findFirst({
    where: { id: reconciliationId, tenantId: context.businessId },
  });
  if (!recon) throw new AccountingValidationError('Reconciliation not found.');
  const cfg = await getConfiguration(db, context.businessId, recon.paymentAccountId);
  const { suggestions } = await suggestMatches(db, context, {
    reconciliationId,
    paymentAccountId: recon.paymentAccountId,
  });
  const created = await persistSuggestions(db, context, {
    reconciliationId,
    suggestions,
    autoAcceptMin: cfg?.autoMatchMinConfidence || 'HIGH',
  });
  return { suggestions: suggestions.length, matchesCreated: created.length, matches: created };
}

export { DEFAULT_RULES, scorePair, findSubsetSum };
