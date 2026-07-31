/**
 * Support SLA clocks — start / pause / stop / breach evaluation.
 * Pins policyVersion + calendarVersion on each clock row.
 * Breach events are append-only / immutable.
 */

import {
  SUPPORT_SLA_CLOCK_TYPE,
  SUPPORT_SLA_CLOCK_STATE,
  SUPPORT_SLA_EVENT_TYPE,
  SUPPORT_SLA_AVAILABILITY,
  SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
  SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
} from './catalogue.js';
import {
  getDefaultSlaCalendar,
  getSlaCalendarByVersion,
  addBusinessMs,
  elapsedBusinessMs,
} from './calendars.js';
import {
  getDefaultSlaPolicy,
  getSlaPolicyByVersion,
  shouldPauseForStatus,
} from './policies.js';
import { SUPPORT_TICKET_STATUS, SUPPORT_MESSAGE_TYPE } from '../catalogue.js';
import { resolveSupportAccess } from '../authz.js';
import { findSupportTicket } from '../ticketLookup.js';

export function hasSupportSlaClockModel(prisma) {
  return typeof prisma?.supportSlaClock?.create === 'function';
}

function serializeClock(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticketId,
    clockType: row.clockType,
    state: row.state,
    policyVersion: row.policyVersion,
    calendarVersion: row.calendarVersion,
    targetBusinessMs: row.targetBusinessMs ?? null,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    pausedAt: row.pausedAt ? new Date(row.pausedAt).toISOString() : null,
    pausedMs: row.pausedMs || 0,
    stoppedAt: row.stoppedAt ? new Date(row.stoppedAt).toISOString() : null,
    breachedAt: row.breachedAt ? new Date(row.breachedAt).toISOString() : null,
  };
}

async function appendEvent(prisma, { clockId, eventType, at, meta }) {
  if (typeof prisma.supportSlaEvent?.create !== 'function') return null;
  return prisma.supportSlaEvent.create({
    data: {
      clockId,
      eventType,
      at: at || new Date(),
      metaJson: meta ? JSON.stringify(meta) : null,
    },
  });
}

async function createClock(prisma, {
  ticketId,
  clockType,
  policy,
  calendar,
  now,
}) {
  const target = policy.targets?.[clockType]?.businessMs;
  if (target == null) return null;

  const dueAt = addBusinessMs(now, target, calendar);
  const row = await prisma.supportSlaClock.create({
    data: {
      ticketId,
      clockType,
      state: SUPPORT_SLA_CLOCK_STATE.RUNNING,
      policyVersion: policy.versionId || SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
      calendarVersion: calendar.versionId || SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
      targetBusinessMs: target,
      startedAt: now,
      dueAt,
      pausedAt: null,
      pausedMs: 0,
      stoppedAt: null,
      breachedAt: null,
    },
  });
  await appendEvent(prisma, {
    clockId: row.id,
    eventType: SUPPORT_SLA_EVENT_TYPE.STARTED,
    at: now,
  });
  return row;
}

/**
 * Start FIRST_RESPONSE (+ RESOLUTION when policy says CREATE).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ ticketId: string, now?: Date, policy?: object, calendar?: object }} args
 */
export async function startClocksOnTicketCreate(prisma, args = {}) {
  if (!hasSupportSlaClockModel(prisma)) {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      clocks: [],
      reason: 'support_sla_model_unavailable',
    };
  }

  const ticketId = args.ticketId ? String(args.ticketId).trim() : '';
  if (!ticketId) return { ok: false, error: 'ticketId required', clocks: [] };

  const policy = args.policy || getDefaultSlaPolicy();
  const calendar = args.calendar || getDefaultSlaCalendar();
  const now = args.now || new Date();

  const existing = await prisma.supportSlaClock.findMany({ where: { ticketId } });
  if (existing?.length) {
    return { ok: true, clocks: existing.map(serializeClock), noop: true };
  }

  const clocks = [];
  const fr = await createClock(prisma, {
    ticketId,
    clockType: SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE,
    policy,
    calendar,
    now,
  });
  if (fr) clocks.push(fr);

  if ((policy.resolutionStartsOn || 'CREATE') === 'CREATE') {
    const res = await createClock(prisma, {
      ticketId,
      clockType: SUPPORT_SLA_CLOCK_TYPE.RESOLUTION,
      policy,
      calendar,
      now,
    });
    if (res) clocks.push(res);
  }

  return { ok: true, clocks: clocks.map(serializeClock) };
}

async function stopClock(prisma, clock, now, reason) {
  if (
    !clock ||
    clock.state === SUPPORT_SLA_CLOCK_STATE.STOPPED ||
    clock.state === SUPPORT_SLA_CLOCK_STATE.BREACHED
  ) {
    return clock;
  }

  let pausedMs = clock.pausedMs || 0;
  if (clock.state === SUPPORT_SLA_CLOCK_STATE.PAUSED && clock.pausedAt) {
    pausedMs += Math.max(0, now.getTime() - new Date(clock.pausedAt).getTime());
  }

  const updated = await prisma.supportSlaClock.update({
    where: { id: clock.id },
    data: {
      state: SUPPORT_SLA_CLOCK_STATE.STOPPED,
      stoppedAt: now,
      pausedAt: null,
      pausedMs,
    },
  });
  await appendEvent(prisma, {
    clockId: clock.id,
    eventType: SUPPORT_SLA_EVENT_TYPE.STOPPED,
    at: now,
    meta: { reason: reason || null },
  });
  return updated;
}

async function pauseClock(prisma, clock, now, reason) {
  if (!clock || clock.state !== SUPPORT_SLA_CLOCK_STATE.RUNNING) return clock;
  const updated = await prisma.supportSlaClock.update({
    where: { id: clock.id },
    data: {
      state: SUPPORT_SLA_CLOCK_STATE.PAUSED,
      pausedAt: now,
    },
  });
  await appendEvent(prisma, {
    clockId: clock.id,
    eventType: SUPPORT_SLA_EVENT_TYPE.PAUSED,
    at: now,
    meta: { reason: reason || null },
  });
  return updated;
}

/**
 * Resolve policy for a clock: honor pinned policyVersion.
 * Explicit args.policy only when its versionId matches the pin (tests / same revision).
 */
async function resolveClockPolicy(prisma, clock, argsPolicy) {
  const versionId = clock?.policyVersion;
  if (!versionId) return null;
  if (argsPolicy && argsPolicy.versionId === versionId) return argsPolicy;
  return getSlaPolicyByVersion(prisma, versionId);
}

/**
 * Resolve calendar for a clock: honor pinned calendarVersion.
 * Never silently substitutes latest catalogue defaults for a different pin.
 */
async function resolveClockCalendar(prisma, clock, argsCalendar) {
  const versionId = clock?.calendarVersion;
  if (!versionId) return null;
  if (argsCalendar && argsCalendar.versionId === versionId) return argsCalendar;
  return getSlaCalendarByVersion(prisma, versionId);
}

async function resumeClock(prisma, clock, now, calendar, reason) {
  if (!clock || clock.state !== SUPPORT_SLA_CLOCK_STATE.PAUSED) return clock;
  // Caller must supply the clock's pinned calendar — never invent defaults here.
  if (!calendar) return null;

  const pausedAt = clock.pausedAt ? new Date(clock.pausedAt) : now;
  const pauseDelta = Math.max(0, now.getTime() - pausedAt.getTime());
  const pausedMs = (clock.pausedMs || 0) + pauseDelta;

  // Extend dueAt by wall pause using pinned business calendar from pause→now
  const pauseBusiness = elapsedBusinessMs(pausedAt, now, calendar);
  const priorDue = clock.dueAt ? new Date(clock.dueAt) : null;
  const dueAt = priorDue ? addBusinessMs(priorDue, pauseBusiness, calendar) : clock.dueAt;

  const updated = await prisma.supportSlaClock.update({
    where: { id: clock.id },
    data: {
      state: SUPPORT_SLA_CLOCK_STATE.RUNNING,
      pausedAt: null,
      pausedMs,
      dueAt,
    },
  });
  await appendEvent(prisma, {
    clockId: clock.id,
    eventType: SUPPORT_SLA_EVENT_TYPE.RESUMED,
    at: now,
    meta: { reason: reason || null },
  });
  return updated;
}

/**
 * Stop FIRST_RESPONSE on first valid public human reply.
 * SYSTEM_EVENT / non-PUBLIC_AGENT_REPLY do nothing.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ ticketId: string, now?: Date, messageType?: string, policy?: object }} args
 */
export async function stopFirstResponseOnPublicReply(prisma, args = {}) {
  if (!hasSupportSlaClockModel(prisma)) {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      reason: 'support_sla_model_unavailable',
    };
  }

  const messageType = String(args.messageType || SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY);
  if (messageType !== SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY) {
    return { ok: true, skipped: true, reason: 'not_public_agent_reply' };
  }

  const ticketId = String(args.ticketId || '').trim();
  if (!ticketId) return { ok: false, error: 'ticketId required' };

  const now = args.now || new Date();
  const clock = await prisma.supportSlaClock.findFirst({
    where: {
      ticketId,
      clockType: SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE,
      state: {
        in: [SUPPORT_SLA_CLOCK_STATE.RUNNING, SUPPORT_SLA_CLOCK_STATE.PAUSED],
      },
    },
  });

  if (!clock) return { ok: true, noop: true };
  const updated = await stopClock(prisma, clock, now, 'PUBLIC_AGENT_REPLY');
  return { ok: true, clock: serializeClock(updated) };
}

/**
 * Status-driven SLA hooks: ack (optional), pause WAITING_*, stop RESOLUTION.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   ticketId: string,
 *   fromStatus?: string,
 *   toStatus: string,
 *   now?: Date,
 *   policy?: object,
 *   calendar?: object,
 * }} args
 */
export async function onTicketStatusChangeForSla(prisma, args = {}) {
  if (!hasSupportSlaClockModel(prisma)) {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      reason: 'support_sla_model_unavailable',
    };
  }

  const ticketId = String(args.ticketId || '').trim();
  if (!ticketId) return { ok: false, error: 'ticketId required' };

  const now = args.now || new Date();
  const toStatus = String(args.toStatus || '').toUpperCase();
  const fromStatus = args.fromStatus
    ? String(args.fromStatus).toUpperCase()
    : null;

  let clocks = [];
  try {
    clocks = await prisma.supportSlaClock.findMany({ where: { ticketId } });
  } catch {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      reason: 'support_sla_query_failed',
      actions: [],
    };
  }

  const actions = [];
  let pinnedUnavailable = false;

  // Ack as first response only when the FR clock's pinned policy enables it
  if (toStatus === SUPPORT_TICKET_STATUS.ACKNOWLEDGED) {
    const fr = clocks.find(
      (c) =>
        c.clockType === SUPPORT_SLA_CLOCK_TYPE.FIRST_RESPONSE &&
        (c.state === SUPPORT_SLA_CLOCK_STATE.RUNNING ||
          c.state === SUPPORT_SLA_CLOCK_STATE.PAUSED)
    );
    if (fr) {
      const frPolicy = await resolveClockPolicy(prisma, fr, args.policy);
      if (!frPolicy) {
        pinnedUnavailable = true;
      } else if (frPolicy.ackCountsAsFirstResponse === true) {
        await stopClock(prisma, fr, now, 'ACK_COUNTS_AS_FIRST_RESPONSE');
        actions.push('stop_first_response_ack');
      }
    }
  }

  for (const clock of clocks) {
    if (
      clock.state === SUPPORT_SLA_CLOCK_STATE.STOPPED ||
      clock.state === SUPPORT_SLA_CLOCK_STATE.BREACHED
    ) {
      continue;
    }

    const policy = await resolveClockPolicy(prisma, clock, args.policy);
    if (!policy) {
      pinnedUnavailable = true;
      continue;
    }

    const pauseNow = shouldPauseForStatus(policy, toStatus);
    const wasPaused = fromStatus ? shouldPauseForStatus(policy, fromStatus) : false;

    if (pauseNow && clock.state === SUPPORT_SLA_CLOCK_STATE.RUNNING) {
      await pauseClock(prisma, clock, now, toStatus);
      actions.push(`pause_${clock.clockType}`);
    } else if (
      !pauseNow &&
      wasPaused &&
      clock.state === SUPPORT_SLA_CLOCK_STATE.PAUSED
    ) {
      const calendar = await resolveClockCalendar(prisma, clock, args.calendar);
      if (!calendar) {
        pinnedUnavailable = true;
        continue;
      }
      const updated = await resumeClock(prisma, clock, now, calendar, toStatus);
      if (!updated) {
        pinnedUnavailable = true;
        continue;
      }
      actions.push(`resume_${clock.clockType}`);
    }
  }

  // Stop RESOLUTION using that clock's pinned policy (not latest catalogue)
  const resCandidate = clocks.find(
    (c) => c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION
  );
  let stopResolution = toStatus === SUPPORT_TICKET_STATUS.RESOLVED;
  if (toStatus === SUPPORT_TICKET_STATUS.CLOSED && resCandidate) {
    const resPolicy = await resolveClockPolicy(prisma, resCandidate, args.policy);
    if (!resPolicy) {
      pinnedUnavailable = true;
    } else {
      stopResolution = resPolicy.stopResolutionOnClosed !== false;
    }
  }

  if (stopResolution) {
    let refreshed = clocks;
    try {
      refreshed = await prisma.supportSlaClock.findMany({ where: { ticketId } });
    } catch {
      return {
        ok: true,
        status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
        reason: 'support_sla_query_failed',
        actions,
      };
    }
    const res = refreshed.find(
      (c) =>
        c.clockType === SUPPORT_SLA_CLOCK_TYPE.RESOLUTION &&
        (c.state === SUPPORT_SLA_CLOCK_STATE.RUNNING ||
          c.state === SUPPORT_SLA_CLOCK_STATE.PAUSED)
    );
    if (res) {
      await stopClock(prisma, res, now, toStatus);
      actions.push('stop_resolution');
    }
  }

  if (pinnedUnavailable) {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      reason: 'pinned_sla_version_unavailable',
      actions,
    };
  }

  return { ok: true, actions };
}

/**
 * Evaluate breach for a single clock. Breach facts are immutable once recorded.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ clockId: string, now?: Date, calendar?: object }} args
 */
export async function evaluateClockBreach(prisma, args = {}) {
  if (!hasSupportSlaClockModel(prisma)) {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      breached: false,
      reason: 'support_sla_model_unavailable',
    };
  }

  const clockId = String(args.clockId || '').trim();
  if (!clockId) return { ok: false, error: 'clockId required', breached: false };

  const now = args.now || new Date();
  const hasScopedLookup =
    typeof prisma.supportSlaClock.findUnique === 'function' ||
    typeof prisma.supportSlaClock.findFirst === 'function';
  if (!hasScopedLookup) {
    // Never fall back to findMany({}) — unbounded table scan is unsafe.
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      breached: false,
      reason: 'support_sla_lookup_unavailable',
    };
  }

  let clock = null;
  if (typeof prisma.supportSlaClock.findUnique === 'function') {
    try {
      clock = await prisma.supportSlaClock.findUnique({ where: { id: clockId } });
    } catch {
      clock = null;
    }
  }
  if (!clock && typeof prisma.supportSlaClock.findFirst === 'function') {
    try {
      const where = { id: clockId };
      if (args.ticketId) where.ticketId = String(args.ticketId).trim();
      clock = await prisma.supportSlaClock.findFirst({ where });
    } catch {
      clock = null;
    }
  }

  if (!clock) return { ok: false, notFound: true, error: 'clock_not_found', breached: false };

  if (clock.state === SUPPORT_SLA_CLOCK_STATE.BREACHED) {
    return { ok: true, breached: true, clock: serializeClock(clock), alreadyBreached: true };
  }

  if (
    clock.state === SUPPORT_SLA_CLOCK_STATE.STOPPED ||
    clock.state === SUPPORT_SLA_CLOCK_STATE.PAUSED
  ) {
    return { ok: true, breached: false, clock: serializeClock(clock) };
  }

  const dueAt = clock.dueAt ? new Date(clock.dueAt) : null;
  if (!dueAt || now.getTime() < dueAt.getTime()) {
    return { ok: true, breached: false, clock: serializeClock(clock) };
  }

  // Existing BREACHED event? Do not duplicate.
  let priorBreach = [];
  if (typeof prisma.supportSlaEvent?.findMany === 'function') {
    priorBreach = await prisma.supportSlaEvent.findMany({
      where: { clockId: clock.id, eventType: SUPPORT_SLA_EVENT_TYPE.BREACHED },
    });
  }

  if (priorBreach.length > 0) {
    if (clock.state !== SUPPORT_SLA_CLOCK_STATE.BREACHED) {
      clock = await prisma.supportSlaClock.update({
        where: { id: clock.id },
        data: {
          state: SUPPORT_SLA_CLOCK_STATE.BREACHED,
          breachedAt: clock.breachedAt || priorBreach[0].at || now,
        },
      });
    }
    return { ok: true, breached: true, clock: serializeClock(clock), alreadyBreached: true };
  }

  const updated = await prisma.supportSlaClock.update({
    where: { id: clock.id },
    data: {
      state: SUPPORT_SLA_CLOCK_STATE.BREACHED,
      breachedAt: now,
    },
  });
  await appendEvent(prisma, {
    clockId: clock.id,
    eventType: SUPPORT_SLA_EVENT_TYPE.BREACHED,
    at: now,
  });

  return { ok: true, breached: true, clock: serializeClock(updated) };
}

/**
 * List clocks for a ticket. Never invent breach % when unavailable.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, ticketId: string, evaluate?: boolean, now?: Date }} args
 */
export async function listClocksForTicket(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden', items: [] };
  }

  if (!hasSupportSlaClockModel(prisma)) {
    return {
      ok: true,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      items: [],
      meta: {
        unavailable: true,
        reason: 'support_sla_model_unavailable',
        // Explicitly omit breachRate / breachPercent — never fake 0%
      },
    };
  }

  const ticket = await findSupportTicket(prisma, args.ticketId);
  if (!ticket) {
    return { ok: false, notFound: true, error: 'ticket_not_found', items: [] };
  }

  let rows = [];
  try {
    rows = await prisma.supportSlaClock.findMany({
      where: { ticketId: ticket.id },
      orderBy: { startedAt: 'asc' },
    });
  } catch {
    return {
      ok: false,
      status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
      items: [],
      meta: {
        unavailable: true,
        reason: 'support_sla_query_failed',
      },
    };
  }

  if (args.evaluate !== false) {
    const now = args.now || new Date();
    for (const row of rows) {
      if (row.state === SUPPORT_SLA_CLOCK_STATE.RUNNING) {
        await evaluateClockBreach(prisma, { clockId: row.id, now });
      }
    }
    try {
      rows = await prisma.supportSlaClock.findMany({
        where: { ticketId: ticket.id },
        orderBy: { startedAt: 'asc' },
      });
    } catch {
      return {
        ok: false,
        status: SUPPORT_SLA_AVAILABILITY.UNAVAILABLE,
        items: [],
        meta: {
          unavailable: true,
          reason: 'support_sla_query_failed',
        },
      };
    }
  }

  return {
    ok: true,
    status: SUPPORT_SLA_AVAILABILITY.AVAILABLE,
    items: (rows || []).map(serializeClock),
    meta: {
      count: (rows || []).length,
      ticketId: ticket.id,
      policyVersionPinned: true,
    },
  };
}

export { serializeClock };
