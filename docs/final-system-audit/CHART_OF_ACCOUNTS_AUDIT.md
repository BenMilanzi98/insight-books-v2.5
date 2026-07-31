# Chart of Accounts Audit

## Authority

CoA is account master (code, name, type, subtype, normal balance, parent, posting flags, classifications).

## Presentation vs posting

- Structure tree: `lib/coaSystemStructureTree.js`
- Parent rollup + catch-all fold: `lib/coaChartRollup.js`
- 3100 capital bucket: `apply3100CapitalBucketAncestorPropagation` — children already parented under 3100 are **excluded** from re-fold (`accountsFor3100CapitalDropdown`).

## CAP-002 class (MK1,000,000 → MK2,000,000)

Root causes historically:
1. Parent rollup + catch-all fold both adding 3101–3199
2. UI `applyCatchAllRowDisplayBalancesToList` after server fold (helper retained; **no current callers**)
3. Stored `Account.balance` / equity subledger drift

Mitigations in code + tests:
- `test/coaRollupInventory.test.js` — does not double-count 3101 child under 3100
- `REG-CAP-005` journal once
- `lib/accountingAudit/capitalEquityAudit.js` READ-ONLY forensic

## Remaining

Production tenant extract + capitalEquityAudit execution **PENDING** (FSA-GAP-003).

## Result

**CODE MITIGATED / DATA NOT CERTIFIED**
