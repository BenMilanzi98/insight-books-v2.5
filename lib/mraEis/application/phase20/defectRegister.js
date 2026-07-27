/**
 * Phase 20 — Defect register (in-memory for tests / release-gate evaluation).
 */

export const DEFECT_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const DEFECT_STATE = Object.freeze({
  NEW: 'NEW',
  TRIAGED: 'TRIAGED',
  REPRODUCED: 'REPRODUCED',
  ROOT_CAUSE_IDENTIFIED: 'ROOT_CAUSE_IDENTIFIED',
  FIX_IN_PROGRESS: 'FIX_IN_PROGRESS',
  FIXED: 'FIXED',
  RETESTING: 'RETESTING',
  VERIFIED: 'VERIFIED',
  DEFERRED_WITH_APPROVAL: 'DEFERRED_WITH_APPROVAL',
  BLOCKED: 'BLOCKED',
  CLOSED: 'CLOSED',
});

const DEFECTS = new Map();

export function __resetDefectsForTests() {
  DEFECTS.clear();
}

export function registerDefect(input = {}) {
  const id = input.id || `DEF-${String(DEFECTS.size + 1).padStart(4, '0')}`;
  const row = {
    id,
    title: input.title || 'Untitled',
    phaseOrigin: input.phaseOrigin ?? 20,
    category: input.category || 'GENERAL',
    severity: input.severity || DEFECT_SEVERITY.MEDIUM,
    priority: input.priority || input.severity || DEFECT_SEVERITY.MEDIUM,
    environment: input.environment || 'MOCK_MRA',
    component: input.component || null,
    requirementId: input.requirementId || null,
    testCaseId: input.testCaseId || null,
    reproductionSteps: input.reproductionSteps || [],
    expectedResult: input.expectedResult || null,
    actualResult: input.actualResult || null,
    evidence: input.evidence || [],
    rootCause: input.rootCause || null,
    fixReference: input.fixReference || null,
    regressionTestReference: input.regressionTestReference || null,
    state: input.state || DEFECT_STATE.NEW,
    owner: input.owner || null,
    createdAt: new Date().toISOString(),
    fixedAt: null,
    verifiedAt: null,
  };
  DEFECTS.set(id, row);
  return row;
}

export function updateDefect(id, patch = {}) {
  const row = DEFECTS.get(id);
  if (!row) throw new Error(`Unknown defect ${id}`);
  Object.assign(row, patch);
  if (patch.state === DEFECT_STATE.FIXED || patch.state === DEFECT_STATE.VERIFIED) {
    row.fixedAt = row.fixedAt || new Date().toISOString();
  }
  if (patch.state === DEFECT_STATE.VERIFIED) {
    row.verifiedAt = new Date().toISOString();
  }
  return row;
}

export function listDefects() {
  return [...DEFECTS.values()];
}

export function summarizeDefects() {
  const all = listDefects();
  // BLOCKED / DEFERRED are environmental or approved carry-forwards — not open code defects
  const open = all.filter(
    (d) => !['FIXED', 'VERIFIED', 'CLOSED', 'DEFERRED_WITH_APPROVAL', 'BLOCKED'].includes(d.state)
  );
  const environmentalBlockers = all.filter((d) => d.state === DEFECT_STATE.BLOCKED);
  const count = (sev) => open.filter((d) => d.severity === sev).length;
  return {
    total: all.length,
    open: open.length,
    critical: count(DEFECT_SEVERITY.CRITICAL),
    high: count(DEFECT_SEVERITY.HIGH),
    medium: count(DEFECT_SEVERITY.MEDIUM),
    low: count(DEFECT_SEVERITY.LOW),
    environmentalBlockers: environmentalBlockers.length,
    criticalWithoutRca: open.filter((d) => d.severity === 'CRITICAL' && !d.rootCause).length,
    highWithoutRca: open.filter((d) => d.severity === 'HIGH' && !d.rootCause).length,
    fixedWithoutRegression: all.filter(
      (d) =>
        ['FIXED', 'VERIFIED', 'CLOSED'].includes(d.state) &&
        ['CRITICAL', 'HIGH'].includes(d.severity) &&
        !d.regressionTestReference
    ).length,
  };
}

/** Seed known Phase 20 carry-forward blockers as documented (not code defects). */
export function seedPhase20CarryForwardBlockers() {
  registerDefect({
    id: 'DEF-CF-001',
    title: 'Live MRA Sandbox sales/offline/unblock contracts not executed in CI',
    phaseOrigin: 13,
    category: 'CONTRACT',
    severity: DEFECT_SEVERITY.HIGH,
    state: DEFECT_STATE.BLOCKED,
    rootCause: 'Requires authorized Sandbox credentials and MRA environment; not available in default CI.',
    evidence: ['G13-001', 'G16-001', 'G17-001', 'P13-002', 'P16-002', 'P17-002', 'P20-006'],
  });
  registerDefect({
    id: 'DEF-CF-002',
    title: 'Full Production-like load/soak/chaos rehearsal not executed in this workspace',
    phaseOrigin: 20,
    category: 'PERFORMANCE',
    severity: DEFECT_SEVERITY.MEDIUM,
    state: DEFECT_STATE.DEFERRED_WITH_APPROVAL,
    rootCause: 'Requires Staging topology and scheduled soak window.',
    evidence: ['P20-005'],
  });
  registerDefect({
    id: 'DEF-CF-003',
    title: 'Live Production source extraction for Phase 19 migration not executed',
    phaseOrigin: 19,
    category: 'MIGRATION',
    severity: DEFECT_SEVERITY.MEDIUM,
    state: DEFECT_STATE.BLOCKED,
    rootCause: 'Operator-approved read-only Production access required (G19-001).',
    evidence: ['P19-002', 'G19-001'],
  });
  return summarizeDefects();
}
