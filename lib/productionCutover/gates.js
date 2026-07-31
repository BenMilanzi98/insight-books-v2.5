/**
 * Go-live gate evaluation — does not approve; only checks provided evidence flags.
 */

export function evaluateGoLiveGates(evidence = {}) {
  const required = [
    ['backupVerified', 'Backup verified'],
    ['restoreVerified', 'Restore verified'],
    ['rehearsalPassed', 'Final migration rehearsal passed'],
    ['financialReconciliationPassed', 'Financial reconciliation passed'],
    ['securityValidationPassed', 'Security validation passed'],
    ['technicalValidationPassed', 'Technical validation passed'],
    ['uatPassed', 'UAT passed'],
    ['capacityValidated', 'Capacity validated (Phase 17)'],
    ['observabilityActive', 'Observability active'],
    ['alertsActive', 'Alerts active'],
    ['hypercareStaffed', 'Hypercare staffed'],
    ['rollbackOrForwardReady', 'Rollback or forward-recovery ready'],
    ['financeAcceptance', 'Finance acceptance'],
    ['securityAcceptance', 'Security acceptance'],
    ['technicalAcceptance', 'Technical acceptance'],
    ['businessAcceptance', 'Business acceptance'],
  ];

  const missing = [];
  const present = [];
  for (const [key, label] of required) {
    if (evidence[key] === true) present.push(key);
    else missing.push({ key, label });
  }

  let decision = 'NO_GO';
  if (missing.length === 0) decision = 'GO';
  else if (
    evidence.financialReconciliationPassed === true &&
    evidence.securityValidationPassed === true &&
    missing.every((m) =>
      ['capacityValidated', 'uatPassed'].includes(m.key)
    )
  ) {
    decision = 'CONDITIONAL_GO_REVIEW';
  }

  return {
    decision,
    present,
    missing,
    note:
      decision === 'GO'
        ? 'All listed gates marked true — still requires human Go-Live Decision record.'
        : 'Cutover must not proceed until missing gates are satisfied or formally waived.',
  };
}
