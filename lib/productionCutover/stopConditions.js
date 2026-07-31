/**
 * Explicit stop conditions for Phase 18 cutover.
 */

export const STOP_CONDITIONS = Object.freeze([
  { id: 'SC-BACKUP', description: 'Backup failure or unverified backup', severity: 'CRITICAL' },
  { id: 'SC-RESTORE', description: 'Restore verification failure', severity: 'CRITICAL' },
  { id: 'SC-SCHEMA', description: 'Schema migration failure', severity: 'CRITICAL' },
  { id: 'SC-JOURNAL', description: 'Journal imbalance', severity: 'CRITICAL' },
  { id: 'SC-TB', description: 'Trial Balance imbalance or unexplained difference', severity: 'CRITICAL' },
  { id: 'SC-FS', description: 'Unexplained Financial Statement difference', severity: 'CRITICAL' },
  { id: 'SC-AR', description: 'Receivables reconciliation failure', severity: 'CRITICAL' },
  { id: 'SC-AP', description: 'Payables reconciliation failure', severity: 'CRITICAL' },
  { id: 'SC-INV', description: 'Inventory reconciliation failure', severity: 'CRITICAL' },
  { id: 'SC-BANK', description: 'Bank reconciliation failure', severity: 'CRITICAL' },
  { id: 'SC-LOAN', description: 'Loan reconciliation failure', severity: 'CRITICAL' },
  { id: 'SC-EQ', description: 'Equity reconciliation failure', severity: 'CRITICAL' },
  { id: 'SC-TENANT', description: 'Cross-Business access or leakage', severity: 'CRITICAL' },
  { id: 'SC-ACCESS', description: 'Missing critical users or Memberships', severity: 'HIGH' },
  { id: 'SC-AUDIT', description: 'Audit Event migration failure', severity: 'CRITICAL' },
  { id: 'SC-FILE', description: 'Sensitive file exposure', severity: 'CRITICAL' },
  { id: 'SC-DUP', description: 'Duplicate financial posting', severity: 'CRITICAL' },
  { id: 'SC-INT', description: 'Integration posting twice', severity: 'CRITICAL' },
  { id: 'SC-DB', description: 'Severe database instability', severity: 'CRITICAL' },
  { id: 'SC-CAP', description: 'Capacity threshold breach', severity: 'HIGH' },
  { id: 'SC-OBS', description: 'Monitoring unavailable at go-live', severity: 'HIGH' },
]);

/**
 * @param {Array<{ id: string, triggered: boolean, detail?: string }>} findings
 */
export function evaluateStopConditions(findings = []) {
  const triggered = findings.filter((f) => f.triggered);
  const critical = triggered.filter((f) => {
    const def = STOP_CONDITIONS.find((s) => s.id === f.id);
    return def?.severity === 'CRITICAL';
  });
  return {
    mustStop: critical.length > 0 || triggered.some((f) => f.forceStop),
    triggered,
    critical,
    decision: critical.length ? 'NO_GO' : triggered.length ? 'CONDITIONAL_GO_REVIEW' : 'CLEAR',
  };
}
