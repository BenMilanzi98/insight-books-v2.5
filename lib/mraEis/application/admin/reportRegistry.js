/**
 * Phase 18 — MraEisReportDefinitionRegistry (versioned, permission-aware).
 */

export const REPORT_DEFINITIONS = Object.freeze({
  EIS_TENANT_ADOPTION: {
    id: 'EIS_TENANT_ADOPTION',
    name: 'EIS Tenant Adoption',
    audience: 'SYSTEM_ADMINISTRATOR',
    dataSource: 'MraEisTenantEntitlement',
    permissions: ['system.eis.view'],
    exportFormats: ['PDF', 'XLSX', 'CSV'],
    maxRangeDays: 365,
    asyncThresholdRows: 5000,
    columns: ['tenantId', 'entitlementState', 'environment', 'updatedAt'],
    totals: ['tenantCount'],
    version: 'report-v1',
  },
  TERMINAL_FLEET: {
    id: 'TERMINAL_FLEET',
    name: 'Terminal Fleet',
    audience: 'TENANT_ADMINISTRATOR',
    dataSource: 'MraEisTerminal',
    permissions: ['eis.terminal.view'],
    exportFormats: ['PDF', 'XLSX', 'CSV'],
    maxRangeDays: 90,
    columns: ['terminalId', 'environment', 'status', 'blockedAt', 'lastActivityAt'],
    totals: ['terminalCount', 'blockedCount'],
    version: 'report-v1',
  },
  ONLINE_TRANSMISSION_SUMMARY: {
    id: 'ONLINE_TRANSMISSION_SUMMARY',
    name: 'Online Transmission Summary',
    audience: 'COMPLIANCE_OFFICER',
    dataSource: 'MraEisTransmission',
    permissions: ['eis.salesTransmission.view'],
    exportFormats: ['PDF', 'XLSX', 'CSV'],
    maxRangeDays: 90,
    columns: ['transmissionId', 'state', 'outcome', 'fiscalNumber', 'terminalId', 'createdAt'],
    totals: ['accepted', 'rejected', 'unknown'],
    version: 'report-v1',
  },
  ACTIVE_RECONCILIATION_CASES: {
    id: 'ACTIVE_RECONCILIATION_CASES',
    name: 'Active Reconciliation Cases',
    audience: 'RECONCILIATION_OFFICER',
    dataSource: 'MraEisTransmissionReconciliation',
    permissions: ['eis.reconciliation.view'],
    exportFormats: ['XLSX', 'CSV'],
    maxRangeDays: 90,
    columns: ['caseId', 'state', 'matchOutcome', 'terminalId', 'ageHours'],
    totals: ['openCases'],
    version: 'report-v1',
  },
  OFFLINE_QUEUE: {
    id: 'OFFLINE_QUEUE',
    name: 'Offline Queue',
    audience: 'POS_SUPERVISOR',
    dataSource: 'MraEisOfflineQueueEntry',
    permissions: ['eis.offline.queue.view'],
    exportFormats: ['XLSX', 'CSV'],
    maxRangeDays: 30,
    columns: ['queueItemId', 'state', 'offlineFiscalNumber', 'agentId', 'ageHours'],
    totals: ['queueDepth'],
    version: 'report-v1',
  },
  FISCAL_RECEIPT_SUMMARY: {
    id: 'FISCAL_RECEIPT_SUMMARY',
    name: 'Fiscal Receipt Summary',
    audience: 'FINANCE_MANAGER',
    dataSource: 'MraEisFiscalReceipt',
    permissions: ['eis.fiscalReceipts.view'],
    exportFormats: ['PDF', 'XLSX', 'CSV'],
    maxRangeDays: 90,
    columns: ['receiptId', 'state', 'originalOrReprint', 'fiscalNumber', 'generatedAt'],
    totals: ['receiptCount', 'reprintCount'],
    version: 'report-v1',
  },
  ACTIVE_RESTRICTIONS: {
    id: 'ACTIVE_RESTRICTIONS',
    name: 'Active Restrictions',
    audience: 'COMPLIANCE_OFFICER',
    dataSource: 'MraEisRestriction',
    permissions: ['eis.restrictions.view'],
    exportFormats: ['PDF', 'XLSX', 'CSV', 'JSON_EVIDENCE'],
    maxRangeDays: 365,
    columns: ['restrictionId', 'reasonCode', 'sourceType', 'scopeType', 'severity', 'state'],
    totals: ['activeCount', 'criticalCount'],
    version: 'report-v1',
  },
  UNBLOCK_REQUESTS: {
    id: 'UNBLOCK_REQUESTS',
    name: 'Unblock Requests',
    audience: 'COMPLIANCE_OFFICER',
    dataSource: 'MraEisUnblockRequest',
    permissions: ['eis.unblockRequests.view'],
    exportFormats: ['XLSX', 'CSV'],
    maxRangeDays: 365,
    columns: ['requestId', 'state', 'restrictionId', 'terminalId', 'requestedAt'],
    totals: ['pendingCount'],
    version: 'report-v1',
  },
  CERTIFICATION_STATUS: {
    id: 'CERTIFICATION_STATUS',
    name: 'Certification Status',
    audience: 'SYSTEM_ADMINISTRATOR',
    dataSource: 'MraEisCertificationRecord',
    permissions: ['system.eis.certification.view', 'eis.restrictions.view'],
    exportFormats: ['PDF', 'XLSX'],
    maxRangeDays: 365,
    columns: ['certificationId', 'type', 'status', 'effectiveFrom', 'expiresAt'],
    totals: ['active', 'expiring'],
    version: 'report-v1',
  },
  AUDIT_ACTIVITY: {
    id: 'AUDIT_ACTIVITY',
    name: 'Audit Activity',
    audience: 'AUDITOR',
    dataSource: 'MraEisControlAuditEvent',
    permissions: ['eis.audit.view', 'system.eis.audit.view'],
    exportFormats: ['CSV', 'XLSX'],
    maxRangeDays: 90,
    columns: ['eventId', 'action', 'actorId', 'entityType', 'createdAt'],
    totals: ['eventCount'],
    version: 'report-v1',
  },
});

export function getReportDefinition(reportId) {
  return REPORT_DEFINITIONS[reportId] || null;
}

export function listReportDefinitions({ audience = null } = {}) {
  return Object.values(REPORT_DEFINITIONS).filter((r) => !audience || r.audience === audience);
}

/**
 * Traceability metadata for a report line / total.
 */
export function buildReportTraceability({ reportId, filters = {}, timezone = 'Africa/Blantyre' } = {}) {
  const def = getReportDefinition(reportId);
  if (!def) return null;
  return {
    reportId: def.id,
    reportVersion: def.version,
    sourceEntity: def.dataSource,
    sourceFields: def.columns,
    filters,
    timezone,
    currencyPolicy: 'MWK_DISPLAY_WITH_CURRENCY_CODE',
    readModelVersion: `${def.id.toLowerCase()}-rm-v1`,
    dataFreshnessRequired: true,
    credentialsExcluded: true,
    privateKeysExcluded: true,
    buyerAuthorizationExcluded: true,
  };
}

/**
 * Reconcile on-screen totals to detail row counts (synthetic check helper).
 */
export function reconcileReportTotals({ totals = {}, detailRows = [] } = {}) {
  const detailCount = detailRows.length;
  const mismatches = [];
  if (totals.rowCount != null && totals.rowCount !== detailCount) {
    mismatches.push({
      field: 'rowCount',
      reported: totals.rowCount,
      detail: detailCount,
    });
  }
  return {
    ok: mismatches.length === 0,
    mismatches,
    detailCount,
    note: 'Report figures must reconcile to source detail rows.',
  };
}
