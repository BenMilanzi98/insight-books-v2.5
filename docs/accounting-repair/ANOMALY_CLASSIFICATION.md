# Anomaly Classification

Single source of truth: `ANOMALY_TYPES` in
`lib/accountingV2/repair/repairCatalogue.js`. Every anomaly type defines a
definition, detection rule, required evidence, permitted repair classes and a
default severity; verification is always the batch verification pipeline and
rollback follows `ROLLBACK_STRATEGY.md` per repair class.

## Catalogue (50 types)

Technical / linkage: `TECHNICAL_LINKAGE_ERROR`, `MISSING_SOURCE_LINK`,
`MISSING_JOURNAL`, `ORPHAN_JOURNAL`.

Duplication: `DUPLICATE_JOURNAL` (CRITICAL), `DUPLICATE_JOURNAL_LINE`,
`DUPLICATE_REVERSAL` (CRITICAL), `OPENING_BALANCE_DUPLICATION` (CRITICAL),
`CAPITAL_DUPLICATION` (CRITICAL), `LEGACY_V2_DUPLICATION` (CRITICAL).

Journal correctness: `UNBALANCED_JOURNAL` (CRITICAL), `WRONG_ACCOUNT`,
`WRONG_ACCOUNT_CATEGORY`, `WRONG_PERIOD`, `WRONG_POSTING_DATE`,
`WRONG_TRANSACTION_DATE`, `INVALID_REVERSAL`, `MISSING_REVERSAL`.

Tenancy / dimensions: `WRONG_BUSINESS` (CRITICAL), `CROSS_TENANT_REFERENCE`
(CRITICAL), `WRONG_BRANCH`, `WRONG_DEPARTMENT`, `WRONG_PROJECT`,
`WRONG_COST_CENTRE`, `MISSING_CUSTOMER`, `MISSING_SUPPLIER`, `MISSING_OWNER`,
`MISSING_EMPLOYEE`, `MISSING_BANK_ACCOUNT`, `MISSING_ASSET`, `MISSING_LOAN`,
`MISSING_TAX_CODE`.

Balances / reporting: `UNSUPPORTED_OPENING_BALANCE`, `UNSUPPORTED_LIABILITY`,
`STORED_BALANCE_DIFFERENCE`, `DIRECT_ACCOUNT_BALANCE_UPDATE`,
`PARENT_CHILD_DOUBLE_COUNT`, `REPORT_QUERY_ERROR`,
`UNSUPPORTED_HISTORICAL_RECORD`.

Control differences: `SUBLEDGER_CONTROL_DIFFERENCE`,
`INVENTORY_CONTROL_DIFFERENCE`, `PAYROLL_CONTROL_DIFFERENCE`,
`ASSET_CONTROL_DIFFERENCE`, `LOAN_CONTROL_DIFFERENCE`, `TAX_CONTROL_DIFFERENCE`,
`EQUITY_CONTROL_DIFFERENCE`.

Other: `ROUNDING_DIFFERENCE` (LOW), `CURRENCY_DIFFERENCE`, `MISSING_APPROVAL`,
`MISSING_ATTACHMENT` (LOW), `OTHER_CONFIRMED_ERROR`.

## Permitted repairs are enforced

`proposeRepair` and `executeRepair` both call `isRepairPermitted(anomalyType,
repairType)`; a repair class outside the type's `permittedRepairs` list is
rejected server-side. Examples: `REPORT_QUERY_ERROR` accepts only
`REPORT_ONLY_REPAIR` (a query defect can never spawn a journal);
`DUPLICATE_JOURNAL` accepts only `DUPLICATE_EFFECT_REPAIR` (reversal of the
duplicate, never deletion); `WRONG_BUSINESS` accepts only
`CROSS_BUSINESS_REPAIR` (reverse + repost, never a businessId mutation).

## Rule-code mapping

Phase 5 integrity rule codes map to anomaly types via `RULE_TO_ANOMALY_TYPE`
(e.g. `JRN-102 → UNBALANCED_JOURNAL`, `GL-111 → STORED_BALANCE_DIFFERENCE`,
`GL-117 → LEGACY_V2_DUPLICATION`, `GL-110 → PARENT_CHILD_DOUBLE_COUNT`). The
mapping is exhaustively tested (`accountingV2.repair.test.js`).
