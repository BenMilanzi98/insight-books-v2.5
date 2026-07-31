/**
 * Phase 6 — Historical repair catalogue.
 *
 * Single machine-readable definition of anomaly types, severities, evidence
 * confidence levels, repair classes, status machines and the approval matrix.
 * Every service and API validates against this module; nothing else may
 * define repair vocabulary.
 */

export const AnomalySeverity = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

/** Evidence confidence levels with their automation gates. */
export const ConfidenceLevel = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
  MEDIUM_CONFIDENCE: 'MEDIUM_CONFIDENCE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  UNSUPPORTED: 'UNSUPPORTED',
});

/** Confidence levels that permit a repair to be APPROVED at all. */
export const REPAIRABLE_CONFIDENCE = Object.freeze([
  ConfidenceLevel.CONFIRMED,
  ConfidenceLevel.HIGH_CONFIDENCE,
]);

export const AnomalyStatus = Object.freeze({
  DETECTED: 'DETECTED',
  UNDER_INVESTIGATION: 'UNDER_INVESTIGATION',
  EVIDENCE_INCOMPLETE: 'EVIDENCE_INCOMPLETE',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  APPROVED_FOR_REPAIR: 'APPROVED_FOR_REPAIR',
  REJECTED: 'REJECTED',
  REPAIR_SCHEDULED: 'REPAIR_SCHEDULED',
  REPAIRING: 'REPAIRING',
  REPAIRED: 'REPAIRED',
  VERIFIED: 'VERIFIED',
  REPAIR_FAILED: 'REPAIR_FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  ACCEPTED_EXCEPTION: 'ACCEPTED_EXCEPTION',
});

/** Permitted anomaly status transitions. */
export const ANOMALY_TRANSITIONS = Object.freeze({
  DETECTED: ['UNDER_INVESTIGATION', 'EVIDENCE_INCOMPLETE', 'READY_FOR_REVIEW', 'ACCEPTED_EXCEPTION'],
  UNDER_INVESTIGATION: ['EVIDENCE_INCOMPLETE', 'READY_FOR_REVIEW', 'ACCEPTED_EXCEPTION'],
  EVIDENCE_INCOMPLETE: ['UNDER_INVESTIGATION', 'READY_FOR_REVIEW', 'ACCEPTED_EXCEPTION'],
  READY_FOR_REVIEW: ['APPROVED_FOR_REPAIR', 'REJECTED', 'UNDER_INVESTIGATION', 'ACCEPTED_EXCEPTION'],
  APPROVED_FOR_REPAIR: ['REPAIR_SCHEDULED', 'REJECTED'],
  REJECTED: ['UNDER_INVESTIGATION'],
  REPAIR_SCHEDULED: ['REPAIRING'],
  REPAIRING: ['REPAIRED', 'REPAIR_FAILED'],
  REPAIRED: ['VERIFIED', 'REPAIR_FAILED', 'ROLLED_BACK'],
  VERIFIED: [],
  REPAIR_FAILED: ['REPAIR_SCHEDULED', 'UNDER_INVESTIGATION', 'ROLLED_BACK'],
  ROLLED_BACK: ['UNDER_INVESTIGATION'],
  ACCEPTED_EXCEPTION: ['UNDER_INVESTIGATION'],
});

export const RepairBatchStatus = Object.freeze({
  DRAFT: 'DRAFT',
  ANALYZED: 'ANALYZED',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  FAILED: 'FAILED',
  VERIFYING: 'VERIFYING',
  VERIFIED: 'VERIFIED',
  ROLLED_BACK: 'ROLLED_BACK',
  CANCELLED: 'CANCELLED',
});

export const BATCH_TRANSITIONS = Object.freeze({
  DRAFT: ['ANALYZED', 'CANCELLED'],
  ANALYZED: ['READY_FOR_REVIEW', 'DRAFT', 'CANCELLED'],
  READY_FOR_REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'EXECUTING', 'CANCELLED'],
  SCHEDULED: ['EXECUTING', 'CANCELLED'],
  EXECUTING: ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'],
  COMPLETED: ['VERIFYING'],
  PARTIALLY_COMPLETED: ['VERIFYING', 'EXECUTING'],
  FAILED: ['EXECUTING', 'ROLLED_BACK'],
  VERIFYING: ['VERIFIED', 'FAILED'],
  VERIFIED: [],
  ROLLED_BACK: [],
  CANCELLED: [],
});

export const RepairActionStatus = Object.freeze({
  PENDING: 'PENDING',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
});

/** The twelve approved repair classes. Nothing else may modify financial data. */
export const RepairType = Object.freeze({
  METADATA_ONLY_REPAIR: 'METADATA_ONLY_REPAIR',
  SOURCE_STATUS_REPAIR: 'SOURCE_STATUS_REPAIR',
  SOURCE_LINK_REPAIR: 'SOURCE_LINK_REPAIR',
  REVERSAL_REPAIR: 'REVERSAL_REPAIR',
  RECLASSIFICATION_REPAIR: 'RECLASSIFICATION_REPAIR',
  AMOUNT_ADJUSTMENT_REPAIR: 'AMOUNT_ADJUSTMENT_REPAIR',
  MISSING_JOURNAL_REPAIR: 'MISSING_JOURNAL_REPAIR',
  DUPLICATE_EFFECT_REPAIR: 'DUPLICATE_EFFECT_REPAIR',
  PERIOD_ADJUSTMENT_REPAIR: 'PERIOD_ADJUSTMENT_REPAIR',
  CROSS_BUSINESS_REPAIR: 'CROSS_BUSINESS_REPAIR',
  REPORT_ONLY_REPAIR: 'REPORT_ONLY_REPAIR',
  PROJECTION_REBUILD: 'PROJECTION_REBUILD',
});

/** Repair classes that create journals (all flow through the posting engine). */
export const JOURNAL_CREATING_REPAIRS = Object.freeze([
  RepairType.REVERSAL_REPAIR,
  RepairType.RECLASSIFICATION_REPAIR,
  RepairType.AMOUNT_ADJUSTMENT_REPAIR,
  RepairType.MISSING_JOURNAL_REPAIR,
  RepairType.DUPLICATE_EFFECT_REPAIR,
  RepairType.PERIOD_ADJUSTMENT_REPAIR,
  RepairType.CROSS_BUSINESS_REPAIR,
]);

/** Anomaly type catalogue: definition, detection, permitted repairs, approval. */
export const ANOMALY_TYPES = Object.freeze({
  TECHNICAL_LINKAGE_ERROR: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Non-financial linkage or normalization defect (casing, missing marker, broken reference).',
    detection: 'JRN-106 and linkage scans.',
    requiredEvidence: 'The linked records themselves.',
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR],
  },
  MISSING_SOURCE_LINK: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Valid journal and source exist but are not linked.',
    detection: 'Source-linkage scan (PK/reference matching).',
    requiredEvidence: 'Unique reference, exact business, exact amount/account/date agreement.',
    permittedRepairs: [RepairType.SOURCE_LINK_REPAIR, RepairType.METADATA_ONLY_REPAIR],
  },
  MISSING_JOURNAL: {
    severity: AnomalySeverity.HIGH,
    definition: 'Financial source reached a posting-required state with no authoritative journal.',
    detection: 'Source vs canonical journal comparison.',
    requiredEvidence: 'Authoritative source with amount, tax, currency, date, mappings.',
    permittedRepairs: [RepairType.MISSING_JOURNAL_REPAIR, RepairType.SOURCE_STATUS_REPAIR],
  },
  ORPHAN_JOURNAL: {
    severity: AnomalySeverity.HIGH,
    definition: 'Posted journal with no valid source and no legitimate manual/opening/adjustment classification.',
    detection: 'Journal source-resolution scan.',
    requiredEvidence: 'Proof of source relationship, or proof journal is invalid.',
    permittedRepairs: [RepairType.SOURCE_LINK_REPAIR, RepairType.METADATA_ONLY_REPAIR, RepairType.REVERSAL_REPAIR],
  },
  DUPLICATE_JOURNAL: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Two or more active journals represent one economic event.',
    detection: 'Source/event identity + amount/account/date correlation.',
    requiredEvidence: 'Matching identity fields; proof neither is a legitimate repeat.',
    permittedRepairs: [RepairType.DUPLICATE_EFFECT_REPAIR],
  },
  DUPLICATE_JOURNAL_LINE: {
    severity: AnomalySeverity.HIGH,
    definition: 'Duplicate lines inside one journal (import/join defects distinguished).',
    detection: 'Intra-journal line comparison.',
    requiredEvidence: 'Line-level provenance.',
    permittedRepairs: [RepairType.REVERSAL_REPAIR, RepairType.PROJECTION_REBUILD, RepairType.REPORT_ONLY_REPAIR],
  },
  UNBALANCED_JOURNAL: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Posted journal whose line debits do not equal credits.',
    detection: 'JRN-102.',
    requiredEvidence: 'Root cause (missing/duplicate line, wrong amount, import defect).',
    permittedRepairs: [RepairType.REVERSAL_REPAIR, RepairType.AMOUNT_ADJUSTMENT_REPAIR, RepairType.MISSING_JOURNAL_REPAIR],
  },
  WRONG_ACCOUNT: {
    severity: AnomalySeverity.HIGH,
    definition: 'Correct amount posted to the wrong account.',
    detection: 'Mapping comparison, salary cleanup register, manual review.',
    requiredEvidence: 'Source document proving correct classification.',
    permittedRepairs: [RepairType.RECLASSIFICATION_REPAIR, RepairType.REVERSAL_REPAIR],
  },
  WRONG_ACCOUNT_CATEGORY: {
    severity: AnomalySeverity.HIGH,
    definition: 'Posting crosses categories (e.g. loan proceeds as revenue).',
    detection: 'Category rules vs source type.',
    requiredEvidence: 'Source contract/schedule.',
    permittedRepairs: [RepairType.RECLASSIFICATION_REPAIR, RepairType.REVERSAL_REPAIR],
  },
  WRONG_PERIOD: {
    severity: AnomalySeverity.HIGH,
    definition: 'Journal posted to the wrong accounting period.',
    detection: 'Posting date vs period bounds.',
    requiredEvidence: 'Correct transaction date and period policy.',
    permittedRepairs: [RepairType.PERIOD_ADJUSTMENT_REPAIR, RepairType.METADATA_ONLY_REPAIR],
  },
  WRONG_POSTING_DATE: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Posting date provably wrong; period unaffected or metadata-only.',
    detection: 'Audit trail comparison.',
    requiredEvidence: 'Immutable audit evidence of the true date.',
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR, RepairType.PERIOD_ADJUSTMENT_REPAIR],
  },
  WRONG_TRANSACTION_DATE: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Economic date provably wrong.',
    detection: 'Source comparison.',
    requiredEvidence: 'Source document date.',
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR, RepairType.PERIOD_ADJUSTMENT_REPAIR],
  },
  WRONG_BUSINESS: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Journal posted in a business that does not own the economic event.',
    detection: 'Cross-tenant reference scan + ownership review.',
    requiredEvidence: 'Proven rightful ownership; security review.',
    permittedRepairs: [RepairType.CROSS_BUSINESS_REPAIR],
  },
  WRONG_BRANCH: dimensionType('branch'),
  WRONG_DEPARTMENT: dimensionType('department'),
  WRONG_PROJECT: dimensionType('project'),
  WRONG_COST_CENTRE: dimensionType('cost centre'),
  MISSING_CUSTOMER: missingDimensionType('customer', 'AR subledger'),
  MISSING_SUPPLIER: missingDimensionType('supplier', 'AP subledger'),
  MISSING_OWNER: missingDimensionType('owner', 'equity subledger'),
  MISSING_EMPLOYEE: missingDimensionType('employee', 'payroll subledger'),
  MISSING_BANK_ACCOUNT: missingDimensionType('bank account', 'banking'),
  MISSING_ASSET: missingDimensionType('asset', 'fixed assets'),
  MISSING_LOAN: missingDimensionType('loan', 'loans'),
  MISSING_TAX_CODE: missingDimensionType('tax code', 'tax'),
  INVALID_REVERSAL: {
    severity: AnomalySeverity.HIGH,
    definition: 'Reversal with wrong accounts/amounts/date/business or missing original link.',
    detection: 'Reversal-pair audit.',
    requiredEvidence: 'Original journal and reversal comparison.',
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR, RepairType.REVERSAL_REPAIR, RepairType.AMOUNT_ADJUSTMENT_REPAIR],
  },
  DUPLICATE_REVERSAL: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'One journal reversed more than once.',
    detection: 'Multiple active reversals per original.',
    requiredEvidence: 'Reversal set.',
    permittedRepairs: [RepairType.DUPLICATE_EFFECT_REPAIR],
  },
  MISSING_REVERSAL: {
    severity: AnomalySeverity.HIGH,
    definition: 'A cancellation happened operationally but the reversal journal is absent/incomplete.',
    detection: 'Source state vs journal comparison.',
    requiredEvidence: 'Operational cancellation evidence.',
    permittedRepairs: [RepairType.REVERSAL_REPAIR, RepairType.AMOUNT_ADJUSTMENT_REPAIR],
  },
  OPENING_BALANCE_DUPLICATION: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Opening balances counted more than once (repeated batch, stored field + journal).',
    detection: 'Opening-batch/onboarding comparison.',
    requiredEvidence: 'Authoritative opening batch identification.',
    permittedRepairs: [RepairType.DUPLICATE_EFFECT_REPAIR, RepairType.REPORT_ONLY_REPAIR],
  },
  UNSUPPORTED_OPENING_BALANCE: {
    severity: AnomalySeverity.HIGH,
    definition: 'Opening value with no migration evidence.',
    detection: 'Opening journals without evidence reference.',
    requiredEvidence: 'Migration evidence, or exception.',
    permittedRepairs: [RepairType.MISSING_JOURNAL_REPAIR, RepairType.REPORT_ONLY_REPAIR],
  },
  CAPITAL_DUPLICATION: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Owner capital displayed as a multiple of the posted amount.',
    detection: 'Capital trace: stored vs derived vs report surfaces.',
    requiredEvidence: 'Per-surface trace proving the duplicating mechanism.',
    permittedRepairs: [RepairType.REPORT_ONLY_REPAIR, RepairType.PROJECTION_REBUILD, RepairType.DUPLICATE_EFFECT_REPAIR],
  },
  UNSUPPORTED_LIABILITY: {
    severity: AnomalySeverity.HIGH,
    definition: 'Liability visible in CoA/reports without journal support.',
    detection: 'Report-surface vs canonical journal comparison.',
    requiredEvidence: 'Creditor/contract evidence for creation; cache provenance for exclusion.',
    permittedRepairs: [RepairType.MISSING_JOURNAL_REPAIR, RepairType.REPORT_ONLY_REPAIR],
  },
  STORED_BALANCE_DIFFERENCE: {
    severity: AnomalySeverity.HIGH,
    definition: 'Stored balance cache disagrees with canonical journal lines (GL-111).',
    detection: 'Reconciliation service.',
    requiredEvidence: 'The comparison itself.',
    permittedRepairs: [RepairType.PROJECTION_REBUILD, RepairType.REPORT_ONLY_REPAIR],
  },
  PARENT_CHILD_DOUBLE_COUNT: {
    severity: AnomalySeverity.HIGH,
    definition: 'Parent and child account balances both counted (GL-110 + rollup defects).',
    detection: 'Hierarchy scan.',
    requiredEvidence: 'Hierarchy + activity.',
    permittedRepairs: [RepairType.REPORT_ONLY_REPAIR, RepairType.RECLASSIFICATION_REPAIR],
  },
  LEGACY_V2_DUPLICATION: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Legacy and V2 journals both carry financial effect for one event (GL-117).',
    detection: 'Authority-conflict scan.',
    requiredEvidence: 'Event identity + line comparison; Phase 5 authority rules.',
    permittedRepairs: [RepairType.DUPLICATE_EFFECT_REPAIR],
  },
  DIRECT_ACCOUNT_BALANCE_UPDATE: {
    severity: AnomalySeverity.HIGH,
    definition: 'Stored balance changed without journal support.',
    detection: 'GL-111 with no journal trail.',
    requiredEvidence: 'Audit trail of the update.',
    permittedRepairs: [RepairType.PROJECTION_REBUILD, RepairType.REPORT_ONLY_REPAIR],
  },
  REPORT_QUERY_ERROR: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Journals correct; a report query duplicates/excludes/misclassifies.',
    detection: 'Surface comparison (GL-115).',
    requiredEvidence: 'Query trace, before/correct values.',
    permittedRepairs: [RepairType.REPORT_ONLY_REPAIR],
  },
  SUBLEDGER_CONTROL_DIFFERENCE: controlDifferenceType('AR/AP subledger'),
  INVENTORY_CONTROL_DIFFERENCE: controlDifferenceType('inventory'),
  PAYROLL_CONTROL_DIFFERENCE: controlDifferenceType('payroll'),
  ASSET_CONTROL_DIFFERENCE: controlDifferenceType('fixed assets'),
  LOAN_CONTROL_DIFFERENCE: controlDifferenceType('loans'),
  TAX_CONTROL_DIFFERENCE: controlDifferenceType('tax'),
  EQUITY_CONTROL_DIFFERENCE: controlDifferenceType('equity'),
  ROUNDING_DIFFERENCE: {
    severity: AnomalySeverity.LOW,
    definition: 'Cent-level float residue from legacy arithmetic.',
    detection: 'Reconciliation tolerance analysis.',
    requiredEvidence: 'Measured difference and origin.',
    permittedRepairs: [RepairType.AMOUNT_ADJUSTMENT_REPAIR, RepairType.REPORT_ONLY_REPAIR],
  },
  CURRENCY_DIFFERENCE: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Base/transaction currency disagreement.',
    detection: 'Currency reconciliation.',
    requiredEvidence: 'Rates at posting time.',
    permittedRepairs: [RepairType.AMOUNT_ADJUSTMENT_REPAIR, RepairType.REPORT_ONLY_REPAIR],
  },
  UNSUPPORTED_HISTORICAL_RECORD: {
    severity: AnomalySeverity.HIGH,
    definition: 'Historical record (e.g. header-amount journal) outside the canonical ledger with no line support.',
    detection: 'JRN-104 header-only scan.',
    requiredEvidence: 'Source document to reconstruct lines, or exception.',
    permittedRepairs: [RepairType.MISSING_JOURNAL_REPAIR, RepairType.REPORT_ONLY_REPAIR],
  },
  CROSS_TENANT_REFERENCE: {
    severity: AnomalySeverity.CRITICAL,
    definition: 'Record references another tenant\'s account/journal/source.',
    detection: 'Tenant-scope scan of line accounts and links.',
    requiredEvidence: 'Ownership review; security incident.',
    permittedRepairs: [RepairType.CROSS_BUSINESS_REPAIR, RepairType.METADATA_ONLY_REPAIR],
  },
  MISSING_APPROVAL: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Posting lacks a required approval record.',
    detection: 'Approval-policy scan.',
    requiredEvidence: 'Policy at posting time.',
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR],
  },
  MISSING_ATTACHMENT: {
    severity: AnomalySeverity.LOW,
    definition: 'Required evidence attachment absent.',
    detection: 'Attachment scan.',
    requiredEvidence: 'The attachment.',
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR],
  },
  OTHER_CONFIRMED_ERROR: {
    severity: AnomalySeverity.MEDIUM,
    definition: 'Confirmed defect outside the standard catalogue.',
    detection: 'Manual investigation.',
    requiredEvidence: 'Case-specific.',
    permittedRepairs: Object.values(RepairType),
  },
});

function dimensionType(label) {
  return {
    severity: AnomalySeverity.MEDIUM,
    definition: `Wrong ${label} dimension on a journal whose amounts are correct.`,
    detection: 'Dimension comparison against source.',
    requiredEvidence: `Proven rightful ${label}.`,
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR, RepairType.RECLASSIFICATION_REPAIR],
  };
}

function missingDimensionType(label, subledger) {
  return {
    severity: AnomalySeverity.MEDIUM,
    definition: `Missing ${label} dimension required by the ${subledger}.`,
    detection: 'Dimension-completeness scan.',
    requiredEvidence: `Proven ${label} identity.`,
    permittedRepairs: [RepairType.METADATA_ONLY_REPAIR],
  };
}

function controlDifferenceType(area) {
  return {
    severity: AnomalySeverity.HIGH,
    definition: `The ${area} control account disagrees with its subledger/records.`,
    detection: `${area} reconciliation.`,
    requiredEvidence: 'Per-record reconciliation trail.',
    permittedRepairs: [
      RepairType.MISSING_JOURNAL_REPAIR,
      RepairType.RECLASSIFICATION_REPAIR,
      RepairType.AMOUNT_ADJUSTMENT_REPAIR,
      RepairType.REPORT_ONLY_REPAIR,
    ],
  };
}

/**
 * Approval matrix per repair class. `permissions` are ALL required of the
 * approver; `separationOfDuties` forbids the executor approving their own
 * repair.
 */
export const APPROVAL_MATRIX = Object.freeze({
  [RepairType.METADATA_ONLY_REPAIR]: { role: 'Senior accountant', separationOfDuties: false, riskTier: 'LOW' },
  [RepairType.SOURCE_STATUS_REPAIR]: { role: 'Senior accountant', separationOfDuties: false, riskTier: 'LOW' },
  [RepairType.SOURCE_LINK_REPAIR]: { role: 'Senior accountant', separationOfDuties: false, riskTier: 'LOW' },
  [RepairType.REVERSAL_REPAIR]: { role: 'Finance Manager', separationOfDuties: true, riskTier: 'HIGH' },
  [RepairType.RECLASSIFICATION_REPAIR]: { role: 'Finance Manager', separationOfDuties: true, riskTier: 'HIGH' },
  [RepairType.AMOUNT_ADJUSTMENT_REPAIR]: { role: 'Finance Manager', separationOfDuties: true, riskTier: 'HIGH' },
  [RepairType.MISSING_JOURNAL_REPAIR]: { role: 'Finance Manager', separationOfDuties: true, riskTier: 'HIGH' },
  [RepairType.DUPLICATE_EFFECT_REPAIR]: { role: 'Finance Manager', separationOfDuties: true, riskTier: 'HIGH' },
  [RepairType.PERIOD_ADJUSTMENT_REPAIR]: { role: 'Finance Manager + period controller', separationOfDuties: true, riskTier: 'HIGH' },
  [RepairType.CROSS_BUSINESS_REPAIR]: { role: 'Finance Manager + Super Administrator', separationOfDuties: true, riskTier: 'CRITICAL' },
  [RepairType.REPORT_ONLY_REPAIR]: { role: 'Senior accountant', separationOfDuties: false, riskTier: 'LOW' },
  [RepairType.PROJECTION_REBUILD]: { role: 'Senior accountant', separationOfDuties: false, riskTier: 'LOW' },
});

/** Map Phase 5 integrity rule codes to anomaly types (detection reuse). */
export const RULE_TO_ANOMALY_TYPE = Object.freeze({
  'JRN-101': 'TECHNICAL_LINKAGE_ERROR',
  'JRN-102': 'UNBALANCED_JOURNAL',
  'JRN-103': 'TECHNICAL_LINKAGE_ERROR',
  'JRN-104': 'UNSUPPORTED_HISTORICAL_RECORD',
  'JRN-105': 'DUPLICATE_JOURNAL_LINE',
  'JRN-106': 'TECHNICAL_LINKAGE_ERROR',
  'JRN-107': 'INVALID_REVERSAL',
  'JRN-108': 'MISSING_SOURCE_LINK',
  'JRN-109': 'TECHNICAL_LINKAGE_ERROR',
  'JRN-110': 'DUPLICATE_JOURNAL_LINE',
  'GL-110': 'PARENT_CHILD_DOUBLE_COUNT',
  'GL-111': 'STORED_BALANCE_DIFFERENCE',
  'GL-112': 'UNBALANCED_JOURNAL',
  'GL-113': 'TECHNICAL_LINKAGE_ERROR',
  'GL-114': 'STORED_BALANCE_DIFFERENCE',
  'GL-115': 'REPORT_QUERY_ERROR',
  'GL-116': 'WRONG_ACCOUNT',
  'GL-117': 'LEGACY_V2_DUPLICATION',
  'GL-118': 'REPORT_QUERY_ERROR',
});

export function anomalyTypeInfo(type) {
  return ANOMALY_TYPES[type] ?? null;
}

export function isRepairPermitted(anomalyType, repairType) {
  const info = ANOMALY_TYPES[anomalyType];
  return Boolean(info && info.permittedRepairs.includes(repairType));
}
