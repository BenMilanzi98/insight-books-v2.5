# Legacy Equity Migration Strategy

## Inventory

| Artifact | Treatment |
|---|---|
| `EquityAccount` floats | Read-only legacy; not GL authority |
| `TenantSettings.ownerContributedCapital` | Do not add to reports; dual-count risk |
| Capital Account contributions | Continue via adapters; optionally link to EqV2Relationship |
| Missing owner dimensions on JE | Exception register — do not invent |

## Stages

1. Inventory + readiness CSV  
2. Create EqV2PartyRelationship for proven owners  
3. Link proven sources to journals (no invented amounts)  
4. Reconcile subledger to GL  
5. Enable `equityManagementV2Enabled` per business  

Do not silently change historical amounts. Do not invent ownership percentages.
