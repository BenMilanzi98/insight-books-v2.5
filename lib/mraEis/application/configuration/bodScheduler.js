import prisma from '@/lib/prisma.js';
import { CONFIG_SYNC_TRIGGER, TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { requestConfigurationSync } from './configurationSyncOrchestrator.js';

/**
 * Beginning-of-day configuration sync queueing.
 * Uses Business timezone (or MRA_EIS_BOD_TIMEZONE / Africa/Blantyre default).
 * Idempotent per terminal per business date. Bounded batch. Does not thundering-herd execute.
 */
export function resolveBusinessDate(timeZone = process.env.MRA_EIS_BOD_TIMEZONE || 'Africa/Blantyre', at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export async function queueBeginningOfDayConfigurationSyncs({
  db = prisma,
  limit = 50,
  timeZone = process.env.MRA_EIS_BOD_TIMEZONE || 'Africa/Blantyre',
  jitterMsMax = 30_000,
} = {}) {
  const businessDate = resolveBusinessDate(timeZone);
  const terminals = await db.mraEisTerminal.findMany({
    where: {
      status: { in: [TERMINAL_STATUS.ACTIVE, TERMINAL_STATUS.CONFIGURATION_STALE, 'CONFIGURATION_REFRESH_DUE'] },
    },
    take: limit,
    orderBy: { lastConfigurationSyncAt: 'asc' },
  });

  const queued = [];
  for (const terminal of terminals) {
    const idempotencyKey = `bod:${terminal.id}:${businessDate}`;
    try {
      // Optional jitter metadata only — scheduling identity remains stable
      void jitterMsMax;
      const result = await requestConfigurationSync({
        tenantId: terminal.tenantId,
        businessId: terminal.businessId,
        terminalId: terminal.id,
        trigger: CONFIG_SYNC_TRIGGER.BEGINNING_OF_DAY,
        businessDate,
        requestedBy: 'bod-scheduler',
        priority: 50,
        idempotencyKey,
        db,
      });
      queued.push({
        terminalId: terminal.id,
        syncRunId: result.syncRun.id,
        idempotent: result.idempotent,
        businessDate,
      });
    } catch (err) {
      queued.push({
        terminalId: terminal.id,
        error: err.code || err.message,
        businessDate,
      });
    }
  }

  return { businessDate, timeZone, queued: queued.length, items: queued };
}
