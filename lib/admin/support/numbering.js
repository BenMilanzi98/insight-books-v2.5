/**
 * Concurrency-safe Support ticket numbering: SUP-YYYY-######
 * Year = UTC calendar year of create time.
 * Uses SupportTicketNumberSeq with optimistic compare-and-swap (documentSequences pattern).
 */

import { SUPPORT_TICKET_NUMBER_RE } from './catalogue.js';

const MAX_ALLOC_ATTEMPTS = 12;

/**
 * @param {number} year
 * @param {number} seq
 * @returns {string}
 */
export function formatTicketNumber(year, seq) {
  return `SUP-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * @param {Date} [now]
 * @returns {number}
 */
export function utcYearOf(now = new Date()) {
  return new Date(now).getUTCFullYear();
}

function hasSeqModel(db) {
  return typeof db?.supportTicketNumberSeq?.findUnique === 'function';
}

/**
 * Allocate next ticket number for the UTC year of `now`.
 *
 * @param {import('@prisma/client').PrismaClient|object} prisma
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<{ ok: true, ticketNumber: string, year: number, sequence: number } | { ok: false, error: string }>}
 */
export async function allocateTicketNumber(prisma, opts = {}) {
  const now = opts.now || new Date();
  const year = utcYearOf(now);

  if (!hasSeqModel(prisma)) {
    return { ok: false, error: 'support_ticket_number_seq_unavailable' };
  }

  const run = async (tx) => {
    for (let i = 0; i < MAX_ALLOC_ATTEMPTS; i += 1) {
      const row = await tx.supportTicketNumberSeq.findUnique({ where: { year } });

      if (!row) {
        try {
          await tx.supportTicketNumberSeq.create({
            data: { year, lastIssued: 1 },
          });
          return {
            ok: true,
            ticketNumber: formatTicketNumber(year, 1),
            year,
            sequence: 1,
          };
        } catch (err) {
          if (err && typeof err === 'object' && err.code === 'P2002') continue;
          throw err;
        }
      }

      const next = row.lastIssued + 1;
      const res = await tx.supportTicketNumberSeq.updateMany({
        where: { year, lastIssued: row.lastIssued },
        data: { lastIssued: next },
      });
      if (res.count === 1) {
        return {
          ok: true,
          ticketNumber: formatTicketNumber(year, next),
          year,
          sequence: next,
        };
      }
    }
    return { ok: false, error: 'ticket_number_allocation_failed' };
  };

  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(run);
  }
  return run(prisma);
}

export { SUPPORT_TICKET_NUMBER_RE };
