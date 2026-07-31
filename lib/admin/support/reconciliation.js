/**
 * Support reconciliation — ticket vs status history / messages / SLA clocks.
 * Never invents false zeroes; failed counts → null + gate status.
 */

import {
  SUPPORT_RECON_VERSION,
  SUPPORT_RELIABILITY_STATUS,
  SUPPORT_TICKET_STATUS,
} from './catalogue.js';
import { resolveSupportAccess } from './authz.js';

export function hasSupportReconciliationRunModel(prisma) {
  return typeof prisma?.supportReconciliationRun?.create === 'function';
}

async function safeCount(fn) {
  try {
    const value = await fn();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, value: null, error: 'non_numeric_count' };
    }
    return { ok: true, value };
  } catch (e) {
    return { ok: false, value: null, error: e?.message || 'count_failed' };
  }
}

function card(id, label, value, status, detail) {
  return {
    id,
    label,
    value: value == null ? null : value,
    status,
    detail: detail || null,
  };
}

/**
 * Pure honesty: recon failure must not yield fabricated zero KPIs.
 */
export function applySupportReconHonesty(input = {}) {
  const failed =
    input.status === SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED ||
    input.reconOk === false;
  const unavailable =
    input.status === SUPPORT_RELIABILITY_STATUS.UNAVAILABLE ||
    input.status === SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED ||
    input.status === SUPPORT_RELIABILITY_STATUS.PERMISSION_RESTRICTED;

  if (!failed && !unavailable) {
    return {
      kpiSafe: true,
      ticketCount: input.ticketCount,
      status: input.status || SUPPORT_RELIABILITY_STATUS.AVAILABLE,
    };
  }

  return {
    kpiSafe: false,
    ticketCount: null,
    messageCount: null,
    slaClockCount: null,
    status: failed
      ? SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED
      : input.status || SUPPORT_RELIABILITY_STATUS.UNAVAILABLE,
    reasonMessage:
      'Failed or unavailable reconciliation blocks numeric KPIs — never false zeroes',
  };
}

/**
 * Run light support reconciliation checks.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, persist?: boolean, ticketLimit?: number }} args
 */
export async function runSupportReconciliation(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return {
      ok: false,
      forbidden: true,
      status: SUPPORT_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reconVersion: SUPPORT_RECON_VERSION,
    };
  }
  if (!access.canRunReconciliation) {
    return {
      ok: false,
      forbidden: true,
      reason: 'run_reconciliation_required',
      status: SUPPORT_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reconVersion: SUPPORT_RECON_VERSION,
    };
  }

  const cards = [];
  let overall = SUPPORT_RELIABILITY_STATUS.AVAILABLE;
  let reconOk = true;

  const hasTicket = typeof prisma?.supportTicket?.count === 'function';
  const hasHistory = typeof prisma?.supportTicketStatusHistory?.count === 'function';
  const hasMessages = typeof prisma?.supportMessage?.count === 'function';
  const hasSla = typeof prisma?.supportSlaClock?.count === 'function';

  if (!hasTicket) {
    return {
      ok: true,
      status: SUPPORT_RELIABILITY_STATUS.UNAVAILABLE,
      reconVersion: SUPPORT_RECON_VERSION,
      cards: [
        card(
          'tickets.model',
          'SupportTicket model',
          null,
          SUPPORT_RELIABILITY_STATUS.UNAVAILABLE,
          'supportTicket.count unavailable'
        ),
      ],
      summary: {
        ticketCount: null,
        statusHistoryCount: null,
        messageCount: null,
        slaClockCount: null,
        mismatchedStatusSamples: null,
      },
      meta: {
        inventZeroesForbidden: true,
        honesty: applySupportReconHonesty({
          status: SUPPORT_RELIABILITY_STATUS.UNAVAILABLE,
          ticketCount: null,
        }),
      },
    };
  }

  const ticketCount = await safeCount(() => prisma.supportTicket.count());
  if (!ticketCount.ok) {
    reconOk = false;
    overall = SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED;
    cards.push(
      card(
        'tickets.count',
        'Ticket count',
        null,
        SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
        ticketCount.error
      )
    );
  } else {
    cards.push(
      card(
        'tickets.count',
        'Ticket count',
        ticketCount.value,
        SUPPORT_RELIABILITY_STATUS.AVAILABLE,
        null
      )
    );
  }

  let statusHistoryCount = { ok: false, value: null };
  if (!hasHistory) {
    cards.push(
      card(
        'statusHistory.model',
        'Status history model',
        null,
        SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
        'supportTicketStatusHistory unavailable'
      )
    );
    if (overall === SUPPORT_RELIABILITY_STATUS.AVAILABLE) {
      overall = SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED;
    }
  } else {
    statusHistoryCount = await safeCount(() => prisma.supportTicketStatusHistory.count());
    if (!statusHistoryCount.ok) {
      reconOk = false;
      overall = SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED;
      cards.push(
        card(
          'statusHistory.count',
          'Status history count',
          null,
          SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
          statusHistoryCount.error
        )
      );
    } else {
      cards.push(
        card(
          'statusHistory.count',
          'Status history count',
          statusHistoryCount.value,
          SUPPORT_RELIABILITY_STATUS.AVAILABLE,
          null
        )
      );
    }
  }

  let messageCount = { ok: false, value: null };
  if (!hasMessages) {
    cards.push(
      card(
        'messages.model',
        'Message model',
        null,
        SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
        'supportMessage unavailable'
      )
    );
    if (overall === SUPPORT_RELIABILITY_STATUS.AVAILABLE) {
      overall = SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED;
    }
  } else {
    messageCount = await safeCount(() => prisma.supportMessage.count());
    if (!messageCount.ok) {
      reconOk = false;
      overall = SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED;
      cards.push(
        card(
          'messages.count',
          'Message count',
          null,
          SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
          messageCount.error
        )
      );
    } else {
      cards.push(
        card(
          'messages.count',
          'Message count',
          messageCount.value,
          SUPPORT_RELIABILITY_STATUS.AVAILABLE,
          null
        )
      );
    }
  }

  let slaClockCount = { ok: false, value: null };
  if (!hasSla) {
    cards.push(
      card(
        'sla.model',
        'SLA clock model',
        null,
        SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
        'supportSlaClock unavailable'
      )
    );
    if (overall === SUPPORT_RELIABILITY_STATUS.AVAILABLE) {
      overall = SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED;
    }
  } else {
    slaClockCount = await safeCount(() => prisma.supportSlaClock.count());
    if (!slaClockCount.ok) {
      reconOk = false;
      overall = SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED;
      cards.push(
        card(
          'sla.count',
          'SLA clock count',
          null,
          SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
          slaClockCount.error
        )
      );
    } else {
      cards.push(
        card(
          'sla.count',
          'SLA clock count',
          slaClockCount.value,
          SUPPORT_RELIABILITY_STATUS.AVAILABLE,
          null
        )
      );
    }
  }

  /** Sample tickets for status vs latest history consistency (capped). */
  let mismatchedStatusSamples = [];
  const sampleLimit = Math.min(50, Math.max(1, Number(args.ticketLimit) || 25));
  if (
    ticketCount.ok &&
    hasHistory &&
    typeof prisma.supportTicket.findMany === 'function' &&
    typeof prisma.supportTicketStatusHistory.findFirst === 'function'
  ) {
    try {
      const tickets = await prisma.supportTicket.findMany({
        take: sampleLimit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, ticketNumber: true, status: true },
      });
      for (const t of tickets || []) {
        const latest = await prisma.supportTicketStatusHistory.findFirst({
          where: { ticketId: t.id },
          orderBy: { at: 'desc' },
        });
        if (!latest) {
          if (t.status !== SUPPORT_TICKET_STATUS.NEW) {
            mismatchedStatusSamples.push({
              ticketId: t.id,
              ticketNumber: t.ticketNumber,
              ticketStatus: t.status,
              historyToStatus: null,
              reason: 'missing_history_for_non_new',
            });
          }
          continue;
        }
        if (latest.toStatus && latest.toStatus !== t.status) {
          mismatchedStatusSamples.push({
            ticketId: t.id,
            ticketNumber: t.ticketNumber,
            ticketStatus: t.status,
            historyToStatus: latest.toStatus,
            reason: 'status_history_mismatch',
          });
        }
      }
      if (mismatchedStatusSamples.length > 0) {
        overall = SUPPORT_RELIABILITY_STATUS.PARTIAL_HISTORY;
        cards.push(
          card(
            'statusHistory.mismatch',
            'Status vs history mismatches (sample)',
            mismatchedStatusSamples.length,
            SUPPORT_RELIABILITY_STATUS.PARTIAL_HISTORY,
            'Sampled tickets where current status ≠ latest history (or missing history)'
          )
        );
      } else {
        cards.push(
          card(
            'statusHistory.mismatch',
            'Status vs history mismatches (sample)',
            0,
            SUPPORT_RELIABILITY_STATUS.AVAILABLE,
            `Sampled ${tickets?.length || 0} tickets`
          )
        );
      }
    } catch (e) {
      reconOk = false;
      overall = SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED;
      mismatchedStatusSamples = null;
      cards.push(
        card(
          'statusHistory.sample',
          'Status history sample',
          null,
          SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED,
          e?.message || 'sample_failed'
        )
      );
    }
  }

  if (!reconOk && overall !== SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED) {
    overall = SUPPORT_RELIABILITY_STATUS.RECONCILIATION_FAILED;
  }

  const summary = {
    ticketCount: ticketCount.ok ? ticketCount.value : null,
    statusHistoryCount: statusHistoryCount.ok ? statusHistoryCount.value : null,
    messageCount: messageCount.ok ? messageCount.value : null,
    slaClockCount: slaClockCount.ok ? slaClockCount.value : null,
    mismatchedStatusSamples:
      mismatchedStatusSamples == null
        ? null
        : mismatchedStatusSamples.slice(0, 10),
  };

  const result = {
    ok: true,
    status: overall,
    reconOk,
    reconVersion: SUPPORT_RECON_VERSION,
    cards,
    summary,
    meta: {
      inventZeroesForbidden: true,
      honesty: applySupportReconHonesty({
        status: overall,
        reconOk,
        ticketCount: summary.ticketCount,
      }),
    },
  };

  if (args.persist && hasSupportReconciliationRunModel(prisma)) {
    try {
      const run = await prisma.supportReconciliationRun.create({
        data: {
          status: overall,
          summaryJson: JSON.stringify({
            reconVersion: SUPPORT_RECON_VERSION,
            cards,
            summary,
          }),
          runByAdminId: args.admin?.id || null,
        },
      });
      result.runId = run.id;
      result.persisted = true;
    } catch {
      result.persisted = false;
      result.persistError = 'recon_run_persist_failed';
    }
  }

  return result;
}

/**
 * GET helper — latest persisted run or live dry run (no persist).
 */
export async function getSupportReconciliation(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return {
      ok: false,
      forbidden: true,
      status: SUPPORT_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reconVersion: SUPPORT_RECON_VERSION,
    };
  }
  if (!access.canRunReconciliation && !access.canViewTickets) {
    return {
      ok: false,
      forbidden: true,
      status: SUPPORT_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reconVersion: SUPPORT_RECON_VERSION,
    };
  }

  /** Viewers may see last run; running requires runReconciliation (POST). */
  if (
    hasSupportReconciliationRunModel(prisma) &&
    typeof prisma.supportReconciliationRun.findFirst === 'function'
  ) {
    try {
      const last = await prisma.supportReconciliationRun.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (last) {
        let parsed = {};
        try {
          parsed = JSON.parse(last.summaryJson || '{}');
        } catch {
          parsed = {};
        }
        return {
          ok: true,
          status: last.status,
          reconVersion: SUPPORT_RECON_VERSION,
          fromPersist: true,
          runId: last.id,
          createdAt: last.createdAt ? new Date(last.createdAt).toISOString() : null,
          cards: parsed.cards || [],
          summary: parsed.summary || null,
          meta: {
            inventZeroesForbidden: true,
            note: 'Latest persisted run — POST to re-run',
          },
        };
      }
    } catch {
      // fall through to dry run if permitted
    }
  }

  if (!access.canRunReconciliation) {
    return {
      ok: true,
      status: SUPPORT_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      reconVersion: SUPPORT_RECON_VERSION,
      cards: [],
      summary: null,
      meta: {
        inventZeroesForbidden: true,
        reason: 'no_persisted_run_and_run_permission_missing',
      },
    };
  }

  return runSupportReconciliation(prisma, { ...args, persist: false });
}
