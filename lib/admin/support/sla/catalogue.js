/**
 * Support SLA catalogue — Phase 10 Wave 3.
 * Clock types + default pinned policy/calendar version ids.
 */

export const SUPPORT_SLA_CLOCK_TYPE = Object.freeze({
  FIRST_RESPONSE: 'FIRST_RESPONSE',
  NEXT_RESPONSE: 'NEXT_RESPONSE',
  RESOLUTION: 'RESOLUTION',
});

export const SUPPORT_SLA_CLOCK_TYPES = Object.freeze(
  Object.values(SUPPORT_SLA_CLOCK_TYPE)
);

export const SUPPORT_SLA_CLOCK_STATE = Object.freeze({
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  BREACHED: 'BREACHED',
});

export const SUPPORT_SLA_CLOCK_STATES = Object.freeze(
  Object.values(SUPPORT_SLA_CLOCK_STATE)
);

export const SUPPORT_SLA_EVENT_TYPE = Object.freeze({
  STARTED: 'STARTED',
  PAUSED: 'PAUSED',
  RESUMED: 'RESUMED',
  STOPPED: 'STOPPED',
  BREACHED: 'BREACHED',
});

/** Pinned default policy version — historical clocks never silently upgrade. */
export const SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID = 'sla-policy-default-v1';

/** Pinned default calendar version. */
export const SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID = 'sla-calendar-default-v1';

export const SUPPORT_SLA_AVAILABILITY = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});
