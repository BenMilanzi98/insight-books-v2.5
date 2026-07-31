/**
 * Phase 5 — Journal and Ledger integrity rules.
 *
 * Machine-readable rule catalogue (JRN-1xx journal structure, GL-1xx ledger
 * consistency) plus executable checks. Findings carry rule code, severity,
 * affected records and measured amounts — never silent corrections.
 */

import {
  POSTED_JOURNAL_STATUSES,
  findAuthorityConflicts,
  findHeaderOnlyJournals,
  assertLedgerContext,
} from './canonicalJournalSource.js';
import { parseDecimalToMinor } from '../domain/money.js';

const toMinor = (v) =>
  v == null ? 0 : parseDecimalToMinor(typeof v === 'number' ? v.toFixed(2) : String(v));

export const INTEGRITY_RULES = Object.freeze({
  'JRN-101': { severity: 'CRITICAL', description: 'V2 journal header totals must equal the sum of its lines.' },
  'JRN-102': { severity: 'CRITICAL', description: 'Posted journal must be balanced: total debits equal total credits.' },
  'JRN-103': { severity: 'HIGH', description: 'Posted journal must carry a resolvable posting date.' },
  'JRN-104': { severity: 'HIGH', description: 'Posted journal must have at least two lines; header-amount rows are outside the ledger.' },
  'JRN-105': { severity: 'HIGH', description: 'Journal line must not carry both a debit and a credit, nor be zero on both sides.' },
  'JRN-106': { severity: 'MEDIUM', description: 'Journal status must use the canonical vocabulary and casing.' },
  'JRN-107': { severity: 'HIGH', description: 'Reversal journal must link to its original; reversed original must link back.' },
  'JRN-108': { severity: 'MEDIUM', description: 'Journal source link (sourceType + sourceId) must identify a real document for operational journals.' },
  'JRN-109': { severity: 'CRITICAL', description: 'V2 posted journal must carry an accounting event identity.' },
  'JRN-110': { severity: 'HIGH', description: 'Line sequence numbers within a journal must be unique.' },
  'GL-110': { severity: 'HIGH', description: 'Header/non-posting accounts must carry no direct posted activity.' },
  'GL-111': { severity: 'HIGH', description: 'Stored Account.balance must equal the canonical derived balance (cache drift).' },
  'GL-112': { severity: 'CRITICAL', description: 'Business-wide canonical debits must equal credits for any window.' },
  'GL-113': { severity: 'CRITICAL', description: 'Posted lines must reference accounts that exist in the business chart.' },
  'GL-114': { severity: 'HIGH', description: 'Ledger projection rows must match canonical totals (stale read model).' },
  'GL-115': { severity: 'MEDIUM', description: 'Every screen/export surface must use the canonical query engine (checked by tests, not data).' },
  'GL-116': { severity: 'MEDIUM', description: 'Merged-away accounts must not accept new postings.' },
  'GL-117': { severity: 'CRITICAL', description: 'One economic event must never be counted by both ledgers (authority conflict).' },
  'GL-118': { severity: 'HIGH', description: 'Ledger surfaces must never read stored balance caches (checked by tests).' },
});

export function ruleInfo(code) {
  return INTEGRITY_RULES[code] ?? { severity: 'MEDIUM', description: code };
}

function finding(rule, details) {
  const info = ruleInfo(rule);
  return { rule, severity: info.severity, description: info.description, ...details };
}

/**
 * Run journal-structure integrity checks over posted journal entries of a
 * business (optionally windowed). Returns findings only — no mutations.
 *
 * @param {import('@prisma/client').PrismaClient} db
 * @param {object} context
 * @param {{startDate?: Date, endDate?: Date, limit?: number}} [options]
 */
export async function runJournalIntegrityChecks(db, context, options = {}) {
  assertLedgerContext(context);
  const tenantId = context.businessId;
  const findings = [];

  const journals = await db.journalEntry.findMany({
    where: {
      tenantId,
      status: { in: [...POSTED_JOURNAL_STATUSES] },
      ...(options.startDate || options.endDate
        ? {
            OR: [
              {
                postingDate: {
                  ...(options.startDate ? { gte: options.startDate } : {}),
                  ...(options.endDate ? { lte: options.endDate } : {}),
                },
              },
              {
                AND: [
                  { postingDate: null },
                  {
                    entryDate: {
                      ...(options.startDate ? { gte: options.startDate } : {}),
                      ...(options.endDate ? { lte: options.endDate } : {}),
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    },
    include: { lines: true },
    take: options.limit ?? 5000,
  });

  for (const je of journals) {
    const isV2 = je.architectureVersion === 'ACCOUNTING_V2';
    const lineDebit = je.lines.reduce((s, l) => s + toMinor(l.debitAmount), 0);
    const lineCredit = je.lines.reduce((s, l) => s + toMinor(l.creditAmount), 0);

    if (je.transactionId == null && je.lines.length > 0 && lineDebit !== lineCredit) {
      findings.push(
        finding('JRN-102', {
          journalEntryId: je.id,
          debitMinor: lineDebit,
          creditMinor: lineCredit,
          differenceMinor: lineDebit - lineCredit,
        })
      );
    }
    if (isV2) {
      if (je.totalDebit != null && toMinor(je.totalDebit) !== lineDebit) {
        findings.push(
          finding('JRN-101', {
            journalEntryId: je.id,
            headerDebitMinor: toMinor(je.totalDebit),
            lineDebitMinor: lineDebit,
          })
        );
      }
      if (!je.accountingEventId) {
        findings.push(finding('JRN-109', { journalEntryId: je.id }));
      }
    }
    if (!je.postingDate && !je.entryDate) {
      findings.push(finding('JRN-103', { journalEntryId: je.id }));
    }
    if (je.status !== 'Posted' && !['Reversed', 'PartiallyReversed'].includes(je.status)) {
      findings.push(finding('JRN-106', { journalEntryId: je.id, rawStatus: je.status }));
    }
    for (const line of je.lines) {
      const d = toMinor(line.debitAmount);
      const c = toMinor(line.creditAmount);
      if ((d !== 0 && c !== 0) || (d === 0 && c === 0)) {
        findings.push(finding('JRN-105', { journalEntryId: je.id, lineId: line.id, debitMinor: d, creditMinor: c }));
      }
    }
    const seqs = je.lines.map((l) => l.lineNumber);
    if (new Set(seqs).size !== seqs.length) {
      findings.push(finding('JRN-110', { journalEntryId: je.id, sequences: seqs }));
    }
    if (je.reversalStatus === 'REVERSAL' && !je.originalJournalId) {
      findings.push(finding('JRN-107', { journalEntryId: je.id, direction: 'reversal missing original link' }));
    }
    if (je.reversalStatus === 'REVERSED' && !je.reversedByJournalId) {
      findings.push(finding('JRN-107', { journalEntryId: je.id, direction: 'reversed original missing reversal link' }));
    }
  }

  const headerOnly = await findHeaderOnlyJournals(db, context);
  for (const h of headerOnly) findings.push(finding('JRN-104', h));

  const conflicts = await findAuthorityConflicts(db, context, options);
  for (const c of conflicts) findings.push(finding('GL-117', c));

  return findings;
}
